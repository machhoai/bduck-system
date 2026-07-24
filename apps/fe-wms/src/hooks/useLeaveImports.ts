"use client";

import type {
  CommitLeaveImportInput,
  LeaveImportBatch,
  LeaveImportBatchView,
  LeaveImportEmployeeOption,
  PreviewLeaveImportInput,
} from "@bduck/shared-types";
import { onAuthStateChanged } from "firebase/auth";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  commitLeaveHistoryImport,
  fetchLeaveImportBatch,
  fetchLeaveImportBatches,
  fetchLeaveImportEmployeeOptions,
  previewLeaveHistoryImport,
} from "@/api/leaveApi";
import {
  emitDataMutation,
  subscribeDataMutation,
} from "@/lib/dataInvalidation";
import { auth, db } from "@/lib/firebase";
import {
  buildFacilityScopedQueries,
  subscribeToMergedQueries,
} from "@/lib/scopedFirestore";
import { useUserStore } from "@/stores/useUserStore";
import { getFacilityPermissionScope } from "@/utils/facilityPermissionScope";

interface LeaveImportLabels {
  loadError: string;
  saveError: string;
}

export function useLeaveImports(enabled: boolean, labels: LeaveImportLabels) {
  const permissions = useUserStore((state) => state.permissions);
  const profileScope = useMemo(
    () => getFacilityPermissionScope(permissions, ["leave.history.import"]),
    [permissions],
  );
  const [batches, setBatches] = useState<LeaveImportBatch[]>([]);
  const [profiles, setProfiles] = useState<LeaveImportEmployeeOption[]>([]);
  const [preview, setPreview] = useState<LeaveImportBatchView | null>(null);
  const [isLoading, setIsLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!enabled) return;
    try {
      const [nextBatches, nextProfiles] = await Promise.all([
        fetchLeaveImportBatches(labels.loadError),
        fetchLeaveImportEmployeeOptions(labels.loadError),
      ]);
      setBatches(nextBatches);
      setProfiles(nextProfiles);
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
      setProfiles([]);
      setPreview(null);
      setError(null);
      setIsLoading(false);
      return;
    }
    const unsubscribeMutation = subscribeDataMutation(
      ["leave_import_batches", "leave_import_rows", "employee_profiles"],
      () => void load(),
    );
    let unsubscribeSnapshots: Array<() => void> = [];
    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      unsubscribeSnapshots.forEach((unsubscribe) => unsubscribe());
      unsubscribeSnapshots = [];
      if (!firebaseUser) return void load();
      unsubscribeSnapshots.push(
        onSnapshot(
          query(
            collection(db, "leave_import_batches"),
            where("created_by", "==", firebaseUser.uid),
          ),
          () => void load(),
          () => void load(),
        ),
        subscribeToMergedQueries<LeaveImportEmployeeOption>({
          queries: buildFacilityScopedQueries({
            db,
            collectionName: "employee_profiles",
            facilityField: "workplace_warehouse_id",
            scope: profileScope,
            constraints: [where("is_deleted", "==", false)],
          }),
          mapDocument: (document) => {
            const data = document.data();
            return {
              id: document.id,
              employee_code: String(data.employee_code ?? ""),
              full_name: String(data.full_name ?? ""),
              workplace_warehouse_id: String(data.workplace_warehouse_id ?? ""),
            };
          },
          onData: (records) =>
            setProfiles(
              records.sort(
                (left, right) =>
                  left.full_name.localeCompare(right.full_name, "vi") ||
                  left.employee_code.localeCompare(right.employee_code),
              ),
            ),
          onError: () => void load(),
        }),
      );
    });
    void load();
    return () => {
      unsubscribeMutation();
      unsubscribeAuth();
      unsubscribeSnapshots.forEach((unsubscribe) => unsubscribe());
    };
  }, [enabled, load, profileScope]);

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
    profiles,
    preview,
    isLoading,
    error,
    createPreview,
    openBatch,
    commit,
    clearPreview: () => setPreview(null),
  };
}
