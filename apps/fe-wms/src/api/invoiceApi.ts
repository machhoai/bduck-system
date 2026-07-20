import {
  InvoiceOrderSyncPurpose,
  type InvoiceDailyControlSummary,
  type InvoiceLedgerEntry,
  type InvoiceReconciliationCaseStatus,
  type InvoiceReconciliationCaseType,
  type InvoiceIssueJobCounts,
  type InvoiceIssueItemStatus,
  type InvoiceIssueJobStatus,
  type InvoiceDocument,
  type InvoiceDocumentRevisionSummary,
  type InvoiceDraftBuyer,
  type InvoiceSourceOrder,
  type InvoiceSourceOrderLine,
} from "@bduck/shared-types";
import { authenticatedFetch } from "@/utils/authenticatedFetch";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://api.wms.localhost";

interface ApiEnvelope<T> {
  success: boolean;
  data: T | null;
  messages?: { vi?: string; zh?: string };
}

export type InvoiceSourceOrderView = Omit<
  InvoiceSourceOrder,
  "source_action_time" | "source_sync_time" | "created_at" | "updated_at"
> & {
  source_action_time: string | null;
  source_sync_time: string;
  created_at: string;
  updated_at: string;
};

export interface InvoiceSyncResult {
  id: string;
  warehouse_id: string;
  business_date: string;
  purpose: InvoiceOrderSyncPurpose;
  order_count: number;
  inserted_count: number;
  updated_count: number;
  unchanged_count: number;
  draft_created_count: number;
  reconciliation: {
    id: string;
    warehouse_id: string;
    business_date: string;
    summary: InvoiceDailyControlSummary;
  } | null;
}

export type InvoiceLedgerEntryView = Omit<InvoiceLedgerEntry, "last_reconciled_at"> & {
  last_reconciled_at: string | null;
};

export interface InvoiceReconciliationCaseView {
  id: string;
  warehouse_id: string;
  business_date: string;
  type: InvoiceReconciliationCaseType;
  status: InvoiceReconciliationCaseStatus;
  source_order_document_id: string | null;
  invoice_document_id: string | null;
  misa_ref_id: string | null;
  misa_transaction_id: string | null;
  details: Record<string, unknown>;
  first_seen_at: string;
  last_seen_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
  resolution_note: string | null;
}

export interface InvoiceDownloadResult {
  transactionId: string;
  data: string;
  errorCode: string | null;
  isUrl: boolean;
  type: "Pdf" | "Xml";
}

export type InvoiceDocumentView = Omit<
  InvoiceDocument,
  | "source_action_time"
  | "edited_at"
  | "reviewed_at"
  | "rejected_at"
  | "created_at"
  | "updated_at"
> & {
  source_action_time: string | null;
  edited_at: string | null;
  reviewed_at: string | null;
  rejected_at: string | null;
  created_at: string;
  updated_at: string;
  revisions: Array<
    Omit<InvoiceDocumentRevisionSummary, "created_at"> & {
      created_at: string;
    }
  >;
};

export interface InvoiceDocumentUpdatePayload {
  warehouse_id: string;
  expected_revision: number;
  expected_source_payload_hash: string;
  buyer: InvoiceDraftBuyer;
  payment_method_name: string;
  items: InvoiceSourceOrderLine[];
}

export interface InvoicePreviewResult {
  url: string;
  expires_at: string;
  ref_id: string;
  prepared_payload_hash: string;
  source_payload_hash: string;
}

export interface InvoiceIssueJobItemView {
  id: string;
  invoice_document_id: string;
  source_order_id: string;
  ref_id: string;
  status: InvoiceIssueItemStatus;
  attempt_count: number;
  transaction_id: string | null;
  invoice_number: string | null;
  invoice_code: string | null;
  misa_error_code: string | null;
  last_error: string | null;
  next_attempt_at: string | null;
  updated_at: string;
}

export interface InvoiceIssueJobView {
  id: string;
  warehouse_id: string;
  status: InvoiceIssueJobStatus;
  counts: InvoiceIssueJobCounts;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  items: InvoiceIssueJobItemView[];
}

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const headers = new Headers(init?.headers);
  if (init?.body) headers.set("Content-Type", "application/json");
  const response = await authenticatedFetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
  });
  const envelope = (await response
    .json()
    .catch(() => null)) as ApiEnvelope<T> | null;
  if (!response.ok || !envelope?.success || envelope.data === null) {
    const language = document.documentElement.lang === "zh" ? "zh" : "vi";
    const message =
      envelope?.messages?.[language] ??
      envelope?.messages?.vi ??
      `HTTP ${response.status}`;
    throw new Error(message);
  }
  return envelope.data;
};

export const invoiceApi = {
  listSourceOrders: (warehouseId: string, businessDate: string) => {
    const query = new URLSearchParams({
      warehouse_id: warehouseId,
      business_date: businessDate,
    });
    return request<InvoiceSourceOrderView[]>(
      `/api/invoices/source-orders?${query.toString()}`,
    );
  },

  syncSourceOrders: (
    warehouseId: string,
    businessDate: string,
    purpose: InvoiceOrderSyncPurpose,
  ) =>
    request<InvoiceSyncResult>("/api/invoices/source-orders/sync", {
      method: "POST",
      body: JSON.stringify({
        warehouse_id: warehouseId,
        business_date: businessDate,
        purpose,
      }),
    }),

  previewSourceOrder: (
    id: string,
    warehouseId: string,
    expectedSourcePayloadHash: string,
  ) =>
    request<InvoicePreviewResult>(`/api/invoices/source-orders/${id}/preview`, {
      method: "POST",
      body: JSON.stringify({
        warehouse_id: warehouseId,
        expected_source_payload_hash: expectedSourcePayloadHash,
      }),
    }),

  prepareDocument: (
    sourceOrderDocumentId: string,
    warehouseId: string,
    expectedSourcePayloadHash: string,
  ) =>
    request<InvoiceDocumentView>(
      `/api/invoices/source-orders/${sourceOrderDocumentId}/prepare`,
      {
        method: "POST",
        body: JSON.stringify({
          warehouse_id: warehouseId,
          expected_source_payload_hash: expectedSourcePayloadHash,
        }),
      },
    ),

  getDocument: (id: string, warehouseId: string) => {
    const query = new URLSearchParams({ warehouse_id: warehouseId });
    return request<InvoiceDocumentView>(
      `/api/invoices/documents/${id}?${query.toString()}`,
    );
  },

  updateDocument: (id: string, payload: InvoiceDocumentUpdatePayload) =>
    request<InvoiceDocumentView>(`/api/invoices/documents/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),

  reviewDocument: (
    id: string,
    warehouseId: string,
    expectedRevision: number,
    action: "APPROVE" | "REJECT",
    note: string | null,
  ) =>
    request<InvoiceDocumentView>(`/api/invoices/documents/${id}/review`, {
      method: "POST",
      body: JSON.stringify({
        warehouse_id: warehouseId,
        expected_revision: expectedRevision,
        action,
        note,
      }),
    }),

  previewDocument: (
    id: string,
    warehouseId: string,
    expectedRevision: number,
    expectedSourcePayloadHash: string,
  ) =>
    request<InvoicePreviewResult>(`/api/invoices/documents/${id}/preview`, {
      method: "POST",
      body: JSON.stringify({
        warehouse_id: warehouseId,
        expected_revision: expectedRevision,
        expected_source_payload_hash: expectedSourcePayloadHash,
      }),
    }),

  createIssueJob: (
    warehouseId: string,
    invoiceDocumentIds: string[],
    idempotencyKey: string,
  ) =>
    request<InvoiceIssueJobView>("/api/invoices/issues", {
      method: "POST",
      body: JSON.stringify({
        warehouse_id: warehouseId,
        invoice_document_ids: invoiceDocumentIds,
        idempotency_key: idempotencyKey,
      }),
    }),

  getIssueJob: (jobId: string, warehouseId: string) => {
    const query = new URLSearchParams({ warehouse_id: warehouseId });
    return request<InvoiceIssueJobView>(
      `/api/invoices/issues/${jobId}?${query.toString()}`,
    );
  },

  listLedger: (warehouseId: string, businessDate: string) => {
    const query = new URLSearchParams({ warehouse_id: warehouseId, business_date: businessDate });
    return request<InvoiceLedgerEntryView[]>(`/api/invoices/ledger?${query.toString()}`);
  },

  listReconciliationCases: (warehouseId: string, businessDate: string) => {
    const query = new URLSearchParams({ warehouse_id: warehouseId, business_date: businessDate });
    return request<InvoiceReconciliationCaseView[]>(`/api/invoices/reconciliation-cases?${query.toString()}`);
  },

  resolveReconciliationCase: (id: string, warehouseId: string, note: string) =>
    request<InvoiceReconciliationCaseView>(`/api/invoices/reconciliation-cases/${id}/resolve`, {
      method: "POST",
      body: JSON.stringify({ warehouse_id: warehouseId, note }),
    }),

  viewPublishedInvoice: (id: string, warehouseId: string) => {
    const query = new URLSearchParams({ warehouse_id: warehouseId });
    return request<{ url: string; expires_in_seconds: number }>(`/api/invoices/ledger/${id}/view?${query.toString()}`);
  },

  downloadPublishedInvoice: (id: string, warehouseId: string, type: "Pdf" | "Xml") => {
    const query = new URLSearchParams({ warehouse_id: warehouseId, type });
    return request<InvoiceDownloadResult>(`/api/invoices/ledger/${id}/download?${query.toString()}`);
  },
};
