import {
  InvoiceDocumentStatus,
  InvoiceIssueItemStatus,
  InvoiceIssueJobStatus,
  InvoiceOrderMatchStatus,
  type InvoiceIssueJobCounts,
} from "@bduck/shared-types";

import { db } from "../config/firebase.js";
import {
  invoiceLaneId,
  isExplicitMisaRejection,
} from "../services/invoiceIssuePolicy.js";

const jobs = db.collection("invoice_issue_jobs");
const documents = db.collection("invoice_documents");
const sourceOrders = db.collection("invoice_source_orders");
const lanes = db.collection("invoice_queue_lanes");
const payloads = db.collection("invoice_issue_payloads");
const refRegistry = db.collection("invoice_ref_registry");

export interface PreparedIssueItem {
  documentId: string;
  sourceOrderId: string;
  sourcePayloadHash: string;
  revision: number;
  refId: string;
  payloadHash: string;
  payload: Record<string, unknown>;
}

const initialCounts = (total: number): InvoiceIssueJobCounts => ({
  total,
  queued: total,
  processing: 0,
  pending_confirmation: 0,
  issued: 0,
  retryable_error: 0,
  manual_reconciliation: 0,
  cancelled: 0,
});

const countKey = (
  status: InvoiceIssueItemStatus,
): keyof InvoiceIssueJobCounts => {
  switch (status) {
    case InvoiceIssueItemStatus.QUEUED:
      return "queued";
    case InvoiceIssueItemStatus.SUBMITTING:
      return "processing";
    case InvoiceIssueItemStatus.PENDING_CONFIRMATION:
      return "pending_confirmation";
    case InvoiceIssueItemStatus.ISSUED:
      return "issued";
    case InvoiceIssueItemStatus.RETRYABLE_ERROR:
      return "retryable_error";
    case InvoiceIssueItemStatus.MANUAL_RECONCILIATION:
      return "manual_reconciliation";
    case InvoiceIssueItemStatus.CANCELLED:
      return "cancelled";
  }
};

const documentStatusForItem = (status: InvoiceIssueItemStatus) => {
  const mapping: Record<InvoiceIssueItemStatus, InvoiceDocumentStatus> = {
    QUEUED: InvoiceDocumentStatus.QUEUED,
    SUBMITTING: InvoiceDocumentStatus.SUBMITTING,
    PENDING_CONFIRMATION: InvoiceDocumentStatus.PENDING_CONFIRMATION,
    ISSUED: InvoiceDocumentStatus.ISSUED,
    RETRYABLE_ERROR: InvoiceDocumentStatus.RETRYABLE_ERROR,
    MANUAL_RECONCILIATION: InvoiceDocumentStatus.MANUAL_RECONCILIATION,
    CANCELLED: InvoiceDocumentStatus.CANCELLED,
  };
  return mapping[status];
};

const terminalJobStatus = (counts: InvoiceIssueJobCounts) => {
  const done = counts.issued + counts.manual_reconciliation + counts.cancelled;
  if (done !== counts.total) return InvoiceIssueJobStatus.PROCESSING;
  if (counts.issued === counts.total) return InvoiceIssueJobStatus.COMPLETED;
  if (counts.cancelled === counts.total) return InvoiceIssueJobStatus.CANCELLED;
  if (counts.issued === 0) return InvoiceIssueJobStatus.FAILED;
  return InvoiceIssueJobStatus.PARTIAL;
};

export const invoiceIssueRepository = {
  async createJob(input: {
    jobId: string;
    warehouseId: string;
    accountId: string;
    invSeries: string;
    signType: number;
    invoiceWithCode: boolean;
    invoiceCalculatingMachine: boolean;
    idempotencyKey: string;
    actorId: string;
    items: PreparedIssueItem[];
    bulkRunId?: string;
  }) {
    const jobRef = jobs.doc(input.jobId);
    return db.runTransaction(async (transaction) => {
      const existing = await transaction.get(jobRef);
      if (existing.exists) return { created: false, job: existing.data()! };

      const documentRefs = input.items.map((item) =>
        documents.doc(item.documentId),
      );
      const sourceRefs = input.items.map((item) =>
        sourceOrders.doc(item.documentId),
      );
      const registryRefs = input.items.map((item) =>
        refRegistry.doc(item.refId),
      );
      const [documentSnaps, sourceSnaps, registrySnaps] = await Promise.all([
        Promise.all(documentRefs.map((ref) => transaction.get(ref))),
        Promise.all(sourceRefs.map((ref) => transaction.get(ref))),
        Promise.all(registryRefs.map((ref) => transaction.get(ref))),
      ]);
      const now = new Date();
      input.items.forEach((item, index) => {
        const document = documentSnaps[index]?.data();
        const source = sourceSnaps[index]?.data();
        if (
          !document ||
          !source ||
          document.warehouse_id !== input.warehouseId ||
          source.warehouse_id !== input.warehouseId ||
          ![
            InvoiceDocumentStatus.NEEDS_REVIEW,
            InvoiceDocumentStatus.NEEDS_SECOND_REVIEW,
            InvoiceDocumentStatus.READY_TO_ISSUE,
          ].includes(document.status) ||
          document.issue_eligible !== true ||
          document.revision !== item.revision ||
          document.source_payload_hash !== item.sourcePayloadHash ||
          source.source_payload_hash !== item.sourcePayloadHash ||
          source.match_status === InvoiceOrderMatchStatus.MATCHED ||
          document.active_issue_job_id
        ) {
          throw Object.assign(new Error("INVOICE_ISSUE_CONFLICT"), {
            statusCode: 409,
          });
        }
        const registry = registrySnaps[index];
        if (registry?.exists) {
          throw Object.assign(new Error("INVOICE_REF_ALREADY_RESERVED"), {
            statusCode: 409,
          });
        }
      });

      const job = {
        id: input.jobId,
        warehouse_id: input.warehouseId,
        meinvoice_account_id: input.accountId,
        inv_series: input.invSeries,
        sign_type: input.signType,
        invoice_with_code: input.invoiceWithCode,
        invoice_calculating_machine: input.invoiceCalculatingMachine,
        status: InvoiceIssueJobStatus.QUEUED,
        idempotency_key: input.idempotencyKey,
        requested_by: input.actorId,
        bulk_run_id: input.bulkRunId ?? null,
        counts: initialCounts(input.items.length),
        created_at: now,
        updated_at: now,
        completed_at: null,
      };
      transaction.create(jobRef, job);
      input.items.forEach((item, index) => {
        const itemRef = jobRef.collection("items").doc(item.documentId);
        transaction.create(itemRef, {
          id: item.documentId,
          entity_type: "INVOICE_ISSUE_ITEM",
          job_id: input.jobId,
          warehouse_id: input.warehouseId,
          invoice_document_id: item.documentId,
          source_order_id: item.sourceOrderId,
          ref_id: item.refId,
          prepared_payload_hash: item.payloadHash,
          status: InvoiceIssueItemStatus.QUEUED,
          attempt_count: 0,
          next_attempt_at: now,
          transaction_id: null,
          invoice_number: null,
          invoice_code: null,
          misa_error_code: null,
          last_error: null,
          retry_eligible: false,
          retry_count: 0,
          created_at: now,
          updated_at: now,
          completed_at: null,
        });
        transaction.create(payloads.doc(`${input.jobId}__${item.documentId}`), {
          job_id: input.jobId,
          item_id: item.documentId,
          ref_id: item.refId,
          prepared_payload_hash: item.payloadHash,
          payload: item.payload,
          created_at: now,
        });
        transaction.create(registryRefs[index]!, {
          ref_id: item.refId,
          invoice_document_id: item.documentId,
          job_id: input.jobId,
          warehouse_id: input.warehouseId,
          created_at: now,
        });
        transaction.update(documentRefs[index]!, {
          status: InvoiceDocumentStatus.QUEUED,
          active_issue_job_id: input.jobId,
          ref_id: item.refId,
          prepared_payload_hash: item.payloadHash,
          queued_by: input.actorId,
          queued_at: now,
          updated_by: input.actorId,
          updated_at: now,
        });
        transaction.update(sourceRefs[index]!, {
          invoice_document_status: InvoiceDocumentStatus.QUEUED,
          updated_at: now,
        });
      });
      return { created: true, job };
    });
  },

  async getJob(jobId: string, warehouseId?: string) {
    const snapshot = await jobs.doc(jobId).get();
    if (!snapshot.exists) return null;
    const job = snapshot.data()!;
    if (warehouseId && job.warehouse_id !== warehouseId) return null;
    const items = await jobs
      .doc(jobId)
      .collection("items")
      .orderBy("created_at")
      .get();
    return { ...job, items: items.docs.map((doc) => doc.data()) };
  },

  async claimItem(jobId: string, itemId: string, owner: string) {
    const jobRef = jobs.doc(jobId);
    const itemRef = jobRef.collection("items").doc(itemId);
    return db.runTransaction(async (transaction) => {
      const [jobSnap, itemSnap] = await Promise.all([
        transaction.get(jobRef),
        transaction.get(itemRef),
      ]);
      if (!jobSnap.exists || !itemSnap.exists) return null;
      const job = jobSnap.data()!;
      const item = itemSnap.data()!;
      const status = item.status as InvoiceIssueItemStatus;
      if (
        ![
          InvoiceIssueItemStatus.QUEUED,
          InvoiceIssueItemStatus.RETRYABLE_ERROR,
          InvoiceIssueItemStatus.PENDING_CONFIRMATION,
          InvoiceIssueItemStatus.SUBMITTING,
        ].includes(status)
      )
        return null;
      const nextAttempt =
        item.next_attempt_at?.toDate?.() ?? item.next_attempt_at;
      if (nextAttempt instanceof Date && nextAttempt.getTime() > Date.now()) {
        return {
          busy: false as const,
          notDue: true as const,
          nextAttemptAt: nextAttempt,
        };
      }
      const laneRef = lanes.doc(
        invoiceLaneId(job.meinvoice_account_id, job.inv_series),
      );
      const laneSnap = await transaction.get(laneRef);
      const lane = laneSnap.data();
      const leaseExpires =
        lane?.lease_expires_at?.toDate?.() ?? lane?.lease_expires_at;
      const circuitOpenUntil =
        lane?.circuit_open_until?.toDate?.() ?? lane?.circuit_open_until;
      if (
        circuitOpenUntil instanceof Date &&
        circuitOpenUntil.getTime() > Date.now()
      ) {
        return { busy: true as const, notDue: false as const };
      }
      if (
        lane &&
        lane.lease_owner !== owner &&
        leaseExpires instanceof Date &&
        leaseExpires.getTime() > Date.now()
      ) {
        return { busy: true as const, notDue: false as const };
      }
      const payloadSnap = await transaction.get(
        payloads.doc(`${jobId}__${itemId}`),
      );
      if (!payloadSnap.exists) throw new Error("INVOICE_ISSUE_PAYLOAD_MISSING");
      const now = new Date();
      transaction.set(
        laneRef,
        {
          id: laneRef.id,
          account_id: job.meinvoice_account_id,
          inv_series: job.inv_series,
          lease_owner: owner,
          lease_acquired_at: now,
          lease_expires_at: new Date(now.getTime() + 120_000),
          heartbeat_at: now,
        },
        { merge: true },
      );
      const update: Record<string, unknown> = {
        claimed_by: owner,
        claimed_at: now,
        attempt_count: Number(item.attempt_count ?? 0) + 1,
        updated_at: now,
      };
      const recoveringSubmission = status === InvoiceIssueItemStatus.SUBMITTING;
      if (recoveringSubmission) {
        update.status = InvoiceIssueItemStatus.PENDING_CONFIRMATION;
        const counts = { ...(job.counts as InvoiceIssueJobCounts) };
        counts.processing -= 1;
        counts.pending_confirmation += 1;
        transaction.update(jobRef, {
          status: InvoiceIssueJobStatus.PROCESSING,
          counts,
          updated_at: now,
        });
        transaction.update(documents.doc(item.invoice_document_id), {
          status: InvoiceDocumentStatus.PENDING_CONFIRMATION,
          updated_at: now,
        });
        transaction.update(sourceOrders.doc(item.invoice_document_id), {
          invoice_document_status: InvoiceDocumentStatus.PENDING_CONFIRMATION,
          updated_at: now,
        });
      } else if (status !== InvoiceIssueItemStatus.PENDING_CONFIRMATION) {
        update.status = InvoiceIssueItemStatus.SUBMITTING;
        const counts = { ...(job.counts as InvoiceIssueJobCounts) };
        counts[countKey(status)] -= 1;
        counts.processing += 1;
        transaction.update(jobRef, {
          status: InvoiceIssueJobStatus.PROCESSING,
          counts,
          updated_at: now,
        });
        transaction.update(documents.doc(item.invoice_document_id), {
          status: InvoiceDocumentStatus.SUBMITTING,
          updated_at: now,
        });
        transaction.update(sourceOrders.doc(item.invoice_document_id), {
          invoice_document_status: InvoiceDocumentStatus.SUBMITTING,
          updated_at: now,
        });
      }
      transaction.update(itemRef, update);
      return {
        busy: false as const,
        notDue: false as const,
        job,
        item: { ...item, ...update },
        previousStatus: recoveringSubmission
          ? InvoiceIssueItemStatus.PENDING_CONFIRMATION
          : status,
        payload: payloadSnap.data()!.payload as Record<string, unknown>,
        laneId: laneRef.id,
      };
    });
  },

  async completeItem(input: {
    jobId: string;
    itemId: string;
    owner: string;
    status: InvoiceIssueItemStatus;
    nextAttemptAt: Date | null;
    transactionId?: string | null;
    invoiceNumber?: string | null;
    invoiceCode?: string | null;
    errorCode?: string | null;
    lastError?: string | null;
    retryEligible?: boolean;
  }) {
    const jobRef = jobs.doc(input.jobId);
    const itemRef = jobRef.collection("items").doc(input.itemId);
    return db.runTransaction(async (transaction) => {
      const [jobSnap, itemSnap] = await Promise.all([
        transaction.get(jobRef),
        transaction.get(itemRef),
      ]);
      if (!jobSnap.exists || !itemSnap.exists) return null;
      const job = jobSnap.data()!;
      const item = itemSnap.data()!;
      const currentStatus = item.status as InvoiceIssueItemStatus;
      if (
        item.claimed_by !== input.owner ||
        [
          InvoiceIssueItemStatus.ISSUED,
          InvoiceIssueItemStatus.MANUAL_RECONCILIATION,
          InvoiceIssueItemStatus.CANCELLED,
        ].includes(currentStatus)
      ) {
        return { applied: false as const, item };
      }
      const laneRef = lanes.doc(
        invoiceLaneId(job.meinvoice_account_id, job.inv_series),
      );
      const sourceRef = sourceOrders.doc(item.invoice_document_id);
      const [laneSnap, sourceSnap] = await Promise.all([
        transaction.get(laneRef),
        transaction.get(sourceRef),
      ]);
      const counts = { ...(job.counts as InvoiceIssueJobCounts) };
      counts[countKey(currentStatus)] -= 1;
      counts[countKey(input.status)] += 1;
      const now = new Date();
      const jobStatus = terminalJobStatus(counts);
      const completedAt = [
        InvoiceIssueItemStatus.ISSUED,
        InvoiceIssueItemStatus.MANUAL_RECONCILIATION,
        InvoiceIssueItemStatus.CANCELLED,
      ].includes(input.status)
        ? now
        : null;
      transaction.update(itemRef, {
        status: input.status,
        next_attempt_at: input.nextAttemptAt,
        transaction_id: input.transactionId ?? item.transaction_id ?? null,
        invoice_number: input.invoiceNumber ?? item.invoice_number ?? null,
        invoice_code: input.invoiceCode ?? item.invoice_code ?? null,
        misa_error_code: input.errorCode ?? null,
        last_error: input.lastError ?? null,
        retry_eligible: input.retryEligible === true,
        completed_at: completedAt,
        updated_at: now,
      });
      transaction.update(jobRef, {
        status: jobStatus,
        counts,
        updated_at: now,
        completed_at:
          jobStatus === InvoiceIssueJobStatus.PROCESSING ? null : now,
      });
      const documentStatus = documentStatusForItem(input.status);
      transaction.update(documents.doc(item.invoice_document_id), {
        status: documentStatus,
        active_issue_job_id: completedAt ? null : input.jobId,
        issued_by:
          input.status === InvoiceIssueItemStatus.ISSUED
            ? job.requested_by
            : null,
        issued_at: input.status === InvoiceIssueItemStatus.ISSUED ? now : null,
        transaction_id: input.transactionId ?? item.transaction_id ?? null,
        invoice_number: input.invoiceNumber ?? item.invoice_number ?? null,
        invoice_code: input.invoiceCode ?? item.invoice_code ?? null,
        issue_retry_eligible: input.retryEligible === true,
        last_issue_error_code: input.errorCode ?? null,
        last_issue_error: input.lastError ?? null,
        updated_at: now,
      });
      transaction.update(sourceRef, {
        invoice_document_status: documentStatus,
        match_status:
          input.status === InvoiceIssueItemStatus.ISSUED
            ? InvoiceOrderMatchStatus.MATCHED
            : (sourceSnap.data()?.match_status ??
              InvoiceOrderMatchStatus.NOT_CHECKED),
        misa_transaction_id: input.transactionId ?? item.transaction_id ?? null,
        misa_invoice_number: input.invoiceNumber ?? item.invoice_number ?? null,
        issue_retry_eligible: input.retryEligible === true,
        misa_error_code: input.errorCode ?? null,
        updated_at: now,
      });
      if (laneSnap.exists && laneSnap.data()?.lease_owner === input.owner) {
        const previousFailures = Number(
          laneSnap.data()?.consecutive_failures ?? 0,
        );
        const nextFailures =
          input.status === InvoiceIssueItemStatus.RETRYABLE_ERROR
            ? previousFailures + 1
            : input.status === InvoiceIssueItemStatus.ISSUED
              ? 0
              : previousFailures;
        transaction.update(laneRef, {
          lease_owner: null,
          lease_expires_at: now,
          heartbeat_at: now,
          consecutive_failures: nextFailures,
          circuit_open_until:
            nextFailures >= 5
              ? new Date(now.getTime() + 5 * 60_000)
              : input.status === InvoiceIssueItemStatus.ISSUED
                ? null
                : (laneSnap.data()?.circuit_open_until ?? null),
        });
      }
      return {
        applied: true as const,
        item: { ...item, status: input.status },
      };
    });
  },

  async listRetryCandidates(invoiceDocumentIds: string[], warehouseId: string) {
    const uniqueIds = [...new Set(invoiceDocumentIds)];
    const documentSnaps = await Promise.all(
      uniqueIds.map((id) => documents.doc(id).get()),
    );
    const reservations = await Promise.all(
      documentSnaps.map(async (snapshot) => {
        const document = snapshot.data();
        if (
          !snapshot.exists ||
          document?.warehouse_id !== warehouseId ||
          document.status !== InvoiceDocumentStatus.MANUAL_RECONCILIATION ||
          typeof document.ref_id !== "string"
        ) {
          return null;
        }
        const registry = await refRegistry.doc(document.ref_id).get();
        const jobId = registry.data()?.job_id;
        if (typeof jobId !== "string" || !jobId) return null;
        const [job, item] = await Promise.all([
          jobs.doc(jobId).get(),
          jobs.doc(jobId).collection("items").doc(snapshot.id).get(),
        ]);
        if (
          !job.exists ||
          job.data()?.warehouse_id !== warehouseId ||
          !item.exists ||
          !isExplicitMisaRejection(item.data()!)
        ) {
          return null;
        }
        return {
          job: { id: job.id, ...job.data()! },
          item: { id: item.id, ...item.data()! },
        };
      }),
    );
    return reservations.filter(
      (value): value is NonNullable<typeof value> => value !== null,
    );
  },

  async requeueRejectedItems(input: {
    jobId: string;
    warehouseId: string;
    itemIds: string[];
    actorId: string;
    accountId: string;
    invSeries: string;
    signType: number;
    invoiceWithCode: boolean;
    invoiceCalculatingMachine: boolean;
  }) {
    const uniqueItemIds = [...new Set(input.itemIds)];
    const jobRef = jobs.doc(input.jobId);
    const itemRefs = uniqueItemIds.map((itemId) =>
      jobRef.collection("items").doc(itemId),
    );
    const documentRefs = uniqueItemIds.map((itemId) => documents.doc(itemId));
    const sourceRefs = uniqueItemIds.map((itemId) => sourceOrders.doc(itemId));

    return db.runTransaction(async (transaction) => {
      const [jobSnap, itemSnaps, documentSnaps, sourceSnaps] =
        await Promise.all([
          transaction.get(jobRef),
          Promise.all(itemRefs.map((ref) => transaction.get(ref))),
          Promise.all(documentRefs.map((ref) => transaction.get(ref))),
          Promise.all(sourceRefs.map((ref) => transaction.get(ref))),
        ]);
      if (
        !jobSnap.exists ||
        jobSnap.data()?.warehouse_id !== input.warehouseId
      ) {
        throw Object.assign(new Error("INVOICE_ISSUE_JOB_NOT_FOUND"), {
          statusCode: 404,
        });
      }
      const job = jobSnap.data()!;
      const counts = { ...(job.counts as InvoiceIssueJobCounts) };
      const activeCount =
        counts.queued +
        counts.processing +
        counts.pending_confirmation +
        counts.retryable_error;
      if (activeCount > 0) {
        throw Object.assign(new Error("INVOICE_ISSUE_JOB_STILL_PROCESSING"), {
          statusCode: 409,
        });
      }
      if (
        job.meinvoice_account_id !== input.accountId ||
        job.inv_series !== input.invSeries ||
        job.invoice_with_code !== input.invoiceWithCode
      ) {
        throw Object.assign(
          new Error("INVOICE_RETRY_CONFIG_IDENTITY_CHANGED"),
          {
            statusCode: 409,
          },
        );
      }

      itemSnaps.forEach((itemSnap, index) => {
        const item = itemSnap.data();
        const document = documentSnaps[index]?.data();
        const source = sourceSnaps[index]?.data();
        if (
          !itemSnap.exists ||
          !item ||
          !isExplicitMisaRejection(item) ||
          !document ||
          document.warehouse_id !== input.warehouseId ||
          document.status !== InvoiceDocumentStatus.MANUAL_RECONCILIATION ||
          document.ref_id !== item.ref_id ||
          document.active_issue_job_id ||
          !source ||
          source.warehouse_id !== input.warehouseId ||
          source.match_status === InvoiceOrderMatchStatus.MATCHED
        ) {
          throw Object.assign(new Error("INVOICE_RETRY_ITEM_NOT_ELIGIBLE"), {
            statusCode: 409,
          });
        }
      });

      const now = new Date();
      counts.manual_reconciliation -= uniqueItemIds.length;
      counts.queued += uniqueItemIds.length;
      transaction.update(jobRef, {
        status: InvoiceIssueJobStatus.PROCESSING,
        sign_type: input.signType,
        invoice_calculating_machine: input.invoiceCalculatingMachine,
        counts,
        retry_count: Number(job.retry_count ?? 0) + 1,
        last_retry_by: input.actorId,
        last_retry_at: now,
        updated_at: now,
        completed_at: null,
      });
      itemSnaps.forEach((itemSnap, index) => {
        const item = itemSnap.data()!;
        transaction.update(itemRefs[index]!, {
          status: InvoiceIssueItemStatus.QUEUED,
          attempt_count: 0,
          next_attempt_at: now,
          retry_eligible: false,
          retry_count: Number(item.retry_count ?? 0) + 1,
          previous_misa_error_code: item.misa_error_code ?? null,
          previous_last_error: item.last_error ?? null,
          misa_error_code: null,
          last_error: null,
          claimed_by: null,
          claimed_at: null,
          completed_at: null,
          updated_at: now,
        });
        transaction.update(documentRefs[index]!, {
          status: InvoiceDocumentStatus.QUEUED,
          active_issue_job_id: input.jobId,
          issue_retry_eligible: false,
          last_issue_error_code: null,
          last_issue_error: null,
          updated_by: input.actorId,
          updated_at: now,
        });
        transaction.update(sourceRefs[index]!, {
          invoice_document_status: InvoiceDocumentStatus.QUEUED,
          issue_retry_eligible: false,
          misa_error_code: null,
          updated_at: now,
        });
      });
      return { requeued: uniqueItemIds };
    });
  },

  async listRecoverable(limit = 30) {
    const now = new Date();
    const snapshots = await Promise.all(
      [
        InvoiceIssueItemStatus.QUEUED,
        InvoiceIssueItemStatus.RETRYABLE_ERROR,
        InvoiceIssueItemStatus.PENDING_CONFIRMATION,
        InvoiceIssueItemStatus.SUBMITTING,
      ].map((status) =>
        db
          .collectionGroup("items")
          .where("entity_type", "==", "INVOICE_ISSUE_ITEM")
          .where("status", "==", status)
          .where("next_attempt_at", "<=", now)
          .orderBy("next_attempt_at")
          .limit(limit)
          .get(),
      ),
    );
    return snapshots
      .flatMap((snapshot) => snapshot.docs)
      .sort((left, right) => {
        const leftDue = left.data().next_attempt_at?.toMillis?.() ?? 0;
        const rightDue = right.data().next_attempt_at?.toMillis?.() ?? 0;
        return leftDue - rightDue;
      })
      .slice(0, limit)
      .map((doc) => ({
        jobId: doc.ref.parent.parent!.id,
        itemId: doc.id,
        attempt: Number(doc.data().attempt_count ?? 0),
      }));
  },
};
