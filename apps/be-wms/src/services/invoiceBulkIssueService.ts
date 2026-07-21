import {
  AuditAction,
  type InvoiceBulkIssueExcludedOrder,
  type InvoiceBulkIssuePreview,
  type InvoiceBulkSelectionMode,
} from "@bduck/shared-types";
import type { AuthorizationService } from "./authorization/index.js";
import { invoiceBulkIssueRepository } from "../repositories/invoiceBulkIssueRepository.js";
import { invoiceDocumentRepository } from "../repositories/invoiceDocumentRepository.js";
import { invoiceOrderRepository } from "../repositories/invoiceOrderRepository.js";
import { meInvoiceConfigRepository } from "../repositories/meInvoiceConfigRepository.js";
import { logAudit, type AuditMetadata } from "./auditService.js";
import {
  bulkIssueRunId,
  bulkIssueSelectionFingerprint,
  chunkInvoiceIds,
  summarizeBulkIssue,
} from "./invoiceBulkIssuePolicy.js";
import { createInvoiceIssueJob } from "./invoiceIssueService.js";
import { validateInvoiceIssueCandidate } from "./invoiceIssuePolicy.js";
import { verifyMfa } from "./mfaService.js";
import { toPublicStoreConfig } from "./meInvoiceStoreConfigService.js";

interface BulkSelectionInput {
  warehouse_id: string;
  business_date: string;
  selection_mode: InvoiceBulkSelectionMode;
  source_order_ids: string[];
}

const serviceError = (statusCode: number, vi: string, zh: string, code: string, detail?: unknown) => ({
  statusCode,
  messages: { vi, zh },
  data: { code, ...(detail ? { detail } : {}) },
});

const serializeDate = (value: unknown) => {
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === "object" && "toDate" in value) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return value;
};

const serializeRun = (run: Record<string, unknown>) => ({
  ...run,
  action_time: serializeDate(run.action_time),
  sync_time: serializeDate(run.sync_time),
  created_at: serializeDate(run.created_at),
  updated_at: serializeDate(run.updated_at),
});

const loadReadyConfig = async (warehouseId: string) => {
  const stored = await meInvoiceConfigRepository.getStoreConfig(warehouseId);
  if (!stored || stored.is_deleted === true || stored.enabled !== true || !stored.validated_at || stored.validation_error_code) {
    throw serviceError(422, "Cấu hình meInvoice của cửa hàng chưa sẵn sàng.", "门店的 meInvoice 配置尚未就绪。", "STORE_CONFIG_NOT_READY");
  }
  const config = toPublicStoreConfig(stored);
  if (!config.go_live_at) {
    throw serviceError(422, "Chưa đặt thời điểm go-live nên đơn chưa thể phát hành.", "尚未设置启用时间，订单无法开票。", "GO_LIVE_NOT_SET");
  }
  return config;
};

const buildPreview = async (
  input: BulkSelectionInput,
  actorId: string,
): Promise<InvoiceBulkIssuePreview> => {
  const [orders, config] = await Promise.all([
    invoiceOrderRepository.listOrders(input.warehouse_id, input.business_date),
    loadReadyConfig(input.warehouse_id),
  ]);
  const selectedIds = new Set(input.source_order_ids);
  const selected = input.selection_mode === "ALL"
    ? orders
    : orders.filter((order) => selectedIds.has(String(order.id)));
  const foundIds = new Set(selected.map((order) => String(order.id)));
  const excluded: InvoiceBulkIssueExcludedOrder[] = input.selection_mode === "SELECTED"
    ? input.source_order_ids.filter((id) => !foundIds.has(id)).map((id) => ({
        source_order_document_id: id,
        source_order_id: id,
        order_number: null,
        issue_codes: ["SOURCE_ORDER_NOT_IN_SCOPE"],
      }))
    : [];

  const evaluated = await Promise.all(selected.map(async (order) => {
    const id = String(order.id);
    const document = await invoiceDocumentRepository.getDocument(id, input.warehouse_id);
    if (!document) {
      excluded.push({
        source_order_document_id: id,
        source_order_id: String(order.source_order_id),
        order_number: order.order_number ? String(order.order_number) : null,
        issue_codes: ["DOCUMENT_NOT_PREPARED"],
      });
      return null;
    }
    const issues = validateInvoiceIssueCandidate(document, order, config, actorId, {
      allowReviewBypass: true,
    });
    if (issues.length > 0) {
      excluded.push({
        source_order_document_id: id,
        source_order_id: String(order.source_order_id),
        order_number: order.order_number ? String(order.order_number) : null,
        issue_codes: issues.map((issue) => issue.code),
      });
      return null;
    }
    return document;
  }));
  const eligibleDocuments = evaluated.filter((value): value is Record<string, unknown> => Boolean(value));
  return {
    warehouse_id: input.warehouse_id,
    business_date: input.business_date,
    selection_mode: input.selection_mode,
    summary: summarizeBulkIssue(selected.length + excluded.filter((item) => item.issue_codes.includes("SOURCE_ORDER_NOT_IN_SCOPE")).length, eligibleDocuments, excluded),
    eligible_source_order_ids: eligibleDocuments.map((document) => String(document.id)),
    excluded,
  };
};

export const previewInvoiceBulkIssue = async (
  input: BulkSelectionInput,
  actorId: string,
  authorization: AuthorizationService,
) => {
  authorization.assert("invoices.bulk_issue", input.warehouse_id);
  return buildPreview(input, actorId);
};

export const createInvoiceBulkIssue = async (
  input: BulkSelectionInput & { otp: string; idempotency_key: string; action_time: Date },
  actorId: string,
  authorization: AuthorizationService,
  auditMetadata?: AuditMetadata,
) => {
  authorization.assert("invoices.bulk_issue", input.warehouse_id);
  const preview = await buildPreview(input, actorId);
  if (preview.eligible_source_order_ids.length === 0) {
    throw serviceError(422, "Không có hóa đơn đủ điều kiện để phát hành.", "没有符合开具条件的发票。", "NO_ELIGIBLE_INVOICES", preview.excluded);
  }
  const id = bulkIssueRunId(input.warehouse_id, actorId, input.idempotency_key);
  const fingerprint = bulkIssueSelectionFingerprint({
    warehouse_id: input.warehouse_id,
    business_date: input.business_date,
    selection_mode: input.selection_mode,
    selected_ids: input.selection_mode === "ALL" ? preview.eligible_source_order_ids : input.source_order_ids,
  });
  const existing = await invoiceBulkIssueRepository.getRun(id, input.warehouse_id);
  if (existing && existing.selection_fingerprint !== fingerprint) {
    throw serviceError(409, "Mã chống trùng đã được dùng cho một danh sách khác.", "防重复标识已用于其他发票列表。", "IDEMPOTENCY_KEY_REUSED");
  }
  if (existing?.status === "QUEUED") return serializeRun(existing);

  if (!existing) {
    const validOtp = await verifyMfa(actorId, input.otp);
    if (!validOtp) throw serviceError(401, "Mã OTP không đúng hoặc đã hết hạn.", "OTP 验证码错误或已过期。", "INVALID_OTP");
  }
  const now = new Date();
  const creation = await invoiceBulkIssueRepository.createRun(id, {
    ...preview,
    selection_fingerprint: fingerprint,
    requested_by: actorId,
    status: "CREATING",
    job_ids: [],
    action_time: input.action_time,
    sync_time: now,
    created_at: now,
    updated_at: now,
  });
  if (!creation.created && creation.run.selection_fingerprint !== fingerprint) {
    throw serviceError(409, "Mã chống trùng đã được dùng cho một danh sách khác.", "防重复标识已用于其他发票列表。", "IDEMPOTENCY_KEY_REUSED");
  }

  const jobIds: string[] = [];
  const chunks = chunkInvoiceIds(preview.eligible_source_order_ids);
  try {
    for (let index = 0; index < chunks.length; index += 1) {
      const job = await createInvoiceIssueJob({
        warehouse_id: input.warehouse_id,
        invoice_document_ids: chunks[index]!,
        idempotency_key: `${input.idempotency_key}:chunk:${index}`,
      }, actorId, authorization, auditMetadata, {
        permission: "invoices.bulk_issue",
        allowReviewBypass: true,
        bulkRunId: id,
      });
      jobIds.push(String((job as Record<string, unknown>).id));
    }
    await invoiceBulkIssueRepository.updateRun(id, {
      status: "QUEUED",
      job_ids: jobIds,
      updated_at: new Date(),
    });
  } catch (error) {
    await invoiceBulkIssueRepository.updateRun(id, {
      status: "FAILED",
      job_ids: jobIds,
      updated_at: new Date(),
    });
    throw error;
  }
  await logAudit({
    entity_type: "INVOICE_BULK_ISSUE_RUN",
    entity_id: id,
    warehouse_id: input.warehouse_id,
    action: AuditAction.CREATE,
    user_id: actorId,
    old_value: null,
    new_value: {
      business_date: input.business_date,
      selection_mode: input.selection_mode,
      summary: preview.summary,
      job_ids: jobIds,
      review_bypassed: true,
      action_time: input.action_time,
      sync_time: now,
    },
    notes: "Bulk MISA meInvoice issue run created with OTP",
    ...auditMetadata,
  });
  const run = await invoiceBulkIssueRepository.getRun(id, input.warehouse_id);
  return serializeRun(run!);
};
