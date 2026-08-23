import { randomUUID } from "node:crypto";

import {
  AuditAction,
  InvoiceDocumentStatus,
  InvoiceIssueItemStatus,
} from "@bduck/shared-types";

import { invoiceDocumentRepository } from "../repositories/invoiceDocumentRepository.js";
import { invoiceIssueRepository } from "../repositories/invoiceIssueRepository.js";
import { invoiceOrderRepository } from "../repositories/invoiceOrderRepository.js";
import { meInvoiceConfigRepository } from "../repositories/meInvoiceConfigRepository.js";

import { logAudit, type AuditMetadata } from "./auditService.js";
import type { AuthorizationService } from "./authorization/index.js";
import { bulkIssueConfigFingerprint } from "./invoiceBulkIssuePolicy.js";
import {
  classifyInvoiceIssueFailure,
  findInvoiceRetryDuplicate,
  issueJobId,
  sameInvoiceDocumentSet,
  statusIsIssued,
  validateInvoiceIssueCandidate,
} from "./invoiceIssuePolicy.js";
import { fetchMisaInvoicesForDate } from "./invoiceReconciliationService.js";
import { dispatchInvoiceIssueItem } from "./invoiceTaskDispatcher.js";
import {
  MeInvoiceApiError,
  type MeInvoiceStatusResult,
} from "./meInvoiceClient.js";
import { executeWithMeInvoiceClient } from "./meInvoiceConnectionService.js";
import { buildMeInvoicePayload } from "./meInvoicePayloadBuilder.js";
import { toPublicStoreConfig } from "./meInvoiceStoreConfigService.js";
import { verifyMfa } from "./mfaService.js";

const MAX_ATTEMPTS = 8;
const PENDING_MAX_ATTEMPTS = 20;

const serviceError = (
  statusCode: number,
  vi: string,
  code: string,
  data?: unknown,
) => ({
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

const serializeJob = (
  value: Record<string, unknown> & { items?: Record<string, unknown>[] },
) => ({
  ...value,
  created_at: toDate(value.created_at),
  updated_at: toDate(value.updated_at),
  completed_at: toDate(value.completed_at),
  items:
    value.items?.map((item) => ({
      ...item,
      next_attempt_at: toDate(item.next_attempt_at),
      created_at: toDate(item.created_at),
      updated_at: toDate(item.updated_at),
      completed_at: toDate(item.completed_at),
    })) ?? [],
});

const misaStatusHasIssueTrace = (status: MeInvoiceStatusResult | undefined) =>
  Boolean(
    status &&
    (status.isDeleted ||
      statusIsIssued(status.publishStatus, status.isDeleted) ||
      status.transactionId ||
      status.invoiceCode),
  );

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
    bulkRunId?: string;
    expectedConfigFingerprint?: string;
  } = {},
) => {
  authorization.assert(
    options.permission ?? "invoices.issue",
    input.warehouse_id,
  );
  const documentIds = [...new Set(input.invoice_document_ids)];
  if (documentIds.length !== input.invoice_document_ids.length) {
    throw serviceError(
      400,
      "Danh sách draft có phần tử trùng.",
      "DUPLICATE_DOCUMENT_ID",
    );
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
    return serializeJob(
      existing as Record<string, unknown> & {
        items: Record<string, unknown>[];
      },
    );
  }
  requireIssueEnabled();
  const storedConfig = await meInvoiceConfigRepository.getStoreConfig(
    input.warehouse_id,
  );
  if (
    !storedConfig ||
    storedConfig.is_deleted === true ||
    storedConfig.enabled !== true ||
    !storedConfig.validated_at ||
    storedConfig.validation_error_code
  ) {
    throw serviceError(
      422,
      "Cấu hình meInvoice của cửa hàng chưa sẵn sàng.",
      "STORE_CONFIG_NOT_READY",
    );
  }
  const config = toPublicStoreConfig(storedConfig);
  if (
    options.expectedConfigFingerprint &&
    bulkIssueConfigFingerprint(config) !== options.expectedConfigFingerprint
  ) {
    throw serviceError(
      409,
      "Cấu hình tên sản phẩm hoặc đơn vị đã thay đổi. Vui lòng xem trước lại.",
      "BULK_DISPLAY_CONFIG_CHANGED",
    );
  }
  if (!config.go_live_at) {
    throw serviceError(
      422,
      "Chưa cấu hình thời điểm go-live nên hệ thống không cho phép phát hành.",
      "GO_LIVE_NOT_CONFIGURED",
    );
  }
  const account = await meInvoiceConfigRepository.getAccount(
    config.meinvoice_account_id,
  );
  if (!account || account.is_deleted || !account.enabled) {
    throw serviceError(
      422,
      "Tài khoản meInvoice chưa sẵn sàng.",
      "MEINVOICE_ACCOUNT_NOT_READY",
    );
  }

  const prepared = await Promise.all(
    documentIds.map(async (documentId) => {
      const [document, sourceOrder] = await Promise.all([
        invoiceDocumentRepository.getDocument(documentId, input.warehouse_id),
        invoiceOrderRepository.getOrder(documentId, input.warehouse_id),
      ]);
      if (!document || !sourceOrder) {
        throw serviceError(
          404,
          "Không tìm thấy draft hoặc đơn hàng nguồn.",
          "INVOICE_DOCUMENT_NOT_FOUND",
          { document_id: documentId },
        );
      }
      const issues = validateInvoiceIssueCandidate(
        document,
        sourceOrder,
        config,
        actorId,
      );
      if (issues.length) {
        throw serviceError(
          422,
          "Draft chưa đủ điều kiện phát hành.",
          "INVOICE_NOT_ISSUE_ELIGIBLE",
          { document_id: documentId, issues },
        );
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
    }),
  );
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
    bulkRunId: options.bulkRunId,
  });
  if (result.created) {
    await Promise.all(
      prepared.map((item) =>
        dispatchInvoiceIssueItem({
          jobId: id,
          itemId: item.documentId,
          attempt: 0,
        }),
      ),
    );
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
      },
      notes: "MISA meInvoice issue job created",
      ...auditMetadata,
    });
  }
  const job = await invoiceIssueRepository.getJob(id, input.warehouse_id);
  return serializeJob(
    job as Record<string, unknown> & { items: Record<string, unknown>[] },
  );
};

export const getInvoiceIssueJob = async (
  jobId: string,
  warehouseId: string,
  authorization: AuthorizationService,
) => {
  authorization.assert("invoices.read", warehouseId);
  const job = await invoiceIssueRepository.getJob(jobId, warehouseId);
  if (!job)
    throw serviceError(
      404,
      "Không tìm thấy job phát hành.",
      "INVOICE_ISSUE_JOB_NOT_FOUND",
    );
  return serializeJob(
    job as Record<string, unknown> & { items: Record<string, unknown>[] },
  );
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
  retryEligible?: boolean;
  clearManualRetryRequest?: boolean;
}) => {
  const max =
    input.status === InvoiceIssueItemStatus.PENDING_CONFIRMATION
      ? PENDING_MAX_ATTEMPTS
      : MAX_ATTEMPTS;
  const exhausted = input.retryAfterMs !== null && input.attempt >= max;
  const status = exhausted
    ? InvoiceIssueItemStatus.MANUAL_RECONCILIATION
    : input.status;
  const nextAttemptAt =
    !exhausted && input.retryAfterMs !== null
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
    lastError: exhausted
      ? "Retry limit reached; manual reconciliation required."
      : input.lastError,
    retryEligible: !exhausted && input.retryEligible === true,
    clearManualRetryRequest:
      input.clearManualRetryRequest ||
      (exhausted && input.status !== InvoiceIssueItemStatus.ISSUED),
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

export const processInvoiceIssueItem = async (
  jobId: string,
  itemId: string,
) => {
  const owner = `worker:${randomUUID()}`;
  const claimed = await invoiceIssueRepository.claimItem(jobId, itemId, owner);
  if (!claimed) return { processed: false, reason: "TERMINAL_OR_MISSING" };
  if (claimed.notDue) {
    return {
      processed: false,
      reason: "NOT_DUE",
      retry_at: claimed.nextAttemptAt,
    };
  }
  if (claimed.busy) return { processed: false, reason: "LANE_BUSY" };
  const attempt = Number(claimed.item.attempt_count ?? 0);
  const previousStatus = claimed.previousStatus;
  if (
    process.env.MEINVOICE_ISSUE_ENABLED !== "true" &&
    previousStatus !== InvoiceIssueItemStatus.PENDING_CONFIRMATION
  ) {
    return finalizeAndSchedule({
      jobId,
      itemId,
      owner,
      status: InvoiceIssueItemStatus.RETRYABLE_ERROR,
      attempt,
      retryAfterMs: 60_000,
      errorCode: "MEINVOICE_ISSUE_DISABLED",
      lastError: "Issue feature flag is disabled.",
    });
  }

  const manualRetryRequested = Boolean(claimed.item.manual_retry_requested_at);
  let manualRetryPublishStarted = false;
  try {
    if (
      previousStatus === InvoiceIssueItemStatus.PENDING_CONFIRMATION ||
      manualRetryRequested
    ) {
      const statuses = await executeWithMeInvoiceClient(
        claimed.job.meinvoice_account_id,
        (client, token) =>
          client.getInvoiceStatuses(token, {
            refIds: [String(claimed.item.ref_id)],
            invoiceWithCode: claimed.job.invoice_with_code === true,
            invoiceCalculatingMachine:
              claimed.job.invoice_calculating_machine === true,
          }),
      );
      const status = statuses[0];
      if (status && statusIsIssued(status.publishStatus, status.isDeleted)) {
        return finalizeAndSchedule({
          jobId,
          itemId,
          owner,
          status: InvoiceIssueItemStatus.ISSUED,
          attempt,
          retryAfterMs: null,
          transactionId: status.transactionId,
          invoiceCode: status.invoiceCode,
          clearManualRetryRequest: manualRetryRequested,
        });
      }
      if (status?.isDeleted) {
        return finalizeAndSchedule({
          jobId,
          itemId,
          owner,
          status: InvoiceIssueItemStatus.MANUAL_RECONCILIATION,
          attempt,
          retryAfterMs: null,
          transactionId: status.transactionId,
          errorCode: "MISA_INVOICE_DELETED",
          lastError: "MISA reports that the invoice was deleted.",
          clearManualRetryRequest: manualRetryRequested,
        });
      }
      if (manualRetryRequested) {
        if (
          misaStatusHasIssueTrace(status) ||
          claimed.item.manual_retry_allow_publish !== true
        ) {
          return finalizeAndSchedule({
            jobId,
            itemId,
            owner,
            status: InvoiceIssueItemStatus.MANUAL_RECONCILIATION,
            attempt,
            retryAfterMs: null,
            transactionId: status?.transactionId ?? null,
            invoiceCode: status?.invoiceCode ?? null,
            errorCode: "MISA_DUPLICATE_CHECK_BLOCKED",
            lastError:
              "MISA has an invoice trace or matching business information; republish was blocked.",
            clearManualRetryRequest: true,
          });
        }
      } else {
        return finalizeAndSchedule({
          jobId,
          itemId,
          owner,
          status: InvoiceIssueItemStatus.PENDING_CONFIRMATION,
          attempt,
          retryAfterMs: Math.min(
            15 * 60_000,
            30_000 * 2 ** Math.min(attempt, 5),
          ),
          transactionId: status?.transactionId ?? null,
          invoiceCode: status?.invoiceCode ?? null,
        });
      }
    }

    manualRetryPublishStarted = manualRetryRequested;
    const results = await executeWithMeInvoiceClient(
      claimed.job.meinvoice_account_id,
      (client, token) =>
        client.publishInvoices(
          token,
          Number(
            manualRetryRequested
              ? (claimed.item.manual_retry_sign_type ?? claimed.job.sign_type)
              : claimed.job.sign_type,
          ),
          [claimed.payload],
        ),
    );
    const result = results[0]!;
    if (result.errorCode) {
      const decision = classifyInvoiceIssueFailure(result.errorCode, attempt);
      return finalizeAndSchedule({
        jobId,
        itemId,
        owner,
        status: decision.status,
        attempt,
        retryAfterMs: decision.retryAfterMs,
        transactionId: result.transactionId,
        invoiceNumber: result.invoiceNumber,
        invoiceCode: result.invoiceCode,
        errorCode: result.errorCode,
        lastError: `MISA item error: ${result.errorCode}`,
        retryEligible:
          !result.transactionId && !result.invoiceNumber && !result.invoiceCode,
        clearManualRetryRequest: manualRetryRequested,
      });
    }
    return finalizeAndSchedule({
      jobId,
      itemId,
      owner,
      status: InvoiceIssueItemStatus.PENDING_CONFIRMATION,
      attempt,
      retryAfterMs: 15_000,
      transactionId: result.transactionId,
      invoiceNumber: result.invoiceNumber,
      invoiceCode: result.invoiceCode,
      clearManualRetryRequest: manualRetryRequested,
    });
  } catch (error) {
    const decision = classifyInvoiceIssueFailure(error, attempt);
    return finalizeAndSchedule({
      jobId,
      itemId,
      owner,
      status: decision.status,
      attempt,
      retryAfterMs: decision.retryAfterMs,
      errorCode:
        error instanceof MeInvoiceApiError ? error.code : "UNKNOWN_ERROR",
      lastError: error instanceof Error ? error.message : String(error),
      clearManualRetryRequest: manualRetryPublishStarted,
    });
  }
};

const STUCK_DOCUMENT_STATUSES = new Set<InvoiceDocumentStatus>([
  InvoiceDocumentStatus.PENDING_CONFIRMATION,
  InvoiceDocumentStatus.RETRYABLE_ERROR,
  InvoiceDocumentStatus.MANUAL_RECONCILIATION,
]);
const USER_RETRY_MINIMUM_AGE_MS = 10 * 60_000;

const issueItemIsStuck = (item: Record<string, unknown>) => {
  if (item.status === InvoiceIssueItemStatus.MANUAL_RECONCILIATION) return true;
  if (Number(item.attempt_count ?? 0) >= 3) return true;
  const createdAt = toDate(item.created_at);
  return Boolean(
    createdAt &&
    Date.now() - new Date(createdAt).getTime() >= USER_RETRY_MINIMUM_AGE_MS,
  );
};

const loadInvoiceIssueRetryCandidates = async (input: {
  warehouse_id: string;
  business_date: string;
}) => {
  const orders = await invoiceOrderRepository.listOrders(
    input.warehouse_id,
    input.business_date,
  );
  const stuckOrderIds = orders
    .filter((order) =>
      STUCK_DOCUMENT_STATUSES.has(
        order.invoice_document_status as InvoiceDocumentStatus,
      ),
    )
    .map((order) => String(order.id));
  if (stuckOrderIds.length === 0) return [];
  const orderById = new Map(orders.map((order) => [String(order.id), order]));
  const candidates = await invoiceIssueRepository.listRetryCandidates(
    stuckOrderIds,
    input.warehouse_id,
  );
  return candidates
    .map(({ job, item }) => {
      const issueItem = item as Record<string, unknown>;
      const order = orderById.get(String(issueItem.invoice_document_id));
      if (!order) return null;
      return {
        job: job as Record<string, unknown>,
        item: issueItem,
        order,
      };
    })
    .filter((value): value is NonNullable<typeof value> => Boolean(value))
    .filter(({ item }) => issueItemIsStuck(item));
};

export const listInvoiceIssueRetryCandidates = async (
  input: { warehouse_id: string; business_date: string },
  authorization: AuthorizationService,
) => {
  authorization.assert("invoices.retry", input.warehouse_id);
  const candidates = await loadInvoiceIssueRetryCandidates(input);
  return candidates.map(({ job, item, order }) => ({
    job_id: String(job.id),
    item_id: String(item.id),
    invoice_document_id: String(item.invoice_document_id),
    order_number:
      typeof order.order_number === "string" ? order.order_number : null,
    status: String(item.status),
    misa_error_code:
      typeof item.misa_error_code === "string" ? item.misa_error_code : null,
    message:
      item.status === InvoiceIssueItemStatus.PENDING_CONFIRMATION
        ? "Hóa đơn đang chờ MISA xác nhận và có thể kiểm tra, gửi lại an toàn."
        : item.status === InvoiceIssueItemStatus.RETRYABLE_ERROR
          ? "Hóa đơn gặp lỗi tạm thời và có thể kiểm tra, gửi lại an toàn."
          : "Hóa đơn đang cần xử lý thủ công và có thể kiểm tra, gửi lại an toàn.",
  }));
};

const chunksOf = <T>(values: T[], size: number): T[][] => {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
};

const buyerTaxCode = (order: Record<string, unknown>): string | null => {
  const buyer =
    order.buyer &&
    typeof order.buyer === "object" &&
    !Array.isArray(order.buyer)
      ? (order.buyer as Record<string, unknown>)
      : null;
  return typeof buyer?.tax_code === "string" && buyer.tax_code.trim()
    ? buyer.tax_code.trim()
    : null;
};

const buyerName = (order: Record<string, unknown>): string | null => {
  const buyer =
    order.buyer &&
    typeof order.buyer === "object" &&
    !Array.isArray(order.buyer)
      ? (order.buyer as Record<string, unknown>)
      : null;
  const value = buyer?.legal_name ?? buyer?.full_name;
  return typeof value === "string" && value.trim() ? value.trim() : null;
};

export const retryRejectedInvoiceIssueItems = async (
  input: {
    warehouse_id: string;
    business_date: string;
    otp: string;
  },
  actorId: string,
  authorization: AuthorizationService,
  auditMetadata?: AuditMetadata,
) => {
  authorization.assert("invoices.retry", input.warehouse_id);
  requireIssueEnabled();
  if (!(await verifyMfa(actorId, input.otp))) {
    throw serviceError(
      401,
      "Mã OTP không đúng hoặc đã hết hạn.",
      "INVALID_OTP",
    );
  }

  const storedConfig = await meInvoiceConfigRepository.getStoreConfig(
    input.warehouse_id,
  );
  if (
    !storedConfig ||
    storedConfig.is_deleted === true ||
    storedConfig.enabled !== true ||
    !storedConfig.validated_at ||
    storedConfig.validation_error_code
  ) {
    throw serviceError(
      422,
      "Hãy lưu và xác minh lại cấu hình MISA trước khi thử lại.",
      "STORE_CONFIG_NOT_READY",
    );
  }
  const config = toPublicStoreConfig(storedConfig);
  const candidates = await loadInvoiceIssueRetryCandidates(input);
  if (candidates.length === 0) {
    return {
      retried_count: 0,
      already_on_misa_count: 0,
      duplicate_blocked_count: 0,
      skipped_count: 0,
      retried_items: [],
      blocked_items: [],
    };
  }
  if (
    candidates.some(
      ({ job }) =>
        job.meinvoice_account_id !== config.meinvoice_account_id ||
        job.inv_series !== config.inv_series ||
        job.invoice_with_code !== config.invoice_with_code,
    )
  ) {
    throw serviceError(
      409,
      "Tài khoản, ký hiệu hoặc loại hóa đơn đã thay đổi. Không thể dùng lại RefID cũ.",
      "INVOICE_RETRY_CONFIG_IDENTITY_CHANGED",
    );
  }

  // Both checks must complete successfully. A 429, timeout or 5xx throws here,
  // before any item is scheduled, so an unavailable MISA is never interpreted
  // as “invoice not found”.
  const misaInvoices = await fetchMisaInvoicesForDate(
    config.meinvoice_account_id,
    config.invoice_with_code,
    input.business_date,
    [config.inv_series],
  );
  const statusesByCandidate = new Map<string, MeInvoiceStatusResult>();
  const statusGroups = new Map<string, typeof candidates>();
  for (const candidate of candidates) {
    const key = `${candidate.job.invoice_with_code === true}:${candidate.job.invoice_calculating_machine === true}`;
    statusGroups.set(key, [...(statusGroups.get(key) ?? []), candidate]);
  }
  for (const group of statusGroups.values()) {
    for (const batch of chunksOf(group, 30)) {
      const statuses = await executeWithMeInvoiceClient(
        config.meinvoice_account_id,
        (client, token) =>
          client.getInvoiceStatuses(token, {
            refIds: batch.map(({ item }) => String(item.ref_id)),
            invoiceWithCode: batch[0]!.job.invoice_with_code === true,
            invoiceCalculatingMachine:
              batch[0]!.job.invoice_calculating_machine === true,
          }),
      );
      const byRefId = new Map(
        statuses
          .filter((status) => status.refId)
          .map((status) => [status.refId!, status]),
      );
      batch.forEach((candidate, index) => {
        const status =
          byRefId.get(String(candidate.item.ref_id)) ??
          (statuses.length === batch.length ? statuses[index] : undefined);
        if (status) {
          statusesByCandidate.set(
            `${candidate.job.id}:${candidate.item.id}`,
            status,
          );
        }
      });
    }
  }

  const scheduled: Array<{
    candidate: (typeof candidates)[number];
    allowPublish: boolean;
  }> = [];
  const blockedItems: Array<{
    job_id: string;
    item_id: string;
    order_number: string | null;
    reason: string;
  }> = [];
  let alreadyOnMisaCount = 0;
  for (const candidate of candidates) {
    const { job, item, order } = candidate;
    const duplicate = findInvoiceRetryDuplicate(
      {
        refId: String(item.ref_id),
        sourceOrderId: String(order.source_order_id ?? item.source_order_id),
        orderNumber:
          typeof order.order_number === "string" ? order.order_number : null,
        invSeries: String(job.inv_series),
        businessDate: input.business_date,
        totalAmount:
          typeof order.real_money === "number" ? order.real_money : null,
        buyerTaxCode: buyerTaxCode(order),
        buyerName: buyerName(order),
        sellerShopCode: config.seller_shop_code,
      },
      misaInvoices,
    );
    const status = statusesByCandidate.get(`${job.id}:${item.id}`);
    if (duplicate && duplicate.reason !== "REF_ID") {
      blockedItems.push({
        job_id: String(job.id),
        item_id: String(item.id),
        order_number:
          typeof order.order_number === "string" ? order.order_number : null,
        reason: duplicate.reason,
      });
      continue;
    }
    const allowPublish = !duplicate && !misaStatusHasIssueTrace(status);
    if (!allowPublish) alreadyOnMisaCount += 1;
    scheduled.push({ candidate, allowPublish });
  }

  const duplicateBlockedCount = blockedItems.length;
  const requestId = randomUUID();
  const grouped = new Map<string, typeof scheduled>();
  for (const value of scheduled) {
    const jobId = String(value.candidate.job.id);
    grouped.set(jobId, [...(grouped.get(jobId) ?? []), value]);
  }
  const scheduledItems: Array<{ job_id: string; item_id: string }> = [];
  let retriedCount = 0;
  for (const [jobId, group] of grouped) {
    let result: Awaited<
      ReturnType<typeof invoiceIssueRepository.requestVerifiedRetryItems>
    >;
    try {
      result = await invoiceIssueRepository.requestVerifiedRetryItems({
        jobId,
        warehouseId: input.warehouse_id,
        actorId,
        requestId,
        signType: config.sign_type,
        items: group.map(({ candidate, allowPublish }) => ({
          itemId: String(candidate.item.id),
          allowPublish,
        })),
      });
    } catch (error) {
      if ((error as { statusCode?: number }).statusCode !== 409) throw error;
      group.forEach(({ candidate }) => {
        blockedItems.push({
          job_id: jobId,
          item_id: String(candidate.item.id),
          order_number:
            typeof candidate.order.order_number === "string"
              ? candidate.order.order_number
              : null,
          reason: "STATE_CHANGED",
        });
      });
      continue;
    }
    await Promise.all(
      result.scheduled.map(async (item) => {
        await dispatchInvoiceIssueItem({
          jobId,
          itemId: item.itemId,
          attempt: item.attempt,
          deduplicationKey: `manual-${requestId}`,
        });
        scheduledItems.push({ job_id: jobId, item_id: item.itemId });
        if (item.allowPublish) retriedCount += 1;
      }),
    );
  }

  await logAudit({
    entity_type: "INVOICE_ISSUE_RETRY",
    entity_id: `retry:${requestId}`,
    warehouse_id: input.warehouse_id,
    action: AuditAction.UPDATE,
    user_id: actorId,
    old_value: null,
    new_value: {
      business_date: input.business_date,
      candidate_count: candidates.length,
      retried_count: retriedCount,
      already_on_misa_count: alreadyOnMisaCount,
      duplicate_blocked_count: duplicateBlockedCount,
      skipped_count: blockedItems.length - duplicateBlockedCount,
      scheduled_items: scheduledItems,
      blocked_items: blockedItems,
      sign_type: config.sign_type,
    },
    notes:
      "User requested bulk retry after RefID and business duplicate verification",
    ...auditMetadata,
  });
  return {
    retried_count: retriedCount,
    already_on_misa_count: alreadyOnMisaCount,
    duplicate_blocked_count: duplicateBlockedCount,
    skipped_count: blockedItems.length - duplicateBlockedCount,
    retried_items: scheduledItems,
    blocked_items: blockedItems,
  };
};

export const sweepInvoiceIssueItems = async () => {
  const recoverable = await invoiceIssueRepository.listRecoverable(30);
  if (recoverable.length === 0) return { recovered: 0, mode: "EMPTY" };
  const sweepDeduplicationKey = `sweep-${Math.floor(Date.now() / 60_000)}`;
  const results = [];
  for (const item of recoverable) {
    const dispatched = await dispatchInvoiceIssueItem({
      ...item,
      deduplicationKey: sweepDeduplicationKey,
    });
    if (dispatched.mode === "SCHEDULER_FALLBACK") {
      results.push(await processInvoiceIssueItem(item.jobId, item.itemId));
    } else {
      results.push(dispatched);
    }
  }
  return { recovered: results.length, results };
};
