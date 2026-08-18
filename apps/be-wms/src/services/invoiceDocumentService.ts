import {
  AuditAction,
  InvoiceDocumentStatus,
  InvoicePreparationStatus,
  type InvoiceDocument,
  type InvoiceDocumentRevisionSummary,
  type InvoiceDraftBuyer,
  type InvoiceSourceOrderLine,
  type MeInvoiceStoreConfig,
} from "@bduck/shared-types";

import { invoiceDocumentRepository } from "../repositories/invoiceDocumentRepository.js";
import { invoiceOrderRepository } from "../repositories/invoiceOrderRepository.js";
import {
  meInvoiceConfigRepository,
  type StoredMeInvoiceAccount,
} from "../repositories/meInvoiceConfigRepository.js";

import { logAudit, type AuditMetadata } from "./auditService.js";
import type { AuthorizationService } from "./authorization/index.js";
import { calculateInvoice } from "./invoiceCalculationService.js";
import { buildInitialInvoiceDocument } from "./invoiceDocumentDraftBuilder.js";
import {
  canEditInvoiceDocument,
  canSafelyAutoRebaseInvoiceDocument,
  statusAfterInvoiceEdit,
  vatRateValue,
} from "./invoiceDocumentPolicy.js";
import type {
  InvoiceDocumentBulkRebaseInput,
  InvoiceDocumentUpdateInput,
} from "./invoiceDocumentSchemas.js";
import { invoiceLineShouldAppearInIssuedInvoice } from "./invoiceLineVisibilityPolicy.js";
import { canonicalJson, parseJoyworldDate } from "./invoiceOrderSyncUtils.js";
import { preflightInvoiceSourceOrder } from "./invoicePreflightService.js";
import { dateFromValue } from "./meInvoiceConfigService.js";
import { toPublicStoreConfig } from "./meInvoiceStoreConfigService.js";

type JsonRecord = Record<string, unknown>;

const serviceError = (
  statusCode: number,
  vi: string,
  zh: string,
  code: string,
  data?: Record<string, unknown>,
) => ({ statusCode, messages: { vi, zh }, data: { code, ...data } });

const loadInvoiceContext = async (warehouseId: string) => {
  const storedConfig =
    await meInvoiceConfigRepository.getStoreConfig(warehouseId);
  if (!storedConfig || storedConfig.is_deleted === true) {
    throw serviceError(
      422,
      "Cửa hàng chưa có cấu hình meInvoice.",
      "门店尚未配置 meInvoice。",
      "STORE_CONFIG_MISSING",
    );
  }
  const storeConfig = toPublicStoreConfig(storedConfig);
  const account = await meInvoiceConfigRepository.getAccount(
    storeConfig.meinvoice_account_id,
  );
  if (!account || account.is_deleted) {
    throw serviceError(
      422,
      "Không tìm thấy tài khoản meInvoice của cửa hàng.",
      "找不到门店的 meInvoice 账户。",
      "MEINVOICE_ACCOUNT_MISSING",
    );
  }
  return { storeConfig, account };
};

export const ensureInitialInvoiceDocument = async (
  sourceOrder: JsonRecord,
  storeConfig: MeInvoiceStoreConfig,
  account: StoredMeInvoiceAccount,
  actorId: string,
) => {
  const value = buildInitialInvoiceDocument(
    sourceOrder,
    storeConfig,
    account,
    actorId,
  );
  if (!value) return null;
  return invoiceDocumentRepository.ensureInitialDraft(
    String(value.source_order_document_id),
    String(value.source_payload_hash),
    value,
  );
};

const publicDocument = (
  document: JsonRecord,
  revisions: JsonRecord[] = [],
): InvoiceDocument & { revisions: InvoiceDocumentRevisionSummary[] } => ({
  ...(document as unknown as InvoiceDocument),
  source_action_time: dateFromValue(document.source_action_time),
  edited_at: dateFromValue(document.edited_at),
  reviewed_at: dateFromValue(document.reviewed_at),
  rejected_at: dateFromValue(document.rejected_at),
  created_at: dateFromValue(document.created_at) ?? new Date(0),
  updated_at: dateFromValue(document.updated_at) ?? new Date(0),
  revisions: revisions.map((revision) => ({
    ...(revision as unknown as InvoiceDocumentRevisionSummary),
    created_at: dateFromValue(revision.created_at) ?? new Date(0),
  })),
});

export const prepareInvoiceDocumentFromSourceOrder = async (
  sourceOrderDocumentId: string,
  warehouseId: string,
  expectedSourcePayloadHash: string,
  actorId: string,
  authorization: AuthorizationService,
  auditMetadata?: AuditMetadata,
  options?: {
    safeAutoRebase?: boolean;
    context?: {
      storeConfig: MeInvoiceStoreConfig;
      account: StoredMeInvoiceAccount;
    };
  },
) => {
  authorization.assert("invoices.prepare", warehouseId);
  const sourceOrder = await invoiceOrderRepository.getOrder(
    sourceOrderDocumentId,
    warehouseId,
  );
  if (!sourceOrder) {
    throw serviceError(
      404,
      "Không tìm thấy đơn hàng đã đồng bộ.",
      "找不到已同步的订单。",
      "INVOICE_SOURCE_ORDER_NOT_FOUND",
    );
  }
  if (sourceOrder.source_payload_hash !== expectedSourcePayloadHash) {
    throw serviceError(
      409,
      "Đơn hàng đã thay đổi. Vui lòng tải lại trước khi tạo bản nháp.",
      "订单已更改，请重新加载后再生成草稿。",
      "INVOICE_SOURCE_STALE",
    );
  }
  const { storeConfig, account } =
    options?.context ?? (await loadInvoiceContext(warehouseId));
  const existing = await invoiceDocumentRepository.getDocument(
    sourceOrderDocumentId,
    warehouseId,
  );
  if (existing && existing.source_payload_hash !== expectedSourcePayloadHash) {
    const existingStatus = existing.status as InvoiceDocumentStatus;
    if (!canEditInvoiceDocument(existingStatus)) {
      throw serviceError(
        409,
        "Bản nháp đã vào luồng phát hành nên không thể cập nhật từ đơn nguồn.",
        "草稿已进入开票流程，无法从源订单更新。",
        "INVOICE_DOCUMENT_NOT_REBASABLE",
      );
    }
    if (
      options?.safeAutoRebase &&
      !canSafelyAutoRebaseInvoiceDocument(existing)
    ) {
      throw serviceError(
        409,
        "Draft đã được chỉnh sửa hoặc review và cần xác nhận thủ công.",
        "草稿已编辑或审核，需要人工确认。",
        "INVOICE_AUTO_REBASE_REQUIRES_REVIEW",
      );
    }
    const seed = buildInitialInvoiceDocument(
      sourceOrder,
      storeConfig,
      account,
      actorId,
    );
    if (!seed) {
      throw serviceError(
        422,
        "Đơn hàng chưa có dữ liệu cần thiết để tạo revision mới.",
        "订单缺少生成新修订版本所需的数据。",
        "INVOICE_SOURCE_NOT_PREPARABLE",
      );
    }
    const now = new Date();
    const rebased = await invoiceDocumentRepository.rebaseDraft(
      sourceOrderDocumentId,
      warehouseId,
      Number(existing.revision),
      existingStatus,
      expectedSourcePayloadHash,
      {
        source_order_number: seed.source_order_number,
        source_payload_hash: expectedSourcePayloadHash,
        source_action_time: seed.source_action_time,
        payment_time: seed.payment_time,
        status: seed.status,
        revision: Number(existing.revision) + 1,
        buyer: existing.buyer ?? seed.buyer,
        payment_method_name: seed.payment_method_name,
        items: seed.items,
        calculation: seed.calculation,
        issue_eligible: seed.issue_eligible,
        validation_issues: seed.validation_issues,
        source_financial_fingerprint: seed.source_financial_fingerprint,
        financially_edited: false,
        mapping_version: seed.mapping_version,
        calculation_version: seed.calculation_version,
        ref_id: null,
        prepared_payload_hash: null,
        edited_by: null,
        edited_at: null,
        reviewed_by: null,
        reviewed_at: null,
        review_note: null,
        rejected_by: null,
        rejected_at: null,
        updated_by: actorId,
        updated_at: now,
      },
    );
    await logAudit({
      entity_type: "INVOICE_DOCUMENT",
      entity_id: sourceOrderDocumentId,
      warehouse_id: warehouseId,
      action: AuditAction.UPDATE,
      user_id: actorId,
      old_value: {
        revision: existing.revision,
        source_payload_hash: existing.source_payload_hash,
        status: existing.status,
      },
      new_value: {
        revision: rebased.revision,
        source_payload_hash: expectedSourcePayloadHash,
        status: rebased.status,
        rebase: true,
      },
      notes: "Rebased invoice draft from latest JoyWorld source revision",
      ...auditMetadata,
    });
    const revisions = await invoiceDocumentRepository.listRevisions(
      sourceOrderDocumentId,
      warehouseId,
    );
    return publicDocument(rebased, revisions ?? []);
  }
  const ensured = await ensureInitialInvoiceDocument(
    sourceOrder,
    storeConfig,
    account,
    actorId,
  );
  if (!ensured) {
    throw serviceError(
      422,
      "Đơn hàng chưa có thời điểm thanh toán hoặc dữ liệu chuẩn bị cần thiết.",
      "订单缺少付款时间或必要的准备数据。",
      "INVOICE_SOURCE_NOT_PREPARABLE",
    );
  }
  if (ensured.created) {
    await logAudit({
      entity_type: "INVOICE_DOCUMENT",
      entity_id: sourceOrderDocumentId,
      warehouse_id: warehouseId,
      action: AuditAction.CREATE,
      user_id: actorId,
      old_value: null,
      new_value: {
        source_order_id: sourceOrder.source_order_id,
        source_payload_hash: expectedSourcePayloadHash,
        revision: 1,
        status: ensured.document.status,
      },
      notes: "Created invoice draft from synchronized JoyWorld order",
      ...auditMetadata,
    });
  }
  return getInvoiceDocument(sourceOrderDocumentId, warehouseId, authorization);
};

export type InvoiceBulkRebaseItemStatus =
  | "REBASED"
  | "UNCHANGED"
  | "SKIPPED"
  | "FAILED";

export interface InvoiceBulkRebaseResult {
  total_count: number;
  stale_count: number;
  rebased_count: number;
  unchanged_count: number;
  skipped_count: number;
  failed_count: number;
  items: Array<{
    source_order_document_id: string;
    order_number: string | null;
    status: InvoiceBulkRebaseItemStatus;
    code: string | null;
  }>;
}

const bulkRebaseErrorCode = (error: unknown): string => {
  const known = error as { data?: { code?: unknown }; message?: unknown };
  if (typeof known.data?.code === "string") return known.data.code;
  if (typeof known.message === "string") return known.message.slice(0, 120);
  return "UNKNOWN_BULK_REBASE_ERROR";
};

export const bulkRebaseInvoiceDocuments = async (
  input: InvoiceDocumentBulkRebaseInput,
  actorId: string,
  authorization: AuthorizationService,
  auditMetadata?: AuditMetadata,
): Promise<InvoiceBulkRebaseResult> => {
  authorization.assert("invoices.prepare", input.warehouse_id);
  const orders = await invoiceOrderRepository.listOrders(
    input.warehouse_id,
    input.business_date,
  );
  const requestedIds = new Set(input.source_order_ids);
  const scopedOrders = orders.filter(
    (order) =>
      typeof order.id === "string" &&
      typeof order.invoice_document_id === "string" &&
      (input.selection_mode === "ALL_STALE" || requestedIds.has(order.id)),
  );
  const documents = await invoiceDocumentRepository.getDocuments(
    scopedOrders.map((order) => String(order.invoice_document_id)),
    input.warehouse_id,
  );
  const documentsById = new Map(
    documents.map((document) => [String(document.id), document]),
  );
  const candidates = scopedOrders.filter((order) => {
    if (input.selection_mode !== "ALL_STALE") return true;
    const document = documentsById.get(String(order.invoice_document_id));
    return Boolean(
      document && document.source_payload_hash !== order.source_payload_hash,
    );
  });
  const staleCandidateCount = candidates.filter((order) => {
    const document = documentsById.get(String(order.invoice_document_id));
    return Boolean(
      document && document.source_payload_hash !== order.source_payload_hash,
    );
  }).length;
  const { storeConfig, account } = await loadInvoiceContext(input.warehouse_id);

  const items: InvoiceBulkRebaseResult["items"] = new Array(candidates.length);
  let candidateCursor = 0;
  const worker = async () => {
    while (candidateCursor < candidates.length) {
      const index = candidateCursor;
      candidateCursor += 1;
      const order = candidates[index];
      items[index] = await (async () => {
        const id = String(order.invoice_document_id);
        const orderNumber =
          typeof order.order_number === "string" ? order.order_number : null;
        const document = documentsById.get(id);
        if (!document) {
          return {
            source_order_document_id: id,
            order_number: orderNumber,
            status: "SKIPPED" as const,
            code: "DOCUMENT_NOT_PREPARED",
          };
        }
        if (document.source_payload_hash === order.source_payload_hash) {
          return {
            source_order_document_id: id,
            order_number: orderNumber,
            status: "UNCHANGED" as const,
            code: null,
          };
        }
        if (!canSafelyAutoRebaseInvoiceDocument(document)) {
          return {
            source_order_document_id: id,
            order_number: orderNumber,
            status: "SKIPPED" as const,
            code: "INVOICE_AUTO_REBASE_REQUIRES_REVIEW",
          };
        }
        try {
          await prepareInvoiceDocumentFromSourceOrder(
            id,
            input.warehouse_id,
            String(order.source_payload_hash),
            actorId,
            authorization,
            auditMetadata,
            {
              safeAutoRebase: true,
              context: { storeConfig, account },
            },
          );
          return {
            source_order_document_id: id,
            order_number: orderNumber,
            status: "REBASED" as const,
            code: null,
          };
        } catch (error) {
          const code = bulkRebaseErrorCode(error);
          const skipped = [
            "INVOICE_AUTO_REBASE_REQUIRES_REVIEW",
            "INVOICE_DOCUMENT_NOT_REBASABLE",
            "INVOICE_REVISION_CONFLICT",
            "INVOICE_STATUS_CONFLICT",
          ].includes(code);
          return {
            source_order_document_id: id,
            order_number: orderNumber,
            status: skipped ? ("SKIPPED" as const) : ("FAILED" as const),
            code,
          };
        }
      })();
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(5, candidates.length) }, worker),
  );

  if (input.selection_mode === "SELECTED") {
    const foundIds = new Set(scopedOrders.map((order) => String(order.id)));
    for (const id of input.source_order_ids) {
      if (foundIds.has(id)) continue;
      items.push({
        source_order_document_id: id,
        order_number: null,
        status: "SKIPPED",
        code: "SOURCE_ORDER_NOT_IN_SCOPE",
      });
    }
  }

  const result: InvoiceBulkRebaseResult = {
    total_count: items.length,
    stale_count: staleCandidateCount,
    rebased_count: items.filter((item) => item.status === "REBASED").length,
    unchanged_count: items.filter((item) => item.status === "UNCHANGED").length,
    skipped_count: items.filter((item) => item.status === "SKIPPED").length,
    failed_count: items.filter((item) => item.status === "FAILED").length,
    items,
  };
  await logAudit({
    entity_type: "INVOICE_DRAFT_BULK_REBASE",
    entity_id: `${input.warehouse_id}:${input.business_date}`,
    warehouse_id: input.warehouse_id,
    action: AuditAction.UPDATE,
    user_id: actorId,
    old_value: null,
    new_value: {
      selection_mode: input.selection_mode,
      total_count: result.total_count,
      rebased_count: result.rebased_count,
      skipped_count: result.skipped_count,
      failed_count: result.failed_count,
    },
    notes: "Bulk rebased safe invoice drafts from latest source revisions",
    ...auditMetadata,
  });
  return result;
};

export const getInvoiceDocument = async (
  id: string,
  warehouseId: string,
  authorization: AuthorizationService,
) => {
  authorization.assert("invoices.read", warehouseId);
  const [document, revisions] = await Promise.all([
    invoiceDocumentRepository.getDocument(id, warehouseId),
    invoiceDocumentRepository.listRevisions(id, warehouseId),
  ]);
  if (!document || !revisions) {
    throw serviceError(
      404,
      "Không tìm thấy bản nháp hóa đơn.",
      "找不到发票草稿。",
      "INVOICE_DOCUMENT_NOT_FOUND",
    );
  }
  return publicDocument(document, revisions);
};

const validationForEditedDraft = (
  items: InvoiceSourceOrderLine[],
  paymentMethodName: string,
  paymentTime: string,
  buyer: InvoiceDraftBuyer,
  storeConfig: MeInvoiceStoreConfig,
  account: StoredMeInvoiceAccount,
) => {
  const invoiceItems = items.filter(invoiceLineShouldAppearInIssuedInvoice);
  const calculation =
    storeConfig.price_includes_vat === null
      ? null
      : calculateInvoice(
          invoiceItems,
          storeConfig.price_includes_vat,
          storeConfig.option_user_defined,
        );
  const preflight = preflightInvoiceSourceOrder({
    lines: items,
    calculation,
    payment_time: parseJoyworldDate(paymentTime),
    mapped_payment_method: paymentMethodName,
    store_config_exists: true,
    store_config_enabled: storeConfig.enabled,
    price_includes_vat: storeConfig.price_includes_vat,
    inv_series: storeConfig.inv_series,
    go_live_at: storeConfig.go_live_at,
    account_exists: true,
    account_enabled: account.enabled,
    account_last_test_succeeded: account.last_test_succeeded === true,
  });
  const issues = [...preflight.issues];
  if (!buyer.full_name.trim()) {
    issues.push({
      code: "BUYER_NAME_MISSING",
      severity: "ERROR",
      path: "buyer.full_name",
      message: "Tên người mua không được để trống.",
    });
  }
  return {
    calculation,
    issues,
    issueEligible:
      calculation !== null && !issues.some((item) => item.severity === "ERROR"),
    preparationStatus: preflight.status,
  };
};

export const updateInvoiceDocument = async (
  id: string,
  input: InvoiceDocumentUpdateInput,
  actorId: string,
  authorization: AuthorizationService,
  auditMetadata?: AuditMetadata,
) => {
  authorization.assert("invoices.prepare", input.warehouse_id);
  const current = await invoiceDocumentRepository.getDocument(
    id,
    input.warehouse_id,
  );
  if (!current) {
    throw serviceError(
      404,
      "Không tìm thấy bản nháp hóa đơn.",
      "找不到发票草稿。",
      "INVOICE_DOCUMENT_NOT_FOUND",
    );
  }
  const status = current.status as InvoiceDocumentStatus;
  if (!canEditInvoiceDocument(status)) {
    throw serviceError(
      409,
      "Bản nháp đã được đưa vào xử lý và không còn cho phép sửa.",
      "草稿已进入处理流程，无法再编辑。",
      "INVOICE_DOCUMENT_NOT_EDITABLE",
    );
  }
  if (current.revision !== input.expected_revision) {
    throw serviceError(
      409,
      "Bản nháp đã thay đổi. Vui lòng tải lại trước khi lưu.",
      "发票草稿已更改，请重新加载后再保存。",
      "INVOICE_REVISION_CONFLICT",
    );
  }
  if (current.source_payload_hash !== input.expected_source_payload_hash) {
    throw serviceError(
      409,
      "Dữ liệu đơn hàng nguồn đã thay đổi. Vui lòng đồng bộ lại.",
      "源订单数据已更改，请重新同步。",
      "INVOICE_SOURCE_STALE",
    );
  }
  const nextItems: InvoiceSourceOrderLine[] = input.items
    .map((item) => ({
      ...item,
      vat_rate: vatRateValue(item.vat_rate_name),
    }))
    .filter(invoiceLineShouldAppearInIssuedInvoice);
  const comparableCurrent = {
    buyer: current.buyer,
    payment_method_name: current.payment_method_name,
    items: current.items,
  };
  const comparableNext = {
    buyer: input.buyer,
    payment_method_name: input.payment_method_name,
    items: nextItems,
  };
  if (canonicalJson(comparableCurrent) === canonicalJson(comparableNext)) {
    const revisions = await invoiceDocumentRepository.listRevisions(
      id,
      input.warehouse_id,
    );
    return publicDocument(current, revisions ?? []);
  }
  const { storeConfig, account } = await loadInvoiceContext(input.warehouse_id);
  const validation = validationForEditedDraft(
    nextItems,
    input.payment_method_name,
    String(current.payment_time),
    input.buyer,
    storeConfig,
    account,
  );
  const editState = statusAfterInvoiceEdit(
    String(current.source_financial_fingerprint),
    nextItems,
  );
  const nextStatus = validation.issueEligible
    ? InvoiceDocumentStatus.READY_TO_ISSUE
    : validation.preparationStatus ===
        InvoicePreparationStatus.NEEDS_TAX_CONFIGURATION
      ? InvoiceDocumentStatus.NEEDS_TAX_CONFIGURATION
      : InvoiceDocumentStatus.NEEDS_CORRECTION;
  const now = new Date();
  const next = await invoiceDocumentRepository.updateDraft(
    id,
    input.warehouse_id,
    input.expected_revision,
    input.expected_source_payload_hash,
    {
      revision: input.expected_revision + 1,
      buyer: input.buyer,
      payment_method_name: input.payment_method_name,
      items: nextItems,
      calculation: validation.calculation,
      issue_eligible: validation.issueEligible,
      validation_issues: validation.issues,
      status: nextStatus,
      financially_edited: editState.financiallyEdited,
      ref_id: null,
      prepared_payload_hash: null,
      edited_by: actorId,
      edited_at: now,
      reviewed_by: null,
      reviewed_at: null,
      review_note: null,
      rejected_by: null,
      rejected_at: null,
      updated_by: actorId,
      updated_at: now,
    },
  );
  await logAudit({
    entity_type: "INVOICE_DOCUMENT",
    entity_id: id,
    warehouse_id: input.warehouse_id,
    action: AuditAction.UPDATE,
    user_id: actorId,
    old_value: {
      revision: current.revision,
      status: current.status,
      calculation_hash:
        (current.calculation as JsonRecord | null)?.calculation_hash ?? null,
    },
    new_value: {
      revision: next.revision,
      status: next.status,
      financially_edited: next.financially_edited,
      calculation_hash:
        (next.calculation as JsonRecord | null)?.calculation_hash ?? null,
    },
    notes: "Updated invoice draft revision",
    ...auditMetadata,
  });
  const revisions = await invoiceDocumentRepository.listRevisions(
    id,
    input.warehouse_id,
  );
  return publicDocument(next, revisions ?? []);
};
