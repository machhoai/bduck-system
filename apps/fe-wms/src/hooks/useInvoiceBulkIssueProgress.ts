"use client";

import { InvoiceIssueItemStatus } from "@bduck/shared-types";
import { collection, onSnapshot } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";

import { db } from "@/lib/firebase";

interface ProgressItem {
  id: string;
  status: InvoiceIssueItemStatus;
  transaction_id: string | null;
  invoice_number: string | null;
  invoice_code: string | null;
  misa_error_code: string | null;
  last_error: string | null;
  next_attempt_at: Date | null;
}

export function useInvoiceBulkIssueProgress(jobIds: string[], lang: "vi" | "zh") {
  const [itemsByJob, setItemsByJob] = useState<Record<string, ProgressItem[]>>({});
  const [error, setError] = useState<string | null>(null);
  const jobKey = jobIds.join("|");

  useEffect(() => {
    setItemsByJob({});
    setError(null);
    if (jobIds.length === 0) return;
    const unsubscribes = jobIds.map((jobId) => onSnapshot(
      collection(db, "invoice_issue_jobs", jobId, "items"),
      (snapshot) => {
        setItemsByJob((current) => ({
          ...current,
          [jobId]: snapshot.docs.map((document) => {
            const value = document.data();
            return {
              id: document.id,
              status: value.status as InvoiceIssueItemStatus,
              transaction_id: value.transaction_id ?? null,
              invoice_number: value.invoice_number ?? null,
              invoice_code: value.invoice_code ?? null,
              misa_error_code: value.misa_error_code ?? null,
              last_error: value.last_error ?? null,
              next_attempt_at: value.next_attempt_at?.toDate?.() ?? null,
            };
          }),
        }));
      },
      () => setError(lang === "vi"
        ? "Không thể theo dõi tiến trình phát hành theo thời gian thực."
        : "无法实时跟踪开票进度。"),
    ));
    return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
  // jobKey is a stable representation of the requested listeners.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobKey, lang]);

  return useMemo(() => {
    const items = Object.values(itemsByJob).flat();
    const count = (status: InvoiceIssueItemStatus) =>
      items.filter((item) => item.status === status).length;
    const total = items.length;
    const issued = count(InvoiceIssueItemStatus.ISSUED);
    const manual = count(InvoiceIssueItemStatus.MANUAL_RECONCILIATION);
    const cancelled = count(InvoiceIssueItemStatus.CANCELLED);
    const pendingItems = items.filter(
      (item) => item.status === InvoiceIssueItemStatus.PENDING_CONFIRMATION,
    );
    const pendingWithMisaIdentity = pendingItems.filter(
      (item) => item.transaction_id || item.invoice_number || item.invoice_code,
    ).length;
    const pendingWithoutMisaIdentity = pendingItems.length - pendingWithMisaIdentity;
    const overduePending = pendingItems.filter(
      (item) => item.next_attempt_at && item.next_attempt_at.getTime() < Date.now(),
    ).length;
    return {
      total,
      issued,
      queued: count(InvoiceIssueItemStatus.QUEUED),
      submitting: count(InvoiceIssueItemStatus.SUBMITTING),
      pending: pendingItems.length,
      pendingWithMisaIdentity,
      pendingWithoutMisaIdentity,
      overduePending,
      retrying: count(InvoiceIssueItemStatus.RETRYABLE_ERROR),
      needsAttention: manual,
      cancelled,
      complete: total > 0 && issued + manual + cancelled === total,
      error,
    };
  }, [error, itemsByJob]);
}
