"use client";

import type {
  EmployeeProfile,
  LeaveBalanceSummary,
  LeavePolicy,
  LeaveRequestAdminView,
  ManualLeaveBalanceAdjustmentInput,
  UpsertLeavePolicyInput,
} from "@bduck/shared-types";
import { onAuthStateChanged } from "firebase/auth";
import { collection, doc, onSnapshot, query, where } from "firebase/firestore";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createLeaveBalanceAdjustment,
  fetchCompanyLeavePolicy,
  fetchCompanyLeaveRequests,
  fetchEmployeeLeaveBalance,
  fetchLeaveBalanceProfiles,
  saveCompanyLeavePolicy,
} from "@/api/leaveApi";
import {
  emitDataMutation,
  subscribeDataMutation,
} from "@/lib/dataInvalidation";
import { auth, db } from "@/lib/firebase";
import { useUserStore } from "@/stores/useUserStore";
import { getFacilityPermissionScope } from "@/utils/facilityPermissionScope";

interface AdministrationLabels {
  loadError: string;
  saveError: string;
}

export function useLeaveAdministration(
  access: { canManagePolicy: boolean; canReadAll: boolean; canAdjust: boolean },
  labels: AdministrationLabels,
) {
  const { canAdjust, canManagePolicy, canReadAll } = access;
  const permissions = useUserStore((state) => state.permissions);
  const requestScope = useMemo(
    () => getFacilityPermissionScope(permissions, ["leave.requests.read_all"]),
    [permissions],
  );
  const adjustmentScope = useMemo(
    () => getFacilityPermissionScope(permissions, ["leave.balance.adjust"]),
    [permissions],
  );
  const [policy, setPolicy] = useState<LeavePolicy | null>(null);
  const [requests, setRequests] = useState<LeaveRequestAdminView[]>([]);
  const [profiles, setProfiles] = useState<EmployeeProfile[]>([]);
  const [isLoading, setIsLoading] = useState(
    canManagePolicy || canReadAll || canAdjust,
  );
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [nextPolicy, nextRequests, nextProfiles] = await Promise.all([
        canManagePolicy
          ? fetchCompanyLeavePolicy(labels.loadError)
          : Promise.resolve(null),
        canReadAll
          ? fetchCompanyLeaveRequests(labels.loadError)
          : Promise.resolve([]),
        canAdjust
          ? fetchLeaveBalanceProfiles(labels.loadError)
          : Promise.resolve([]),
      ]);
      setPolicy(nextPolicy);
      setRequests(nextRequests);
      setProfiles(nextProfiles);
      setError(null);
    } catch (loadError) {
      console.error("[useLeaveAdministration] load error:", loadError);
      setError(loadError instanceof Error ? loadError.message : labels.loadError);
    } finally {
      setIsLoading(false);
    }
  }, [
    canAdjust,
    canManagePolicy,
    canReadAll,
    labels.loadError,
  ]);

  useEffect(() => {
    if (!canManagePolicy && !canReadAll && !canAdjust) {
      setPolicy(null);
      setRequests([]);
      setProfiles([]);
      setIsLoading(false);
      setError(null);
      return;
    }
    const unsubscribeMutation = subscribeDataMutation(
      [
        "leave_policies",
        "leave_requests",
        "leave_approval_tasks",
        "leave_balance_buckets",
        "leave_ledger_entries",
        "employee_profiles",
      ],
      () => void load(),
    );
    let listeners: Array<() => void> = [];
    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      listeners.forEach((unsubscribe) => unsubscribe());
      listeners = [];
      if (!firebaseUser) return void load();
      if (canManagePolicy) {
        listeners.push(
          onSnapshot(
            doc(db, "leave_policies", "company"),
            () => void load(),
            () => void load(),
          ),
        );
      }
      const subscribeScoped = (
        collectionName: string,
        field: string,
        scope: { isSystemAdmin: boolean; facilityIds: string[] },
      ) => {
        const queries = scope.isSystemAdmin
          ? [query(collection(db, collectionName), where("is_deleted", "==", false))]
          : scope.facilityIds.map((facilityId) =>
              query(
                collection(db, collectionName),
                where(field, "==", facilityId),
                where("is_deleted", "==", false),
              ),
            );
        listeners.push(
          ...queries.map((snapshotQuery) =>
            onSnapshot(snapshotQuery, () => void load(), () => void load()),
          ),
        );
      };
      if (canReadAll) {
        subscribeScoped(
          "leave_requests",
          "workplace_warehouse_id",
          requestScope,
        );
        subscribeScoped(
          "leave_approval_tasks",
          "workplace_warehouse_id",
          requestScope,
        );
      }
      if (canAdjust) {
        subscribeScoped(
          "employee_profiles",
          "workplace_warehouse_id",
          adjustmentScope,
        );
      }
    });
    void load();
    return () => {
      unsubscribeMutation();
      unsubscribeAuth();
      listeners.forEach((unsubscribe) => unsubscribe());
    };
  }, [
    adjustmentScope,
    canAdjust,
    canManagePolicy,
    canReadAll,
    load,
    requestScope,
  ]);

  const savePolicy = useCallback(
    async (input: UpsertLeavePolicyInput) => {
      const result = await saveCompanyLeavePolicy(input, labels.saveError);
      emitDataMutation(["leave_policies"]);
      return result;
    },
    [labels.saveError],
  );

  const getBalance = useCallback(
    (profileId: string): Promise<LeaveBalanceSummary> =>
      fetchEmployeeLeaveBalance(profileId, labels.loadError),
    [labels.loadError],
  );

  const adjustBalance = useCallback(
    async (profileId: string, input: ManualLeaveBalanceAdjustmentInput) => {
      const result = await createLeaveBalanceAdjustment(
        profileId,
        input,
        labels.saveError,
      );
      emitDataMutation(["leave_balance_buckets", "leave_ledger_entries"]);
      return result;
    },
    [labels.saveError],
  );

  return {
    policy,
    requests,
    profiles,
    isLoading,
    error,
    savePolicy,
    getBalance,
    adjustBalance,
  };
}
