"use client";

import type {
  DecideLeaveApprovalTaskInput,
  LeaveApprovalConfig,
  LeaveApprovalConfigOptions,
  LeaveApprovalTaskView,
  ReassignLeaveApprovalTaskInput,
  UpsertLeaveApprovalConfigInput,
} from "@bduck/shared-types";
import { onAuthStateChanged } from "firebase/auth";
import { collection, doc, onSnapshot, query, where } from "firebase/firestore";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  decideLeaveApprovalTask,
  fetchLeaveApprovalConfig,
  fetchLeaveApprovalConfigOptions,
  fetchMyLeaveApprovalTasks,
  fetchUnavailableLeaveApprovalTasks,
  reassignLeaveApprovalTask,
  saveLeaveApprovalConfig,
} from "@/api/leaveApi";
import {
  emitDataMutation,
  subscribeDataMutation,
} from "@/lib/dataInvalidation";
import { auth, db } from "@/lib/firebase";
import { useUserStore } from "@/stores/useUserStore";

interface LeaveApprovalLabels {
  approvalLoadError: string;
  approvalSaveError: string;
}

export function useLeaveApprovals(
  access: { canApprove: boolean; canManage: boolean; canReassign: boolean },
  labels: LeaveApprovalLabels,
) {
  const permissions = useUserStore((state) => state.permissions);
  const approvalFacilityIds = useMemo(
    () =>
      Object.entries(permissions)
        .filter(
          ([scope, grants]) =>
            scope !== "global" &&
            (grants["*"] === true ||
              grants["leave.approve"] === true ||
              grants["leave.approver.reassign"] === true),
        )
        .map(([scope]) => scope),
    [permissions],
  );
  const isSystemAdmin = permissions.global?.["*"] === true;
  const [config, setConfig] = useState<LeaveApprovalConfig | null>(null);
  const [options, setOptions] = useState<LeaveApprovalConfigOptions>({
    roles: [],
    users: [],
  });
  const [tasks, setTasks] = useState<LeaveApprovalTaskView[]>([]);
  const [unavailable, setUnavailable] = useState<LeaveApprovalTaskView[]>([]);
  const [isLoading, setIsLoading] = useState(
    access.canApprove || access.canManage || access.canReassign,
  );
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [nextConfig, nextOptions, nextTasks, nextUnavailable] =
        await Promise.all([
          access.canManage
            ? fetchLeaveApprovalConfig(labels.approvalLoadError)
            : Promise.resolve(null),
          access.canManage || access.canReassign
            ? fetchLeaveApprovalConfigOptions(labels.approvalLoadError)
            : Promise.resolve({ roles: [], users: [] }),
          access.canApprove
            ? fetchMyLeaveApprovalTasks(labels.approvalLoadError)
            : Promise.resolve([]),
          access.canReassign
            ? fetchUnavailableLeaveApprovalTasks(labels.approvalLoadError)
            : Promise.resolve([]),
        ]);
      setConfig(nextConfig);
      setOptions(nextOptions);
      setTasks(nextTasks);
      setUnavailable(nextUnavailable);
      setError(null);
    } catch (loadError) {
      console.error("[useLeaveApprovals] load error:", loadError);
      setError(
        loadError instanceof Error
          ? loadError.message
          : labels.approvalLoadError,
      );
    } finally {
      setIsLoading(false);
    }
  }, [access.canApprove, access.canManage, access.canReassign, labels]);

  useEffect(() => {
    if (!access.canApprove && !access.canManage && !access.canReassign) {
      setConfig(null);
      setOptions({ roles: [], users: [] });
      setTasks([]);
      setUnavailable([]);
      setError(null);
      setIsLoading(false);
      return;
    }
    const unsubscribeMutation = subscribeDataMutation(
      ["leave_approval_tasks", "leave_approval_configs"],
      () => void load(),
    );
    let snapshotUnsubscribers: Array<() => void> = [];
    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      snapshotUnsubscribers.forEach((unsubscribe) => unsubscribe());
      snapshotUnsubscribers = [];
      if (!firebaseUser) return void load();
      snapshotUnsubscribers = [
        onSnapshot(
          doc(db, "leave_approval_configs", "company"),
          () => void load(),
          () => void load(),
        ),
      ];
      if (access.canApprove || access.canReassign) {
        const taskQueries = isSystemAdmin
          ? [
              query(
                collection(db, "leave_approval_tasks"),
                where("is_deleted", "==", false),
              ),
            ]
          : approvalFacilityIds.map((facilityId) =>
              query(
                collection(db, "leave_approval_tasks"),
                where("workplace_warehouse_id", "==", facilityId),
                where("is_deleted", "==", false),
              ),
            );
        snapshotUnsubscribers.push(
          ...taskQueries.map((taskQuery) =>
            onSnapshot(taskQuery, () => void load(), () => void load()),
          ),
        );
      }
    });
    void load();
    return () => {
      unsubscribeMutation();
      unsubscribeAuth();
      snapshotUnsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [
    access.canApprove,
    access.canManage,
    access.canReassign,
    approvalFacilityIds,
    isSystemAdmin,
    load,
  ]);

  const saveConfig = useCallback(
    async (input: UpsertLeaveApprovalConfigInput) => {
      const result = await saveLeaveApprovalConfig(
        input,
        labels.approvalSaveError,
      );
      emitDataMutation(["leave_approval_configs"]);
      return result;
    },
    [labels.approvalSaveError],
  );
  const decide = useCallback(
    async (taskId: string, input: DecideLeaveApprovalTaskInput) => {
      const result = await decideLeaveApprovalTask(
        taskId,
        input,
        labels.approvalSaveError,
      );
      emitDataMutation([
        "leave_approval_tasks",
        "leave_requests",
        "leave_balance_buckets",
      ]);
      return result;
    },
    [labels.approvalSaveError],
  );
  const reassign = useCallback(
    async (taskId: string, input: ReassignLeaveApprovalTaskInput) => {
      const result = await reassignLeaveApprovalTask(
        taskId,
        input,
        labels.approvalSaveError,
      );
      emitDataMutation(["leave_approval_tasks", "leave_requests"]);
      return result;
    },
    [labels.approvalSaveError],
  );

  return {
    config,
    options,
    tasks,
    unavailable,
    isLoading,
    error,
    saveConfig,
    decide,
    reassign,
  };
}
