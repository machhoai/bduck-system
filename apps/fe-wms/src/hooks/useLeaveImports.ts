"use client";

import type {
  CommitLeaveImportInput,
  LeaveImportBatch,
  LeaveImportBatchView,
  PreviewLeaveImportInput,
} from "@bduck/shared-types";
import { onAuthStateChanged } from "firebase/auth";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { useCallback, useEffect, useState } from "react";
import {
  commitLeaveHistoryImport,
  fetchLeaveImportBatch,
  fetchLeaveImportBatches,
  previewLeaveHistoryImport,
} from "@/api/leaveApi";
import {
  emitDataMutation,
  subscribeDataMutation,
} from "@/lib/dataInvalidation";
import { auth, db } from "@/lib/firebase";

interface LeaveImportLabels {
  loadError: string;
  saveError: string;
}

export function useLeaveImports(
  enabled: boolean,
  labels: LeaveImportLabels,
) {
  const [batches, setBatches] = useState<LeaveImportBatch[]>([]);
  const [preview, setPreview] = useState<LeaveImportBatchView | null>(null);
  const [isLoading, setIsLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!enabled) return;
    try {
      setBatches(await fetchLeaveImportBatches(labels.loadError));
      setError(null);
    } catch (loadError) {
      console.error("[useLeaveImports] load error:", loadError);
      setError(
        loadError instanceof Error ? loadError.message : labels.loadError,
      );
    } finally {
      setIsLoading(false);
    }
  }, [enabled, labels.loadError]);

  useEffect(() => {
    if (!enabled) {
      setBatches([]);
      setPreview(null);
      setError(null);
      setIsLoading(false);
      return;
    }
    const unsubscribeMutation = subscribeDataMutation(
      ["leave_import_batches", "leave_import_rows"],
      () => void load(),
    );
    let unsubscribeSnapshot: () => void = () => {};
    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      unsubscribeSnapshot();
      if (!firebaseUser) return void load();
      unsubscribeSnapshot = onSnapshot(
        query(
          collection(db, "leave_import_batches"),
          where("created_by", "==", firebaseUser.uid),
        ),
        () => void load(),
        () => void load(),
      );
    });
    void load();
    return () => {
      unsubscribeMutation();
      unsubscribeAuth();
      unsubscribeSnapshot();
    };
  }, [enabled, load]);

  const createPreview = useCallback(
    async (input: PreviewLeaveImportInput) => {
      const result = await previewLeaveHistoryImport(input, labels.saveError);
      setPreview(result);
      emitDataMutation(["leave_import_batches", "leave_import_rows"]);
      return result;
    },
    [labels.saveError],
  );

  const openBatch = useCallback(
    async (batchId: string) => {
      const result = await fetchLeaveImportBatch(batchId, labels.loadError);
      setPreview(result);
      return result;
    },
    [labels.loadError],
  );

  const commit = useCallback(
    async (batchId: string, input: CommitLeaveImportInput) => {
      const result = await commitLeaveHistoryImport(
        batchId,
        input,
        labels.saveError,
      );
      setPreview((current) =>
        current?.batch.id === batchId
          ? { ...current, batch: result.batch }
          : current,
      );
      emitDataMutation([
        "leave_import_batches",
        "leave_import_rows",
        "leave_requests",
        "leave_balance_buckets",
        "leave_ledger_entries",
      ]);
      return result;
    },
    [labels.saveError],
  );

  return {
    batches,
    preview,
    isLoading,
    error,
    createPreview,
    openBatch,
    commit,
    clearPreview: () => setPreview(null),
  };
}
