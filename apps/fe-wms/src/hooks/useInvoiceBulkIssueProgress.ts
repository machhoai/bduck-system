"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { InvoiceIssueItemStatus } from "@bduck/shared-types";
import { db } from "@/lib/firebase";

interface ProgressItem {
  id: string;
  status: InvoiceIssueItemStatus;
  invoice_number: string | null;
  last_error: string | null;
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
              invoice_number: value.invoice_number ?? null,
              last_error: value.last_error ?? null,
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
    return {
      total,
      issued,
      queued: count(InvoiceIssueItemStatus.QUEUED),
      submitting: count(InvoiceIssueItemStatus.SUBMITTING),
      pending: count(InvoiceIssueItemStatus.PENDING_CONFIRMATION),
      retrying: count(InvoiceIssueItemStatus.RETRYABLE_ERROR),
      needsAttention: manual,
      cancelled,
      complete: total > 0 && issued + manual + cancelled === total,
      error,
    };
  }, [error, itemsByJob]);
}
