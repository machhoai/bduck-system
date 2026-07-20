import { createHash } from "node:crypto";
import {
  AuditAction,
  InvoiceOrderSyncPurpose,
  InvoiceOrderSyncRunStatus,
  type MeInvoiceStoreConfig,
} from "@bduck/shared-types";
import {
  invoiceOrderRepository,
  invoiceSourceOrderDocumentId,
} from "../repositories/invoiceOrderRepository.js";
import {
  meInvoiceConfigRepository,
  type StoredMeInvoiceAccount,
} from "../repositories/meInvoiceConfigRepository.js";
import type { AuthorizationService } from "./authorization/index.js";
import { logAudit, type AuditMetadata } from "./auditService.js";
import {
  calculateInvoice,
  INVOICE_CALCULATION_VERSION,
} from "./invoiceCalculationService.js";
import { ensureInitialInvoiceDocument } from "./invoiceDocumentService.js";
import { adaptJoyworldOrderItems } from "./invoiceOrderAdapter.js";
import { preflightInvoiceSourceOrder } from "./invoicePreflightService.js";
import type { InvoiceOrderSyncInput } from "./invoiceOrderSyncSchemas.js";
import {
  getJoyworldToken,
  getOrderDetail,
  getOrderGoodsList,
  getOrderList,
  type RevenueOverviewResponse,
} from "./joyworldService.js";
import { loadWarehouseById } from "./warehouseService.js";
import { toPublicStoreConfig } from "./meInvoiceStoreConfigService.js";
import {
  canonicalJson,
  deriveAmountBeforeTax,
  parseJoyworldDate,
} from "./invoiceOrderSyncUtils.js";

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
  businessDate: string,
  order: JsonRecord,
  goods: JsonRecord[],
  detailResponse: RevenueOverviewResponse,
  storeConfig: MeInvoiceStoreConfig | null,
  account: StoredMeInvoiceAccount | null,
) => {
  const detail = asRecord(detailResponse.data);
  const sourceOrderId =
    nullableString(order.orderId) ?? nullableString(order.id);
  if (!sourceOrderId) throw new Error("JOYWORLD_ORDER_ID_MISSING");
  const paymentTime = resolvePaymentTime(detail);
  const createTime =
    nullableString(detail.createTime) ?? nullableString(order.createTime);
  const rawPayload = { order, goods, detail_response: detailResponse };
  const detailGoods = Array.isArray(detail.goodsInfo) ? detail.goodsInfo : [];
  const realMoney = nullableNumber(detail.realMoney ?? order.realMoney);
  const taxMoney = nullableNumber(detail.taxMoney ?? order.taxMoney);
  const amountBeforeTax = deriveAmountBeforeTax(realMoney, taxMoney);
  const paymentMethod = nullableString(
    detail.payModeNames ?? order.payModeNames,
  );
  const mappedPaymentMethod = paymentMethod
    ? (storeConfig?.payment_method_mapping[paymentMethod] ?? null)
    : null;
  const normalizedItems = adaptJoyworldOrderItems(detailGoods, goods, {
    price_includes_vat: storeConfig?.price_includes_vat ?? null,
    tax_rate_source: storeConfig?.tax_rate_source ?? "SOURCE",
    default_vat_rate_name: storeConfig?.default_vat_rate_name ?? null,
    sku_mapping: storeConfig?.sku_mapping ?? {},
    category_vat_mapping: storeConfig?.category_vat_mapping ?? {},
    unit_price_decimal_digits:
      storeConfig?.option_user_defined.unit_price_oc_decimal_digits ?? 0,
  });
  const calculation =
    storeConfig?.price_includes_vat === null ||
    storeConfig?.price_includes_vat === undefined
      ? null
      : calculateInvoice(
          normalizedItems,
          storeConfig.price_includes_vat,
          storeConfig.option_user_defined,
        );
  const paymentDate = parseJoyworldDate(paymentTime);
  const preflight = preflightInvoiceSourceOrder({
    lines: normalizedItems,
    calculation,
    amount_decimal_digits:
      storeConfig?.option_user_defined.amount_oc_decimal_digits ?? 0,
    source_amount_without_vat: amountBeforeTax,
    source_vat_amount: taxMoney,
    source_total_amount: realMoney,
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
      source_system: "JOYWORLD",
      source_order_id: sourceOrderId,
      business_date: businessDate,
      source_create_time: createTime,
      payment_time: paymentTime,
      source_action_time: parseJoyworldDate(paymentTime ?? createTime),
      source_status: nullableNumber(detail.status ?? order.status),
      order_number: nullableString(detail.orderNumber ?? order.orderNumber),
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
    },
  };
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
  authorization.assert(permission, input.warehouse_id);
  await loadWarehouseById(input.warehouse_id);
  const storedStoreConfig = await meInvoiceConfigRepository.getStoreConfig(
    input.warehouse_id,
  );
  const storeConfig =
    storedStoreConfig && storedStoreConfig.is_deleted !== true
      ? toPublicStoreConfig(storedStoreConfig)
      : null;
  const accountId = storeConfig?.meinvoice_account_id;
  const account = accountId
    ? await meInvoiceConfigRepository.getAccount(accountId)
    : null;

  const startedAt = new Date();
  const runId = await invoiceOrderRepository.createRun({
    warehouse_id: input.warehouse_id,
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
    const writes = orderRows.map((order, index) => {
      const orderId =
        nullableString(order.orderId) ?? nullableString(order.id) ?? "";
      return buildSourceOrder(
        input.warehouse_id,
        input.business_date,
        order,
        goodsByOrder.get(orderId) ?? [],
        details[index],
        storeConfig,
        account,
      );
    });
    const syncTime = new Date();
    const counts = await invoiceOrderRepository.upsertOrders(
      input.warehouse_id,
      runId,
      writes,
      syncTime,
    );
    let draftCreatedCount = 0;
    if (
      input.purpose === InvoiceOrderSyncPurpose.ISSUE &&
      storeConfig &&
      account
    ) {
      const candidates = writes.filter((write) => {
        const preflight = write.projection.preflight as
          | {
              issues?: Array<{ code?: string }>;
            }
          | undefined;
        return !preflight?.issues?.some(
          (issue) => issue.code === "BEFORE_GO_LIVE",
        );
      });
      const prepared = await mapLimit(candidates, DETAIL_CONCURRENCY, (write) =>
        ensureInitialInvoiceDocument(
          {
            id: invoiceSourceOrderDocumentId(
              input.warehouse_id,
              write.source_order_id,
            ),
            ...write.projection,
            source_payload_hash: write.source_payload_hash,
          },
          storeConfig,
          account,
          actorId,
        ),
      );
      draftCreatedCount = prepared.filter(
        (item) => item?.created === true,
      ).length;
    }
    const result = {
      id: runId,
      ...input,
      order_count: writes.length,
      draft_created_count: draftCreatedCount,
      ...counts,
    };
    await invoiceOrderRepository.updateRun(runId, {
      status: InvoiceOrderSyncRunStatus.COMPLETED,
      ...counts,
      order_count: writes.length,
      draft_created_count: draftCreatedCount,
      completed_at: syncTime,
    });
    await logAudit({
      entity_type: "INVOICE_ORDER_SYNC_RUN",
      entity_id: runId,
      warehouse_id: input.warehouse_id,
      action: AuditAction.CREATE,
      user_id: actorId,
      old_value: null,
      new_value: result,
      notes: `JoyWorld full-day order sync (${input.purpose})`,
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
  return invoiceOrderRepository.listOrders(warehouseId, businessDate);
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
  return order;
};
