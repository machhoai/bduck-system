import { createHash, randomUUID } from "node:crypto";
import {
  InvoiceReconciliationCaseStatus,
  type InvoiceDailyControlSummary,
} from "@bduck/shared-types";
import { db } from "../config/firebase.js";
import type {
  DailyReconciliationCaseCandidate,
  DailyReconciliationMatch,
  NormalizedMisaInvoice,
} from "../services/invoiceReconciliationPolicy.js";

const sourceOrders = db.collection("invoice_source_orders");
const documents = db.collection("invoice_documents");
const runs = db.collection("invoice_reconciliation_runs");
const cases = db.collection("invoice_reconciliation_cases");
const snapshots = db.collection("invoice_reconciliation_snapshots");
const WRITE_CHUNK_SIZE = 140;

const caseId = (input: {
  warehouseId: string;
  businessDate: string;
  candidate: DailyReconciliationCaseCandidate;
}) => createHash("sha256").update(JSON.stringify([
  input.warehouseId,
  input.businessDate,
  input.candidate.type,
  input.candidate.source_order_document_id,
  input.candidate.invoice_document_id,
  input.candidate.misa_transaction_id,
  input.candidate.misa_ref_id,
])).digest("hex");

const chunks = <T>(values: T[]) => {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += WRITE_CHUNK_SIZE) {
    result.push(values.slice(index, index + WRITE_CHUNK_SIZE));
  }
  return result;
};

export const invoiceReconciliationRepository = {
  async createRun(input: {
    warehouseId: string;
    businessDate: string;
    actorId: string;
  }) {
    const id = randomUUID();
    const now = new Date();
    await runs.doc(id).create({
      id,
      warehouse_id: input.warehouseId,
      business_date: input.businessDate,
      status: "RUNNING",
      requested_by: input.actorId,
      summary: null,
      error_code: null,
      started_at: now,
      completed_at: null,
      created_at: now,
      updated_at: now,
    });
    return id;
  },

  async failRun(id: string, errorCode: string) {
    await runs.doc(id).set({
      status: "FAILED",
      error_code: errorCode.slice(0, 160),
      completed_at: new Date(),
      updated_at: new Date(),
    }, { merge: true });
  },

  async loadDailyData(warehouseId: string, businessDate: string) {
    const sourceSnapshot = await sourceOrders
      .where("warehouse_id", "==", warehouseId)
      .where("business_date", "==", businessDate)
      .where("is_deleted", "==", false)
      .get();
    const sources = sourceSnapshot.docs.map((item) => item.data());
    const documentIds = [...new Set(sources
      .map((item) => typeof item.invoice_document_id === "string" ? item.invoice_document_id : null)
      .filter((item): item is string => Boolean(item)))];
    const documentSnapshots = documentIds.length
      ? await db.getAll(...documentIds.map((id) => documents.doc(id)))
      : [];
    return {
      sources,
      documents: documentSnapshots.filter((item) => item.exists).map((item) => item.data()!),
    };
  },

  async persistDailyResult(input: {
    runId: string;
    warehouseId: string;
    businessDate: string;
    accountId: string;
    invSeries: string;
    matches: DailyReconciliationMatch[];
    caseCandidates: DailyReconciliationCaseCandidate[];
    misaInvoices: NormalizedMisaInvoice[];
    summary: InvoiceDailyControlSummary;
    autoResolveUnseen?: boolean;
  }) {
    const now = new Date();
    const activeCaseIds = new Set(input.caseCandidates.map((candidate) => caseId({
      warehouseId: input.warehouseId,
      businessDate: input.businessDate,
      candidate,
    })));
    const previousCases = await cases
      .where("warehouse_id", "==", input.warehouseId)
      .where("business_date", "==", input.businessDate)
      .get();

    const operations: Array<(batch: FirebaseFirestore.WriteBatch) => void> = [];
    for (const match of input.matches) {
      const misa = match.misa;
      const reconciliationFields = {
        match_status: match.match_status,
        misa_ref_id: misa?.ref_id ?? null,
        misa_transaction_id: misa?.transaction_id ?? null,
        misa_inv_series: misa?.inv_series ?? null,
        misa_invoice_number: misa?.invoice_number ?? null,
        misa_invoice_date: misa?.invoice_date ?? null,
        misa_invoice_code: misa?.invoice_code ?? null,
        misa_publish_status: misa?.publish_status ?? null,
        misa_send_tax_status: misa?.send_tax_status ?? null,
        misa_total_amount: misa?.total_amount ?? null,
        reconciliation_mismatch_fields: match.mismatch_fields,
        reconciliation_run_id: input.runId,
        last_reconciled_at: now,
        updated_at: now,
      };
      operations.push((batch) => batch.set(sourceOrders.doc(match.source.id), reconciliationFields, { merge: true }));
      const matchedDocument = match.document;
      if (matchedDocument) {
        operations.push((batch) => batch.set(documents.doc(matchedDocument.id), reconciliationFields, { merge: true }));
      }
    }
    for (const candidate of input.caseCandidates) {
      const id = caseId({ warehouseId: input.warehouseId, businessDate: input.businessDate, candidate });
      const existing = previousCases.docs.find((item) => item.id === id)?.data();
      operations.push((batch) => batch.set(cases.doc(id), {
        id,
        warehouse_id: input.warehouseId,
        business_date: input.businessDate,
        type: candidate.type,
        status: InvoiceReconciliationCaseStatus.OPEN,
        source_order_document_id: candidate.source_order_document_id,
        invoice_document_id: candidate.invoice_document_id,
        misa_ref_id: candidate.misa_ref_id,
        misa_transaction_id: candidate.misa_transaction_id,
        details: candidate.details,
        first_seen_at: existing?.first_seen_at ?? now,
        last_seen_at: now,
        last_run_id: input.runId,
        resolved_at: null,
        resolved_by: null,
        resolution_note: null,
        updated_at: now,
        created_at: existing?.created_at ?? now,
      }, { merge: true }));
    }
    for (const previous of input.autoResolveUnseen === false ? [] : previousCases.docs) {
      if (previous.data().status === InvoiceReconciliationCaseStatus.OPEN && !activeCaseIds.has(previous.id)) {
        operations.push((batch) => batch.set(previous.ref, {
          status: InvoiceReconciliationCaseStatus.RESOLVED,
          resolved_at: now,
          resolved_by: "SYSTEM",
          resolution_note: "Không còn xuất hiện trong lần đối chiếu mới nhất.",
          updated_at: now,
        }, { merge: true }));
      }
    }
    input.misaInvoices.forEach((invoice, index) => {
      operations.push((batch) => batch.set(snapshots.doc(`${input.runId}_${String(index).padStart(6, "0")}`), {
        id: `${input.runId}_${String(index).padStart(6, "0")}`,
        run_id: input.runId,
        warehouse_id: input.warehouseId,
        business_date: input.businessDate,
        ...invoice,
        created_at: now,
      }));
    });
    for (const group of chunks(operations)) {
      const batch = db.batch();
      group.forEach((operation) => operation(batch));
      await batch.commit();
    }
    await runs.doc(input.runId).set({
      status: "COMPLETED",
      account_id: input.accountId,
      inv_series: input.invSeries,
      summary: input.summary,
      completed_at: now,
      updated_at: now,
    }, { merge: true });
  },

  async listLedger(warehouseId: string, businessDate: string) {
    const { sources } = await this.loadDailyData(warehouseId, businessDate);
    const caseSnapshot = await cases
      .where("warehouse_id", "==", warehouseId)
      .where("business_date", "==", businessDate)
      .get();
    const openCounts = new Map<string, number>();
    for (const item of caseSnapshot.docs.map((entry) => entry.data())) {
      if (item.status !== InvoiceReconciliationCaseStatus.OPEN) continue;
      const sourceId = typeof item.source_order_document_id === "string" ? item.source_order_document_id : null;
      if (sourceId) openCounts.set(sourceId, (openCounts.get(sourceId) ?? 0) + 1);
    }
    return sources.map((source) => ({
      id: source.id,
      warehouse_id: source.warehouse_id,
      business_date: source.business_date,
      source_order_id: source.source_order_id,
      order_number: source.order_number ?? null,
      customer_name: source.customer_name ?? null,
      invoice_document_status: source.invoice_document_status ?? null,
      match_status: source.match_status ?? "NOT_CHECKED",
      ref_id: source.misa_ref_id ?? null,
      transaction_id: source.misa_transaction_id ?? null,
      inv_series: source.misa_inv_series ?? null,
      invoice_number: source.misa_invoice_number ?? null,
      invoice_code: source.misa_invoice_code ?? null,
      invoice_date: source.misa_invoice_date ?? null,
      publish_status: source.misa_publish_status ?? null,
      send_tax_status: source.misa_send_tax_status ?? null,
      total_amount: source.misa_total_amount ?? source.real_money ?? null,
      last_reconciled_at: source.last_reconciled_at ?? null,
      reconciliation_case_count: openCounts.get(String(source.id)) ?? 0,
    }));
  },

  async getLedgerSource(id: string, warehouseId: string) {
    const snapshot = await sourceOrders.doc(id).get();
    const value = snapshot.exists ? snapshot.data()! : null;
    return value && value.warehouse_id === warehouseId && value.is_deleted !== true ? value : null;
  },

  async listCases(warehouseId: string, businessDate: string) {
    const snapshot = await cases
      .where("warehouse_id", "==", warehouseId)
      .where("business_date", "==", businessDate)
      .get();
    return snapshot.docs.map((item) => item.data()).sort((a, b) =>
      String(b.last_seen_at ?? "").localeCompare(String(a.last_seen_at ?? "")));
  },

  async resolveCase(id: string, warehouseId: string, actorId: string, note: string) {
    const ref = cases.doc(id);
    return db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      const value = snapshot.exists ? snapshot.data()! : null;
      if (!value || value.warehouse_id !== warehouseId) return null;
      const now = new Date();
      const next = { ...value, status: InvoiceReconciliationCaseStatus.RESOLVED, resolved_at: now, resolved_by: actorId, resolution_note: note, updated_at: now };
      transaction.set(ref, next);
      return next;
    });
  },

  async listIssuedDocuments(limit: number) {
    const snapshot = await documents
      .where("status", "==", "ISSUED")
      .where("is_deleted", "==", false)
      .orderBy("updated_at", "asc")
      .limit(limit)
      .get();
    return snapshot.docs.map((item) => item.data());
  },

  async updateStatus(documentId: string, sourceId: string, fields: Record<string, unknown>) {
    const batch = db.batch();
    batch.set(documents.doc(documentId), fields, { merge: true });
    batch.set(sourceOrders.doc(sourceId), fields, { merge: true });
    await batch.commit();
  },
};
