import { createHash } from "node:crypto";

import {
  AuditAction,
  InvoiceOrderSyncPurpose,
  InvoiceOrderSyncRunStatus,
  type MeInvoiceStoreConfig,
} from "@bduck/shared-types";

import { invoiceDocumentRepository } from "../repositories/invoiceDocumentRepository.js";
import {
  invoiceOrderRepository,
  invoiceSourceOrderDocumentId,
  type SourceOrderWrite,
  type SourceOrderWriteResult,
} from "../repositories/invoiceOrderRepository.js";
import {
  meInvoiceConfigRepository,
  type StoredMeInvoiceAccount,
} from "../repositories/meInvoiceConfigRepository.js";
import {
  posInvoiceOrderRepository,
  type PosInvoiceOrderRecord,
} from "../repositories/posInvoiceOrderRepository.js";

import { logAudit, type AuditMetadata } from "./auditService.js";
import type { AuthorizationService } from "./authorization/index.js";
import { partitionExternalOrders } from "./externalStoreBindingPolicy.js";
import {
  resolveExternalStoreBinding,
} from "./externalStoreBindingService.js";
import {
  calculateInvoice,
  INVOICE_CALCULATION_VERSION,
} from "./invoiceCalculationService.js";
import { prepareInvoiceDocumentFromSourceOrder } from "./invoiceDocumentService.js";
import { invoiceLineShouldAppearInIssuedInvoice } from "./invoiceLineVisibilityPolicy.js";
import { adaptJoyworldOrderItems } from "./invoiceOrderAdapter.js";
import { finalInvoiceSourceWrites } from "./invoiceOrderFinalization.js";
import type { InvoiceOrderSyncInput } from "./invoiceOrderSyncSchemas.js";
import {
  canonicalJson,
  deriveAmountBeforeTax,
  parseJoyworldDate,
} from "./invoiceOrderSyncUtils.js";
import { invoiceOrderShouldAppearInList } from "./invoiceOrderVisibilityPolicy.js";
import { resolveInvoiceSourcePaymentMethod } from "./invoicePaymentMethod.js";
import { syncPosInvoiceOrdersForDate } from "./invoicePosOrderSyncService.js";
import { preflightInvoiceSourceOrder } from "./invoicePreflightService.js";
import { sourceOrderIsInvoiceEligible } from "./invoiceReconciliationPolicy.js";
import {
  getJoyworldToken,
  getOrderDetail,
  getOrderGoodsList,
  getOrderList,
  type RevenueOverviewResponse,
} from "./joyworldService.js";
import { toPublicStoreConfig } from "./meInvoiceStoreConfigService.js";
import { loadWarehouseById } from "./warehouseService.js";

type JsonRecord = Record<string, unknown>;
const PAGE_SIZE = 200;
const DETAIL_CONCURRENCY = 5;
const INVOICE_MAPPING_VERSION = "joyworld-meinvoice-v1";

const asRecord = (value: unknown): JsonRecord =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};

const extractRows = (response: RevenueOverviewResponse): JsonRecord[] => {
  if (Array.isArray(response.data)) return response.data.map(asRecord);
  const data = asRecord(response.data);
  for (const candidate of [
    data.dataXs,
    data.records,
    data.rows,
    data.list,
    data.items,
  ]) {
    if (Array.isArray(candidate)) return candidate.map(asRecord);
  }
  return [];
};

const extractTotal = (response: RevenueOverviewResponse): number => {
  const data = asRecord(response.data);
  for (const value of [
    response.totals,
    response.total,
    data.totals,
    data.total,
  ]) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  }
  return 0;
};

const assertSourceSuccess = (response: RevenueOverviewResponse) => {
  if (response.success === false) {
    const code = nullableString(response.code) ?? "UNKNOWN";
    throw new Error(`JOYWORLD_RESPONSE_FAILED_${code}`);
  }
};

const fetchAllPages = async (
  fetchPage: (page: number, limit: number) => Promise<RevenueOverviewResponse>,
): Promise<JsonRecord[]> => {
  const rows: JsonRecord[] = [];
  for (let page = 1; page <= 10_000; page += 1) {
    const response = await fetchPage(page, PAGE_SIZE);
    assertSourceSuccess(response);
    const pageRows = extractRows(response);
    rows.push(...pageRows);
    const total = extractTotal(response);
    if (
      pageRows.length === 0 ||
      pageRows.length < PAGE_SIZE ||
      (total > 0 && rows.length >= total)
    ) {
      return rows;
    }
  }
  throw new Error("JOYWORLD_PAGINATION_LIMIT_EXCEEDED");
};

const mapLimit = async <T, R>(
  values: T[],
  limit: number,
  mapper: (value: T) => Promise<R>,
): Promise<R[]> => {
  const result: R[] = new Array(values.length);
  let cursor = 0;
  const worker = async () => {
    while (cursor < values.length) {
      const index = cursor;
      cursor += 1;
      result[index] = await mapper(values[index]);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(limit, values.length) }, worker),
  );
  return result;
};

const payloadHash = (value: unknown) =>
  createHash("sha256").update(canonicalJson(value)).digest("hex");

const nullableString = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

const nullableNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const resolvePaymentTime = (detailData: JsonRecord): string | null => {
  const paymentRows = Array.isArray(detailData.payModeInfo)
    ? detailData.payModeInfo.map(asRecord)
    : [];
  const successful = paymentRows.filter((row) => Number(row.payStatus) === 2);
  const candidates = (successful.length > 0 ? successful : paymentRows)
    .map((row) => nullableString(row.payTime))
    .filter((value): value is string => Boolean(value))
    .sort();
  return candidates.at(-1) ?? null;
};

const buildSourceOrder = (
  warehouseId: string,
  sourceAccountKey: string,
  businessDate: string,
  order: JsonRecord,
  goods: JsonRecord[],
  detailResponse: RevenueOverviewResponse,
  storeConfig: MeInvoiceStoreConfig | null,
  account: StoredMeInvoiceAccount | null,
  linkedPosOrder: PosInvoiceOrderRecord | null,
) => {
  const detail = asRecord(detailResponse.data);
  const joyworldOrderId =
    nullableString(order.orderId) ?? nullableString(order.id);
  if (!joyworldOrderId) throw new Error("JOYWORLD_ORDER_ID_MISSING");
  const hkOrderNumber =
    nullableString(detail.orderNumber ?? order.orderNumber) ??
    nullableString(linkedPosOrder?.hkOrderNumber);
  const localOrderId = nullableString(linkedPosOrder?.localOrderId);
  const sourceOrderId = localOrderId ?? joyworldOrderId;
  const sourceSystem = localOrderId ? "JPOS" : "JOYWORLD";
  const paymentMethod = resolveInvoiceSourcePaymentMethod(
    detail.payModeNames ?? order.payModeNames,
    linkedPosOrder,
  );
  const paymentTime = resolvePaymentTime(detail);
  const createTime =
    nullableString(detail.createTime) ?? nullableString(order.createTime);
  const rawPayload = {
    order,
    goods,
    detail_response: detailResponse,
    source_identity: {
      source_system: sourceSystem,
      local_order_id: localOrderId,
      hk_order_number: hkOrderNumber,
      joyworld_order_id: joyworldOrderId,
      ...(linkedPosOrder
        ? {
            local_payment: {
              payment_method: nullableString(linkedPosOrder.paymentMethod),
              payment_method_id: nullableString(linkedPosOrder.paymentMethodId),
              payment_method_name: nullableString(
                linkedPosOrder.paymentMethodName,
              ),
            },
          }
        : {}),
    },
  };
  const detailGoods = Array.isArray(detail.goodsInfo) ? detail.goodsInfo : [];
  const realMoney = nullableNumber(detail.realMoney ?? order.realMoney);
  const taxMoney = nullableNumber(detail.taxMoney ?? order.taxMoney);
  const amountBeforeTax = deriveAmountBeforeTax(realMoney, taxMoney);
  const defaultPaymentMethod = nullableString(
    storeConfig?.default_payment_method_name,
  );
  const mappedPaymentMethod = paymentMethod
    ? (storeConfig?.payment_method_mapping[paymentMethod] ??
      defaultPaymentMethod ??
      null)
    : defaultPaymentMethod;
  const normalizedItems = adaptJoyworldOrderItems(detailGoods, goods, {
    price_includes_vat: storeConfig?.price_includes_vat ?? null,
    tax_rate_source: storeConfig?.tax_rate_source ?? "SOURCE",
    default_vat_rate_name: storeConfig?.default_vat_rate_name ?? null,
    default_unit_name: storeConfig?.default_unit_name ?? null,
    sku_mapping: storeConfig?.sku_mapping ?? {},
    category_vat_mapping: storeConfig?.category_vat_mapping ?? {},
    unit_price_decimal_digits:
      storeConfig?.option_user_defined.unit_price_oc_decimal_digits ?? 0,
  });
  const invoiceItems = normalizedItems.filter(
    invoiceLineShouldAppearInIssuedInvoice,
  );
  const calculation =
    storeConfig?.price_includes_vat === null ||
    storeConfig?.price_includes_vat === undefined
      ? null
      : calculateInvoice(
          invoiceItems,
          storeConfig.price_includes_vat,
          storeConfig.option_user_defined,
        );
  const paymentDate = parseJoyworldDate(paymentTime);
  const preflight = preflightInvoiceSourceOrder({
    lines: normalizedItems,
    calculation,
    payment_time: paymentDate,
    mapped_payment_method: mappedPaymentMethod,
    store_config_exists: Boolean(storeConfig),
    store_config_enabled: storeConfig?.enabled === true,
    price_includes_vat: storeConfig?.price_includes_vat ?? null,
    inv_series: storeConfig?.inv_series ?? null,
    go_live_at: storeConfig?.go_live_at ?? null,
    account_exists: Boolean(account),
    account_enabled: account?.enabled === true,
    account_last_test_succeeded: account?.last_test_succeeded === true,
  });

  return {
    source_order_id: sourceOrderId,
    source_payload_hash: payloadHash(rawPayload),
    raw_payload: rawPayload,
    projection: {
      warehouse_id: warehouseId,
      source_system: sourceSystem,
      source_order_id: sourceOrderId,
      external_source_account_key: sourceAccountKey,
      external_order_number: hkOrderNumber ?? joyworldOrderId,
      local_order_id: localOrderId,
      hk_order_number: hkOrderNumber,
      pos_order_status: linkedPosOrder?.status ?? null,
      business_date: businessDate,
      source_create_time: createTime,
      payment_time: paymentTime,
      source_action_time: parseJoyworldDate(paymentTime ?? createTime),
      source_status: nullableNumber(detail.status ?? order.status),
      order_number: hkOrderNumber,
      customer_name: nullableString(detail.realName ?? order.realName),
      payment_method: paymentMethod,
      mapped_payment_method: mappedPaymentMethod,
      original_money: nullableNumber(
        detail.originalMoney ?? order.originalMoney,
      ),
      system_money: nullableNumber(detail.sysMoney ?? order.sysMoney),
      discount_money: nullableNumber(
        detail.discountMoney ?? order.discountMoney,
      ),
      real_money: realMoney,
      cancel_money: nullableNumber(detail.cancelMoney ?? order.cancelMoney),
      tax_money: taxMoney,
      amount_before_tax: amountBeforeTax,
      item_count: detailGoods.length || goods.length,
      normalized_items: normalizedItems,
      calculation,
      preflight,
      mapping_version: INVOICE_MAPPING_VERSION,
      calculation_version: INVOICE_CALCULATION_VERSION,
      customer_invoice_request_status: "AVAILABLE",
      customer_invoice_request_submitted_at: null,
    },
  };
};

interface InvoiceStoreContext {
  storeConfig: MeInvoiceStoreConfig | null;
  account: StoredMeInvoiceAccount | null;
}

const loadInvoiceStoreContext = async (
  warehouseId: string,
): Promise<InvoiceStoreContext> => {
  const storedStoreConfig = await meInvoiceConfigRepository.getStoreConfig(
    warehouseId,
  );
  const storeConfig =
    storedStoreConfig && storedStoreConfig.is_deleted !== true
      ? toPublicStoreConfig(storedStoreConfig)
      : null;
  const accountId = storeConfig?.meinvoice_account_id;
  const account = accountId
    ? await meInvoiceConfigRepository.getAccount(accountId)
    : null;
  return { storeConfig, account };
};

const emptyWriteResult = (): SourceOrderWriteResult => ({
  inserted_count: 0,
  updated_count: 0,
  unchanged_count: 0,
});

const addWriteResult = (
  target: SourceOrderWriteResult,
  value: SourceOrderWriteResult,
) => {
  target.inserted_count += value.inserted_count;
  target.updated_count += value.updated_count;
  target.unchanged_count += value.unchanged_count;
};

export const syncInvoiceOrdersForDate = async (
  input: InvoiceOrderSyncInput,
  actorId: string,
  authorization: AuthorizationService,
  auditMetadata?: AuditMetadata,
) => {
  const permission =
    input.purpose === InvoiceOrderSyncPurpose.ISSUE
      ? "invoices.prepare"
      : "invoices.reconcile";
  const binding = await resolveExternalStoreBinding(
    "JOYWORLD_LEGACY",
    input.warehouse_id,
  );
  const canonicalWarehouseId =
    binding?.canonical_warehouse_id ?? input.warehouse_id;
  authorization.assert(permission, canonicalWarehouseId);
  const memberWarehouseIds = binding?.member_warehouse_ids ?? [input.warehouse_id];
  const sourceAccountKey =
    binding?.source_account_key ?? "joyworld-legacy-default";
  await Promise.all(memberWarehouseIds.map(loadWarehouseById));
  const contextEntries = await Promise.all(
    memberWarehouseIds.map(async (warehouseId) => [
      warehouseId,
      await loadInvoiceStoreContext(warehouseId),
    ] as const),
  );
  const contexts = new Map(contextEntries);

  const startedAt = new Date();
  const runId = await invoiceOrderRepository.createRun({
    warehouse_id: canonicalWarehouseId,
    requested_warehouse_id: input.warehouse_id,
    partition_warehouse_ids: memberWarehouseIds,
    external_store_binding_id: binding?.id ?? null,
    business_date: input.business_date,
    purpose: input.purpose,
    status: InvoiceOrderSyncRunStatus.RUNNING,
    order_count: 0,
    inserted_count: 0,
    updated_count: 0,
    unchanged_count: 0,
    error_code: null,
    requested_by: actorId,
    started_at: startedAt,
    completed_at: null,
  });

  try {
    const posSyncEntries = await Promise.all(
      memberWarehouseIds.map(async (warehouseId) => {
        const context = contexts.get(warehouseId) ?? {
          storeConfig: null,
          account: null,
        };
        return [
          warehouseId,
          await syncPosInvoiceOrdersForDate({
            warehouseId,
            businessDate: input.business_date,
            runId,
            ...context,
            externalSourceAccountKey: sourceAccountKey,
          }),
        ] as const;
      }),
    );
    const posSyncByWarehouse = new Map(posSyncEntries);
    const posCounts = emptyWriteResult();
    let posOrderCount = 0;
    posSyncEntries.forEach(([, value]) => {
      addWriteResult(posCounts, value);
      posOrderCount += value.orders.length;
    });
    await invoiceOrderRepository.updateRun(runId, {
      pos_order_count: posOrderCount,
      pos_inserted_count: posCounts.inserted_count,
      pos_updated_count: posCounts.updated_count,
      pos_unchanged_count: posCounts.unchanged_count,
      pos_draft_created_count: 0,
    });
    const token = await getJoyworldToken();
    const range = {
      startTime: `${input.business_date} 00:00:00`,
      endTime: `${input.business_date} 23:59:59`,
    };
    const [orderRows, goodsRows] = await Promise.all([
      fetchAllPages((page, limit) =>
        getOrderList(token, { ...range, page, limit }),
      ),
      fetchAllPages((page, limit) =>
        getOrderGoodsList(token, { ...range, page, limit }),
      ),
    ]);
    const goodsByOrder = new Map<string, JsonRecord[]>();
    for (const goods of goodsRows) {
      const orderId = nullableString(goods.orderId);
      if (!orderId) continue;
      goodsByOrder.set(orderId, [...(goodsByOrder.get(orderId) ?? []), goods]);
    }
    const details = await mapLimit(orderRows, DETAIL_CONCURRENCY, (order) => {
      const orderId = nullableString(order.orderId) ?? nullableString(order.id);
      if (!orderId) throw new Error("JOYWORLD_ORDER_ID_MISSING");
      return getOrderDetail(token, orderId).then((response) => {
        assertSourceSuccess(response);
        return response;
      });
    });
    const hkOrderNumbers = orderRows
      .map((order, index) =>
        nullableString(
          asRecord(details[index].data).orderNumber ?? order.orderNumber,
        ),
      )
      .filter((value): value is string => Boolean(value));
    const posOrdersByHkNumber =
      await posInvoiceOrderRepository.mapByHkOrderNumbers(hkOrderNumbers);
    const partitionedRows = partitionExternalOrders({
      canonicalWarehouseId,
      memberWarehouseIds,
      candidates: orderRows.map((order, index) => {
      const hkOrderNumber = nullableString(
        asRecord(details[index].data).orderNumber ?? order.orderNumber,
      );
        const linkedPosOrder = hkOrderNumber
          ? posOrdersByHkNumber.get(hkOrderNumber) ?? null
          : null;
        return {
          value: { order, index, linkedPosOrder },
          linkedWarehouseId:
            typeof linkedPosOrder?.warehouseId === "string"
              ? linkedPosOrder.warehouseId
              : null,
        };
      }),
    });
    const writesByWarehouse = new Map<string, SourceOrderWrite[]>();
    for (const [warehouseId, rows] of partitionedRows) {
      const context = contexts.get(warehouseId) ?? {
        storeConfig: null,
        account: null,
      };
      writesByWarehouse.set(
        warehouseId,
        rows.map(({ order, index, linkedPosOrder }) => {
          const orderId =
            nullableString(order.orderId) ?? nullableString(order.id) ?? "";
          return buildSourceOrder(
            warehouseId,
            sourceAccountKey,
            input.business_date,
            order,
            goodsByOrder.get(orderId) ?? [],
            details[index],
            context.storeConfig,
            context.account,
            linkedPosOrder,
          );
        }),
      );
    }
    const syncTime = new Date();
    const writeResults = await Promise.all(
      [...writesByWarehouse.entries()].map(async ([warehouseId, writes]) => [
        warehouseId,
        await invoiceOrderRepository.upsertOrders(
          warehouseId,
          runId,
          writes,
          syncTime,
        ),
      ] as const),
    );
    const counts = emptyWriteResult();
    writeResults.forEach(([, value]) => addWriteResult(counts, value));
    let draftCreatedCount = 0;
    let draftRebasedCount = 0;
    let draftRebaseSkippedCount = 0;
    const partitionCounts: Record<string, number> = {};
    for (const warehouseId of memberWarehouseIds) {
      const writes = writesByWarehouse.get(warehouseId) ?? [];
      partitionCounts[warehouseId] = writes.length;
      const posSync = posSyncByWarehouse.get(warehouseId);
      const context = contexts.get(warehouseId);
      if (
        input.purpose !== InvoiceOrderSyncPurpose.ISSUE ||
        !context?.storeConfig ||
        !context.account ||
        !authorization.can("invoices.prepare", warehouseId)
      ) {
        continue;
      }
      const storeConfig = context.storeConfig;
      const account = context.account;
      const candidates = finalInvoiceSourceWrites(
        warehouseId,
        posSync?.writes ?? [],
        writes,
      ).filter((write) => {
        if (!sourceOrderIsInvoiceEligible(write.projection)) return false;
        const preflight = write.projection.preflight as
          | {
              issues?: Array<{ code?: string }>;
            }
          | undefined;
        return !preflight?.issues?.some(
          (issue) => issue.code === "BEFORE_GO_LIVE",
        );
      });
      const existingDocuments = await invoiceDocumentRepository.getDocuments(
        candidates.map((write) =>
          invoiceSourceOrderDocumentId(
            warehouseId,
            write.source_order_id,
            write.projection.source_system === "JPOS" ? "JPOS" : "JOYWORLD",
          ),
        ),
        warehouseId,
      );
      const existingById = new Map(
        existingDocuments.map((document) => [String(document.id), document]),
      );
      const prepared = await mapLimit(
        candidates,
        DETAIL_CONCURRENCY,
        async (write) => {
          const id = invoiceSourceOrderDocumentId(
            warehouseId,
            write.source_order_id,
            write.projection.source_system === "JPOS" ? "JPOS" : "JOYWORLD",
          );
          const existing = existingById.get(id);
          try {
            await prepareInvoiceDocumentFromSourceOrder(
              id,
              warehouseId,
              write.source_payload_hash,
              actorId,
              authorization,
              auditMetadata,
              {
                safeAutoRebase: true,
                context: {
                  storeConfig,
                  account,
                },
              },
            );
            return !existing
              ? "CREATED"
              : existing.source_payload_hash !== write.source_payload_hash
                ? "REBASED"
                : "UNCHANGED";
          } catch (error) {
            const code = (error as { data?: { code?: string } })?.data?.code;
            if (
              code === "INVOICE_AUTO_REBASE_REQUIRES_REVIEW" ||
              code === "INVOICE_DOCUMENT_NOT_REBASABLE"
            ) {
              return "SKIPPED";
            }
            throw error;
          }
        },
      );
      draftCreatedCount += prepared.filter((item) => item === "CREATED").length;
      draftRebasedCount += prepared.filter((item) => item === "REBASED").length;
      draftRebaseSkippedCount += prepared.filter(
        (item) => item === "SKIPPED",
      ).length;
    }
    const orderCount = new Set(
      memberWarehouseIds.flatMap((warehouseId) => [
        ...(posSyncByWarehouse.get(warehouseId)?.writes ?? []),
        ...(writesByWarehouse.get(warehouseId) ?? []),
      ].map(
        (write) =>
          `${warehouseId}:${write.projection.source_system}:${write.source_order_id}`,
      )),
    ).size;
    const result = {
      id: runId,
      ...input,
      canonical_warehouse_id: canonicalWarehouseId,
      partition_warehouse_ids: memberWarehouseIds,
      partition_counts: partitionCounts,
      order_count: orderCount,
      draft_created_count: draftCreatedCount,
      draft_rebased_count: draftRebasedCount,
      draft_rebase_skipped_count: draftRebaseSkippedCount,
      pos_order_count: posOrderCount,
      pos_counts: posCounts,
      ...counts,
    };
    await invoiceOrderRepository.updateRun(runId, {
      status: InvoiceOrderSyncRunStatus.COMPLETED,
      ...counts,
      order_count: orderCount,
      draft_created_count: draftCreatedCount,
      draft_rebased_count: draftRebasedCount,
      draft_rebase_skipped_count: draftRebaseSkippedCount,
      completed_at: syncTime,
    });
    await logAudit({
      entity_type: "INVOICE_ORDER_SYNC_RUN",
      entity_id: runId,
      warehouse_id: canonicalWarehouseId,
      action: AuditAction.CREATE,
      user_id: actorId,
      old_value: null,
      new_value: result,
      notes: `JoyWorld consolidated full-day order sync (${input.purpose})`,
      ...auditMetadata,
    });
    return result;
  } catch (error) {
    const errorCode =
      error instanceof Error
        ? error.message.slice(0, 120)
        : "UNKNOWN_SYNC_ERROR";
    await invoiceOrderRepository.updateRun(runId, {
      status: InvoiceOrderSyncRunStatus.FAILED,
      error_code: errorCode,
      completed_at: new Date(),
    });
    throw error;
  }
};

export const listInvoiceSourceOrders = async (
  warehouseId: string,
  businessDate: string,
  authorization: AuthorizationService,
) => {
  authorization.assert("invoices.read", warehouseId);
  const orders = await invoiceOrderRepository.listOrders(
    warehouseId,
    businessDate,
  );
  const visibleOrders = orders.filter(invoiceOrderShouldAppearInList);
  const documents = await invoiceDocumentRepository.getDocuments(
    visibleOrders
      .map((order) => order.invoice_document_id)
      .filter((id): id is string => typeof id === "string" && Boolean(id)),
    warehouseId,
  );
  const documentsById = new Map(
    documents.map((document) => [String(document.id), document]),
  );
  return visibleOrders.map((order) => {
    const document =
      typeof order.invoice_document_id === "string"
        ? documentsById.get(order.invoice_document_id)
        : undefined;
    const documentSourcePayloadHash =
      typeof document?.source_payload_hash === "string"
        ? document.source_payload_hash
        : null;
    return {
      ...order,
      invoice_document_source_payload_hash: documentSourcePayloadHash,
      invoice_document_stale: Boolean(
        documentSourcePayloadHash &&
        documentSourcePayloadHash !== order.source_payload_hash,
      ),
    };
  });
};

export const getInvoiceSourceOrder = async (
  id: string,
  warehouseId: string,
  authorization: AuthorizationService,
) => {
  authorization.assert("invoices.read", warehouseId);
  const order = await invoiceOrderRepository.getOrder(id, warehouseId);
  if (!order) {
    throw {
      statusCode: 404,
      messages: {
        vi: "Không tìm thấy đơn hàng đã đồng bộ.",
        zh: "找不到已同步的订单。",
      },
    };
  }
  const document =
    typeof order.invoice_document_id === "string"
      ? await invoiceDocumentRepository.getDocument(
          order.invoice_document_id,
          warehouseId,
        )
      : null;
  const documentSourcePayloadHash =
    typeof document?.source_payload_hash === "string"
      ? document.source_payload_hash
      : null;
  return {
    ...order,
    invoice_document_source_payload_hash: documentSourcePayloadHash,
    invoice_document_stale: Boolean(
      documentSourcePayloadHash &&
      documentSourcePayloadHash !== order.source_payload_hash,
    ),
  };
};
