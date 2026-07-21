import { randomUUID } from "node:crypto";
import {
  AuditAction,
  InvoiceIssueItemStatus,
} from "@bduck/shared-types";
import type { AuthorizationService } from "./authorization/index.js";
import { invoiceDocumentRepository } from "../repositories/invoiceDocumentRepository.js";
import { invoiceOrderRepository } from "../repositories/invoiceOrderRepository.js";
import { invoiceIssueRepository } from "../repositories/invoiceIssueRepository.js";
import { meInvoiceConfigRepository } from "../repositories/meInvoiceConfigRepository.js";
import { buildMeInvoicePayload } from "./meInvoicePayloadBuilder.js";
import { toPublicStoreConfig } from "./meInvoiceStoreConfigService.js";
import { executeWithMeInvoiceClient } from "./meInvoiceConnectionService.js";
import { MeInvoiceApiError } from "./meInvoiceClient.js";
import {
  classifyInvoiceIssueFailure,
  issueJobId,
  sameInvoiceDocumentSet,
  statusIsIssued,
  validateInvoiceIssueCandidate,
} from "./invoiceIssuePolicy.js";
import { dispatchInvoiceIssueItem } from "./invoiceTaskDispatcher.js";
import { logAudit, type AuditMetadata } from "./auditService.js";

const MAX_ATTEMPTS = 8;
const PENDING_MAX_ATTEMPTS = 20;

const serviceError = (statusCode: number, vi: string, code: string, data?: unknown) => ({
  statusCode,
  messages: { vi, zh: vi },
  data: { code, ...(data ? { detail: data } : {}) },
});

const requireIssueEnabled = () => {
  if (process.env.MEINVOICE_ISSUE_ENABLED !== "true") {
    throw serviceError(
      503,
      "Tính năng phát hành thật đang được khóa. Chỉ bật sau khi hoàn tất UAT và xác định thời điểm go-live.",
      "MEINVOICE_ISSUE_DISABLED",
    );
  }
};

const toDate = (value: unknown): string | null => {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object" && "toDate" in value) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return typeof value === "string" ? value : null;
};

const serializeJob = (value: Record<string, unknown> & { items?: Record<string, unknown>[] }) => ({
  ...value,
  created_at: toDate(value.created_at),
  updated_at: toDate(value.updated_at),
  completed_at: toDate(value.completed_at),
  items: value.items?.map((item) => ({
    ...item,
    next_attempt_at: toDate(item.next_attempt_at),
    created_at: toDate(item.created_at),
    updated_at: toDate(item.updated_at),
    completed_at: toDate(item.completed_at),
  })) ?? [],
});

export const createInvoiceIssueJob = async (
  input: {
    warehouse_id: string;
    invoice_document_ids: string[];
    idempotency_key: string;
  },
  actorId: string,
  authorization: AuthorizationService,
  auditMetadata?: AuditMetadata,
  options: {
    permission?: "invoices.issue" | "invoices.bulk_issue";
    allowReviewBypass?: boolean;
    bulkRunId?: string;
  } = {},
) => {
  authorization.assert(options.permission ?? "invoices.issue", input.warehouse_id);
  const documentIds = [...new Set(input.invoice_document_ids)];
  if (documentIds.length !== input.invoice_document_ids.length) {
    throw serviceError(400, "Danh sách draft có phần tử trùng.", "DUPLICATE_DOCUMENT_ID");
  }
  const id = issueJobId(input.warehouse_id, actorId, input.idempotency_key);
  const existing = await invoiceIssueRepository.getJob(id, input.warehouse_id);
  if (existing) {
    const existingIds = (existing.items as Record<string, unknown>[])
      .map((item) => String(item.invoice_document_id))
      .sort();
    const requestedIds = [...documentIds].sort();
    if (!sameInvoiceDocumentSet(existingIds, requestedIds)) {
      throw serviceError(
        409,
        "Idempotency key đã được dùng cho một danh sách hóa đơn khác.",
        "IDEMPOTENCY_KEY_REUSED",
      );
    }
    return serializeJob(existing as Record<string, unknown> & { items: Record<string, unknown>[] });
  }
  requireIssueEnabled();
  const storedConfig = await meInvoiceConfigRepository.getStoreConfig(input.warehouse_id);
  if (
    !storedConfig || storedConfig.is_deleted === true || storedConfig.enabled !== true ||
    !storedConfig.validated_at || storedConfig.validation_error_code
  ) {
    throw serviceError(422, "Cấu hình meInvoice của cửa hàng chưa sẵn sàng.", "STORE_CONFIG_NOT_READY");
  }
  const config = toPublicStoreConfig(storedConfig);
  if (!config.go_live_at) {
    throw serviceError(422, "Chưa cấu hình thời điểm go-live nên hệ thống không cho phép phát hành.", "GO_LIVE_NOT_CONFIGURED");
  }
  const account = await meInvoiceConfigRepository.getAccount(config.meinvoice_account_id);
  if (!account || account.is_deleted || !account.enabled) {
    throw serviceError(422, "Tài khoản meInvoice chưa sẵn sàng.", "MEINVOICE_ACCOUNT_NOT_READY");
  }

  const prepared = await Promise.all(documentIds.map(async (documentId) => {
    const [document, sourceOrder] = await Promise.all([
      invoiceDocumentRepository.getDocument(documentId, input.warehouse_id),
      invoiceOrderRepository.getOrder(documentId, input.warehouse_id),
    ]);
    if (!document || !sourceOrder) {
      throw serviceError(404, "Không tìm thấy draft hoặc đơn hàng nguồn.", "INVOICE_DOCUMENT_NOT_FOUND", { document_id: documentId });
    }
    const issues = validateInvoiceIssueCandidate(
      document,
      sourceOrder,
      config,
      actorId,
      { allowReviewBypass: options.allowReviewBypass },
    );
    if (issues.length) {
      throw serviceError(422, "Draft chưa đủ điều kiện phát hành.", "INVOICE_NOT_ISSUE_ELIGIBLE", { document_id: documentId, issues });
    }
    const built = buildMeInvoicePayload(document, config, account);
    return {
      documentId,
      sourceOrderId: String(document.source_order_id),
      sourcePayloadHash: String(document.source_payload_hash),
      revision: Number(document.revision),
      refId: built.ref_id,
      payloadHash: built.prepared_payload_hash,
      payload: built.payload,
    };
  }));
  const result = await invoiceIssueRepository.createJob({
    jobId: id,
    warehouseId: input.warehouse_id,
    accountId: config.meinvoice_account_id,
    invSeries: config.inv_series,
    signType: config.sign_type,
    invoiceWithCode: config.invoice_with_code,
    invoiceCalculatingMachine: config.is_invoice_calculating_machine,
    idempotencyKey: input.idempotency_key,
    actorId,
    items: prepared,
    allowReviewBypass: options.allowReviewBypass,
    bulkRunId: options.bulkRunId,
  });
  if (result.created) {
    await Promise.all(prepared.map((item) => dispatchInvoiceIssueItem({
      jobId: id,
      itemId: item.documentId,
      attempt: 0,
    })));
    await logAudit({
      entity_type: "INVOICE_ISSUE_JOB",
      entity_id: id,
      warehouse_id: input.warehouse_id,
      action: AuditAction.CREATE,
      user_id: actorId,
      old_value: null,
      new_value: {
        invoice_document_ids: documentIds,
        item_count: documentIds.length,
        inv_series: config.inv_series,
        meinvoice_account_id: config.meinvoice_account_id,
        bulk_run_id: options.bulkRunId ?? null,
        review_bypassed: options.allowReviewBypass === true,
      },
      notes: "MISA meInvoice issue job created",
      ...auditMetadata,
    });
  }
  const job = await invoiceIssueRepository.getJob(id, input.warehouse_id);
  return serializeJob(job as Record<string, unknown> & { items: Record<string, unknown>[] });
};

export const getInvoiceIssueJob = async (
  jobId: string,
  warehouseId: string,
  authorization: AuthorizationService,
) => {
  authorization.assert("invoices.read", warehouseId);
  const job = await invoiceIssueRepository.getJob(jobId, warehouseId);
  if (!job) throw serviceError(404, "Không tìm thấy job phát hành.", "INVOICE_ISSUE_JOB_NOT_FOUND");
  return serializeJob(job as Record<string, unknown> & { items: Record<string, unknown>[] });
};

const finalizeAndSchedule = async (input: {
  jobId: string;
  itemId: string;
  owner: string;
  status: InvoiceIssueItemStatus;
  attempt: number;
  retryAfterMs: number | null;
  transactionId?: string | null;
  invoiceNumber?: string | null;
  invoiceCode?: string | null;
  errorCode?: string | null;
  lastError?: string | null;
}) => {
  const max = input.status === InvoiceIssueItemStatus.PENDING_CONFIRMATION
    ? PENDING_MAX_ATTEMPTS
    : MAX_ATTEMPTS;
  const exhausted = input.retryAfterMs !== null && input.attempt >= max;
  const status = exhausted ? InvoiceIssueItemStatus.MANUAL_RECONCILIATION : input.status;
  const nextAttemptAt = !exhausted && input.retryAfterMs !== null
    ? new Date(Date.now() + input.retryAfterMs)
    : null;
  const completion = await invoiceIssueRepository.completeItem({
    jobId: input.jobId,
    itemId: input.itemId,
    owner: input.owner,
    status,
    nextAttemptAt,
    transactionId: input.transactionId,
    invoiceNumber: input.invoiceNumber,
    invoiceCode: input.invoiceCode,
    errorCode: input.errorCode,
    lastError: exhausted ? "Retry limit reached; manual reconciliation required." : input.lastError,
  });
  if (completion?.applied && nextAttemptAt) {
    await dispatchInvoiceIssueItem({
      jobId: input.jobId,
      itemId: input.itemId,
      attempt: input.attempt + 1,
      scheduleAt: nextAttemptAt,
    });
  }
  return { processed: true as const, status, next_attempt_at: nextAttemptAt };
};

export const processInvoiceIssueItem = async (jobId: string, itemId: string) => {
  const owner = `worker:${randomUUID()}`;
  const claimed = await invoiceIssueRepository.claimItem(jobId, itemId, owner);
  if (!claimed) return { processed: false, reason: "NOT_DUE_OR_TERMINAL" };
  if (claimed.busy) return { processed: false, reason: "LANE_BUSY" };
  const attempt = Number(claimed.item.attempt_count ?? 0);
  const previousStatus = claimed.previousStatus;
  if (process.env.MEINVOICE_ISSUE_ENABLED !== "true" && previousStatus !== InvoiceIssueItemStatus.PENDING_CONFIRMATION) {
    return finalizeAndSchedule({
      jobId, itemId, owner,
      status: InvoiceIssueItemStatus.RETRYABLE_ERROR,
      attempt,
      retryAfterMs: 60_000,
      errorCode: "MEINVOICE_ISSUE_DISABLED",
      lastError: "Issue feature flag is disabled.",
    });
  }

  try {
    if (previousStatus === InvoiceIssueItemStatus.PENDING_CONFIRMATION) {
      const statuses = await executeWithMeInvoiceClient(claimed.job.meinvoice_account_id, (client, token) =>
        client.getInvoiceStatuses(token, {
          refIds: [String(claimed.item.ref_id)],
          invoiceWithCode: claimed.job.invoice_with_code === true,
          invoiceCalculatingMachine: claimed.job.invoice_calculating_machine === true,
        }),
      );
      const status = statuses[0];
      if (status && statusIsIssued(status.publishStatus, status.isDeleted)) {
        return finalizeAndSchedule({
          jobId, itemId, owner, status: InvoiceIssueItemStatus.ISSUED,
          attempt, retryAfterMs: null,
          transactionId: status.transactionId,
          invoiceCode: status.invoiceCode,
        });
      }
      if (status?.isDeleted) {
        return finalizeAndSchedule({
          jobId, itemId, owner, status: InvoiceIssueItemStatus.MANUAL_RECONCILIATION,
          attempt, retryAfterMs: null,
          transactionId: status.transactionId,
          errorCode: "MISA_INVOICE_DELETED",
          lastError: "MISA reports that the invoice was deleted.",
        });
      }
      return finalizeAndSchedule({
        jobId, itemId, owner, status: InvoiceIssueItemStatus.PENDING_CONFIRMATION,
        attempt, retryAfterMs: Math.min(15 * 60_000, 30_000 * 2 ** Math.min(attempt, 5)),
        transactionId: status?.transactionId ?? null,
        invoiceCode: status?.invoiceCode ?? null,
      });
    }

    const results = await executeWithMeInvoiceClient(claimed.job.meinvoice_account_id, (client, token) =>
      client.publishInvoices(token, Number(claimed.job.sign_type), [claimed.payload]),
    );
    const result = results[0]!;
    if (result.errorCode) {
      const decision = classifyInvoiceIssueFailure(result.errorCode, attempt);
      return finalizeAndSchedule({
        jobId, itemId, owner, status: decision.status, attempt,
        retryAfterMs: decision.retryAfterMs,
        transactionId: result.transactionId,
        invoiceNumber: result.invoiceNumber,
        invoiceCode: result.invoiceCode,
        errorCode: result.errorCode,
        lastError: `MISA item error: ${result.errorCode}`,
      });
    }
    return finalizeAndSchedule({
      jobId, itemId, owner,
      status: InvoiceIssueItemStatus.PENDING_CONFIRMATION,
      attempt,
      retryAfterMs: 15_000,
      transactionId: result.transactionId,
      invoiceNumber: result.invoiceNumber,
      invoiceCode: result.invoiceCode,
    });
  } catch (error) {
    const decision = classifyInvoiceIssueFailure(error, attempt);
    return finalizeAndSchedule({
      jobId, itemId, owner, status: decision.status, attempt,
      retryAfterMs: decision.retryAfterMs,
      errorCode: error instanceof MeInvoiceApiError ? error.code : "UNKNOWN_ERROR",
      lastError: error instanceof Error ? error.message : String(error),
    });
  }
};

export const sweepInvoiceIssueItems = async () => {
  const recoverable = await invoiceIssueRepository.listRecoverable(30);
  if (recoverable.length === 0) return { recovered: 0, mode: "EMPTY" };
  const results = [];
  for (const item of recoverable) {
    const dispatched = await dispatchInvoiceIssueItem(item);
    if (dispatched.mode === "SCHEDULER_FALLBACK") {
      results.push(await processInvoiceIssueItem(item.jobId, item.itemId));
    } else {
      results.push(dispatched);
    }
  }
  return { recovered: results.length, results };
};
