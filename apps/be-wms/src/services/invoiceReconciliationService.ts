import {
  AuditAction,
  InvoiceReconciliationCaseType,
} from "@bduck/shared-types";

import { invoiceReconciliationRepository } from "../repositories/invoiceReconciliationRepository.js";
import { meInvoiceConfigRepository } from "../repositories/meInvoiceConfigRepository.js";

import { logAudit, type AuditMetadata } from "./auditService.js";
import type { AuthorizationService } from "./authorization/index.js";
import {
  dateFromInvoiceValue,
  invoiceIssueBusinessDate,
  invoiceIssueDeadline,
  invoiceIssueDeadlineExpired,
} from "./invoiceIssueDeadline.js";
import {
  normalizeMisaInvoice,
  invoiceStatusMonitoringDecision,
  reconcileDailyInvoices,
  sourceOrderIsInvoiceEligible,
  taxStatusIsRejected,
  type NormalizedMisaInvoice,
} from "./invoiceReconciliationPolicy.js";
import { planInvoiceStatusBatches } from "./invoiceStatusBatching.js";
import type {
  MeInvoiceDownloadType,
  MeInvoiceStatusResult,
} from "./meInvoiceClient.js";
import { executeWithMeInvoiceClient } from "./meInvoiceConnectionService.js";
import { toPublicStoreConfig } from "./meInvoiceStoreConfigService.js";

const PAGE_SIZE = 100;
const MAX_PAGES = 1_000;
const MAX_DOWNLOAD_CHARACTERS = 28 * 1024 * 1024;
const MISA_INVOICE_LIST_CACHE_MS = 60_000;
const misaInvoiceListCache = new Map<
  string,
  { expiresAt: number; invoices: NormalizedMisaInvoice[] }
>();
const misaInvoiceListFlights = new Map<
  string,
  Promise<NormalizedMisaInvoice[]>
>();

const serviceError = (statusCode: number, vi: string, code: string) => ({
  statusCode,
  messages: { vi, zh: vi },
  data: { code },
});

const requireStoreConfig = async (warehouseId: string) => {
  const stored = await meInvoiceConfigRepository.getStoreConfig(warehouseId);
  if (!stored || stored.is_deleted === true || stored.enabled !== true) {
    throw serviceError(
      422,
      "Cấu hình meInvoice của cửa hàng chưa sẵn sàng.",
      "STORE_CONFIG_NOT_READY",
    );
  }
  return toPublicStoreConfig(stored);
};

export const fetchMisaInvoicesForDate = async (
  accountId: string,
  invoiceWithCode: boolean,
  businessDate: string,
  invSeries?: string[],
  options: { forceRefresh?: boolean; cacheTtlMs?: number } = {},
): Promise<NormalizedMisaInvoice[]> => {
  const key = [
    accountId,
    String(invoiceWithCode),
    businessDate,
    [...(invSeries ?? [])].sort().join(","),
  ].join(":");
  const cached = misaInvoiceListCache.get(key);
  if (
    !options.forceRefresh &&
    cached &&
    cached.expiresAt > Date.now()
  ) {
    return cached.invoices;
  }
  const existing = misaInvoiceListFlights.get(key);
  if (existing) return existing;

  const flight = executeWithMeInvoiceClient(accountId, async (client, token) => {
    const result: NormalizedMisaInvoice[] = [];
    for (let page = 0; page < MAX_PAGES; page += 1) {
      const response = await client.pageInvoices(token, invoiceWithCode, {
        fromDate: businessDate,
        toDate: businessDate,
        skip: page * PAGE_SIZE,
        take: PAGE_SIZE,
        ...(invSeries ? { invSeries } : {}),
      });
      result.push(...response.items.map(normalizeMisaInvoice));
      if (response.items.length < PAGE_SIZE || result.length >= response.total)
        return result;
    }
    throw new Error("MEINVOICE_PAGING_LIMIT_EXCEEDED");
  })
    .then((invoices) => {
      const cacheTtlMs = Math.max(
        0,
        options.cacheTtlMs ?? MISA_INVOICE_LIST_CACHE_MS,
      );
      if (cacheTtlMs > 0) {
        misaInvoiceListCache.set(key, {
          expiresAt: Date.now() + cacheTtlMs,
          invoices,
        });
      }
      return invoices;
    })
    .finally(() => {
      misaInvoiceListFlights.delete(key);
    });
  misaInvoiceListFlights.set(key, flight);
  return flight;
};

const toIso = (value: unknown): string | null => {
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === "object" && "toDate" in value) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return typeof value === "string" ? value : null;
};

const serializeDates = <T extends Record<string, unknown>>(value: T) => ({
  ...value,
  last_reconciled_at: toIso(value.last_reconciled_at),
  first_seen_at: toIso(value.first_seen_at),
  last_seen_at: toIso(value.last_seen_at),
  resolved_at: toIso(value.resolved_at),
  created_at: toIso(value.created_at),
  updated_at: toIso(value.updated_at),
});

export const reconcileInvoiceDay = async (
  warehouseId: string,
  businessDate: string,
  actorId: string,
  authorization: AuthorizationService,
  auditMetadata?: AuditMetadata,
) => {
  authorization.assert("invoices.reconcile", warehouseId);
  const config = await requireStoreConfig(warehouseId);
  const runId = await invoiceReconciliationRepository.createRun({
    warehouseId,
    businessDate,
    actorId,
  });
  try {
    const [{ sources, documents }, misaInvoices] = await Promise.all([
      invoiceReconciliationRepository.loadDailyData(warehouseId, businessDate),
      fetchMisaInvoicesForDate(
        config.meinvoice_account_id,
        config.invoice_with_code,
        businessDate,
      ),
    ]);
    const eligibleSources = sources.filter(sourceOrderIsInvoiceEligible);
    const result = reconcileDailyInvoices({
      sources: eligibleSources.map((source) => ({
        id: String(source.id),
        source_order_id: String(source.source_order_id),
        order_number:
          typeof source.order_number === "string" ? source.order_number : null,
        real_money:
          typeof source.real_money === "number" ? source.real_money : null,
        invoice_document_id:
          typeof source.invoice_document_id === "string"
            ? source.invoice_document_id
            : null,
      })),
      documents: documents.map((document) => ({
        id: String(document.id),
        ref_id: typeof document.ref_id === "string" ? document.ref_id : null,
        transaction_id:
          typeof document.transaction_id === "string"
            ? document.transaction_id
            : null,
      })),
      misaInvoices,
      sellerShopCode: config.seller_shop_code,
      invSeries: config.inv_series,
      invoiceWithCode: config.invoice_with_code,
    });
    await invoiceReconciliationRepository.persistDailyResult({
      runId,
      warehouseId,
      businessDate,
      accountId: config.meinvoice_account_id,
      invSeries: config.inv_series,
      matches: result.matches,
      caseCandidates: result.cases,
      misaInvoices,
      summary: result.summary,
    });
    await logAudit({
      entity_type: "INVOICE_RECONCILIATION_RUN",
      entity_id: runId,
      warehouse_id: warehouseId,
      action: AuditAction.CREATE,
      user_id: actorId,
      old_value: null,
      new_value: { business_date: businessDate, summary: result.summary },
      notes: "Daily JoyWorld/MISA invoice reconciliation",
      ...auditMetadata,
    });
    return {
      id: runId,
      warehouse_id: warehouseId,
      business_date: businessDate,
      summary: result.summary,
    };
  } catch (error) {
    await invoiceReconciliationRepository.failRun(
      runId,
      error instanceof Error ? error.message : "UNKNOWN_RECONCILIATION_ERROR",
    );
    throw error;
  }
};

export const listInvoiceLedger = async (
  warehouseId: string,
  businessDate: string,
  authorization: AuthorizationService,
) => {
  authorization.assert("invoices.read", warehouseId);
  const values = await invoiceReconciliationRepository.listLedger(
    warehouseId,
    businessDate,
  );
  return values.map((value) => ({
    ...value,
    last_reconciled_at: toIso(value.last_reconciled_at),
  }));
};

export const listInvoiceReconciliationCases = async (
  warehouseId: string,
  businessDate: string,
  authorization: AuthorizationService,
) => {
  authorization.assert("invoices.read", warehouseId);
  const values = await invoiceReconciliationRepository.listCases(
    warehouseId,
    businessDate,
  );
  return values.map((value) => serializeDates(value));
};

export const listMisaInvoices = async (
  warehouseId: string,
  businessDate: string,
  authorization: AuthorizationService,
) => {
  authorization.assert("invoices.read", warehouseId);
  const result = await invoiceReconciliationRepository.listLatestMisaInvoices(
    warehouseId,
    businessDate,
  );
  return {
    run_id: result.runId,
    warehouse_id: warehouseId,
    business_date: businessDate,
    fetched_at: toIso(result.fetchedAt),
    invoices: result.invoices.map((invoice) => ({
      ...invoice,
      created_at: toIso(invoice.created_at),
    })),
  };
};

export const resolveInvoiceReconciliationCase = async (
  id: string,
  warehouseId: string,
  note: string,
  actorId: string,
  authorization: AuthorizationService,
  auditMetadata?: AuditMetadata,
) => {
  authorization.assert("invoices.reconcile", warehouseId);
  const result = await invoiceReconciliationRepository.resolveCase(
    id,
    warehouseId,
    actorId,
    note,
  );
  if (!result)
    throw serviceError(
      404,
      "Không tìm thấy case đối chiếu.",
      "RECONCILIATION_CASE_NOT_FOUND",
    );
  await logAudit({
    entity_type: "INVOICE_RECONCILIATION_CASE",
    entity_id: id,
    warehouse_id: warehouseId,
    action: AuditAction.UPDATE,
    user_id: actorId,
    old_value: null,
    new_value: { status: "RESOLVED", resolution_note: note },
    notes: "Resolve invoice reconciliation case",
    ...auditMetadata,
  });
  return serializeDates(result);
};

const loadDownloadContext = async (sourceId: string, warehouseId: string) => {
  const [source, config] = await Promise.all([
    invoiceReconciliationRepository.getLedgerSource(sourceId, warehouseId),
    requireStoreConfig(warehouseId),
  ]);
  if (!source)
    throw serviceError(
      404,
      "Không tìm thấy hóa đơn trong phạm vi cửa hàng.",
      "INVOICE_LEDGER_NOT_FOUND",
    );
  const transactionId =
    typeof source.misa_transaction_id === "string"
      ? source.misa_transaction_id
      : typeof source.transaction_id === "string"
        ? source.transaction_id
        : null;
  if (!transactionId)
    throw serviceError(
      422,
      "Hóa đơn chưa có TransactionID từ MISA.",
      "MISA_TRANSACTION_ID_MISSING",
    );
  return { transactionId, config };
};

export const viewPublishedInvoice = async (
  sourceId: string,
  warehouseId: string,
  authorization: AuthorizationService,
) => {
  authorization.assert("invoices.download", warehouseId);
  const { transactionId, config } = await loadDownloadContext(
    sourceId,
    warehouseId,
  );
  const url = await executeWithMeInvoiceClient(
    config.meinvoice_account_id,
    (client, token) => client.viewPublishedInvoice(token, transactionId),
  );
  return { url, expires_in_seconds: 300 };
};

export const downloadPublishedInvoice = async (
  sourceId: string,
  warehouseId: string,
  type: MeInvoiceDownloadType,
  authorization: AuthorizationService,
) => {
  authorization.assert("invoices.download", warehouseId);
  const { transactionId, config } = await loadDownloadContext(
    sourceId,
    warehouseId,
  );
  const result = await executeWithMeInvoiceClient(
    config.meinvoice_account_id,
    (client, token) =>
      client.downloadInvoice(token, {
        transactionId,
        invoiceWithCode: config.invoice_with_code,
        invoiceCalculatingMachine: config.is_invoice_calculating_machine,
        type,
      }),
  );
  if (result.errorCode)
    throw serviceError(
      502,
      "MISA không thể tạo tệp tải xuống.",
      result.errorCode,
    );
  if (result.data.length > MAX_DOWNLOAD_CHARACTERS) {
    throw serviceError(
      502,
      "Tệp hóa đơn vượt quá giới hạn tải xuống.",
      "INVOICE_DOWNLOAD_TOO_LARGE",
    );
  }
  if (!result.isUrl) {
    let header = result.data.trimStart().slice(0, 20);
    if (!header.startsWith("<") && !header.startsWith("%PDF")) {
      try {
        header = Buffer.from(result.data.replace(/\s/g, ""), "base64")
          .subarray(0, 20)
          .toString("utf8")
          .trimStart();
      } catch {
        throw serviceError(
          502,
          "Nội dung tệp hóa đơn từ MISA không hợp lệ.",
          "INVALID_INVOICE_DOWNLOAD_CONTENT",
        );
      }
    }
    const valid =
      type === "Pdf" ? header.startsWith("%PDF") : header.startsWith("<");
    if (!valid)
      throw serviceError(
        502,
        "Nội dung tệp hóa đơn từ MISA không đúng định dạng.",
        "INVALID_INVOICE_DOWNLOAD_CONTENT",
      );
  }
  return { ...result, type };
};

export const sweepIssuedInvoiceStatuses = async (limit = 100) => {
  const documents = await invoiceReconciliationRepository.listIssuedDocuments(
    Math.min(Math.max(limit, 1), 200),
  );
  const configFlights = new Map<
    string,
    ReturnType<typeof requireStoreConfig>
  >();
  const loadConfig = (warehouseId: string) => {
    const existing = configFlights.get(warehouseId);
    if (existing) return existing;
    const flight = requireStoreConfig(warehouseId);
    configFlights.set(warehouseId, flight);
    return flight;
  };
  const candidates = (
    await Promise.all(
      documents.map(async (document) => {
        const warehouseId = String(document.warehouse_id ?? "");
        const documentId = String(document.id ?? "");
        const sourceId = String(
          document.source_order_document_id ?? documentId,
        );
        const refId =
          typeof document.ref_id === "string" ? document.ref_id : null;
        if (!warehouseId || !documentId || !refId) return null;
        const config = await loadConfig(warehouseId);
        return {
          account_id: config.meinvoice_account_id,
          invoice_with_code: config.invoice_with_code,
          invoice_calculating_machine: config.is_invoice_calculating_machine,
          ref_id: refId,
          context: {
            document,
            warehouseId,
            documentId,
            sourceId,
            config,
          },
        };
      }),
    )
  ).filter((candidate): candidate is NonNullable<typeof candidate> =>
    Boolean(candidate),
  );
  const statusByDocumentId = new Map<string, MeInvoiceStatusResult>();
  for (const batch of planInvoiceStatusBatches(candidates)) {
    const statuses = await executeWithMeInvoiceClient(
      batch.account_id,
      (client, token) =>
        client.getInvoiceStatuses(token, {
          refIds: batch.items.map((item) => item.ref_id),
          invoiceWithCode: batch.invoice_with_code,
          invoiceCalculatingMachine: batch.invoice_calculating_machine,
        }),
    );
    const byRefId = new Map(
      statuses
        .filter((status) => status.refId)
        .map((status) => [status.refId!, status]),
    );
    batch.items.forEach((item, index) => {
      const status = byRefId.get(item.ref_id) ?? statuses[index];
      if (status) statusByDocumentId.set(item.context.documentId, status);
    });
  }
  let checked = 0;
  let casesOpened = 0;
  for (const candidate of candidates) {
    const { document, warehouseId, documentId, sourceId, config } =
      candidate.context;
    const refId = candidate.ref_id;
    const status = statusByDocumentId.get(documentId);
    if (!status) continue;
    const now = new Date();
    const checkedCount = Number(document.status_check_count ?? 0) + 1;
    let issueDeadlineAt = dateFromInvoiceValue(document.issue_deadline_at);
    if (!issueDeadlineAt) {
      try {
        issueDeadlineAt = invoiceIssueDeadline(
          invoiceIssueBusinessDate(
            document.business_date,
            document.payment_time,
          ),
        );
      } catch {
        issueDeadlineAt = null;
      }
    }
    const monitoring = invoiceStatusMonitoringDecision({
      publishStatus: status.publishStatus,
      sendTaxStatus: status.sendTaxStatus,
      isDeleted: status.isDeleted,
      checkedCount,
      deadlineExpired: issueDeadlineAt
        ? invoiceIssueDeadlineExpired(issueDeadlineAt, now)
        : false,
    });
    const nextStatusCheckAt =
      monitoring.nextCheckAfterMs === null
        ? null
        : new Date(now.getTime() + monitoring.nextCheckAfterMs);
    await invoiceReconciliationRepository.updateStatus(documentId, sourceId, {
      misa_publish_status: status.publishStatus,
      misa_send_tax_status: status.sendTaxStatus,
      misa_invoice_code: status.invoiceCode ?? null,
      misa_is_deleted: status.isDeleted,
      last_status_checked_at: now,
      status_check_count: checkedCount,
      status_monitoring_complete: monitoring.complete,
      next_status_check_at: nextStatusCheckAt,
      updated_at: now,
    });
    const caseType = status.isDeleted
      ? InvoiceReconciliationCaseType.MISA_INVOICE_DELETED
      : taxStatusIsRejected(status.sendTaxStatus, config.invoice_with_code)
        ? InvoiceReconciliationCaseType.TAX_REJECTED
        : status.publishStatus !== 1
          ? InvoiceReconciliationCaseType.STATUS_MISMATCH
          : null;
    if (caseType) {
      const businessDate =
        typeof document.payment_time === "string"
          ? document.payment_time.slice(0, 10)
          : new Date().toISOString().slice(0, 10);
      const runId = await invoiceReconciliationRepository.createRun({
        warehouseId,
        businessDate,
        actorId: "SYSTEM_STATUS_SWEEP",
      });
      await invoiceReconciliationRepository.persistDailyResult({
        runId,
        warehouseId,
        businessDate,
        accountId: config.meinvoice_account_id,
        invSeries: config.inv_series,
        matches: [],
        misaInvoices: [],
        caseCandidates: [
          {
            type: caseType,
            source_order_document_id: sourceId,
            invoice_document_id: documentId,
            misa_ref_id: refId,
            misa_transaction_id: status.transactionId,
            details: {
              publish_status: status.publishStatus,
              send_tax_status: status.sendTaxStatus,
            },
          },
        ],
        summary: {
          source_order_count: 0,
          misa_invoice_count: 0,
          matched_count: 0,
          source_not_in_misa_count: 0,
          misa_not_in_source_count: 0,
          mismatch_count: 1,
          unscoped_misa_count: 0,
          source_total_amount: 0,
          misa_total_amount: 0,
        },
        autoResolveUnseen: false,
      });
      casesOpened += 1;
    }
    checked += 1;
  }
  return { checked, cases_opened: casesOpened };
};
