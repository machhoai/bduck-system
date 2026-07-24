"use client";

import type {
  CompanyHoliday,
  CreateLeaveRequestInput,
  EmployeeProfile,
  LeaveApprovalTask,
  LeaveRequest,
  UpsertCompanyHolidayInput,
} from "@bduck/shared-types";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { useCallback, useEffect, useState } from "react";
import {
  cancelMyLeaveRequest,
  createCompanyHoliday,
  createMyLeaveRequest,
  deleteCompanyHoliday,
  fetchCompanyHolidays,
  fetchMyLeaveRequests,
  submitMyLeaveRequest,
} from "@/api/leaveApi";
import {
  emitDataMutation,
  subscribeDataMutation,
} from "@/lib/dataInvalidation";
import { auth, db } from "@/lib/firebase";

interface LeaveRequestLabels {
  leaveRequestsLoadError: string;
  leaveRequestSaveError: string;
  holidaysLoadError: string;
  holidaySaveError: string;
}

export function useMyLeaveRequests(
  profile: EmployeeProfile | null,
  canReadRequests: boolean,
  canUseLeave: boolean,
  labels: LeaveRequestLabels,
) {
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [holidays, setHolidays] = useState<CompanyHoliday[]>([]);
  const [approvalTasks, setApprovalTasks] = useState<LeaveApprovalTask[]>([]);
  const [isLoading, setIsLoading] = useState(canReadRequests);
  const [error, setError] = useState<string | null>(null);

  const loadFallback = useCallback(async () => {
    try {
      const year = new Date().getFullYear();
      const [requestData, currentHolidays, nextHolidays] = await Promise.all([
        canReadRequests
          ? fetchMyLeaveRequests(labels.leaveRequestsLoadError)
          : Promise.resolve([]),
        fetchCompanyHolidays(year, labels.holidaysLoadError),
        fetchCompanyHolidays(year + 1, labels.holidaysLoadError),
      ]);
      setRequests(requestData);
      setHolidays([...currentHolidays, ...nextHolidays]);
      setError(null);
    } catch (loadError) {
      console.error("[useMyLeaveRequests] load error:", loadError);
      setError(
        loadError instanceof Error
          ? loadError.message
          : labels.leaveRequestsLoadError,
      );
    } finally {
      setIsLoading(false);
    }
  }, [canReadRequests, labels]);

  useEffect(() => {
    if ((!canReadRequests && !canUseLeave) || !profile?.user_id) {
      setRequests([]);
      setHolidays([]);
      setApprovalTasks([]);
      setIsLoading(false);
      setError(null);
      return;
    }
    let unsubscribeRequests: (() => void) | undefined;
    let unsubscribeHolidays: (() => void) | undefined;
    let unsubscribeApprovalTasks: (() => void) | undefined;
    setIsLoading(true);
    const unsubscribeMutation = subscribeDataMutation(
      ["leave_requests", "leave_approval_tasks", "company_holidays"],
      () => void loadFallback(),
    );
    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      unsubscribeRequests?.();
      unsubscribeHolidays?.();
      unsubscribeApprovalTasks?.();
      if (!firebaseUser) {
        void loadFallback();
        return;
      }
      if (canReadRequests) {
        unsubscribeRequests = onSnapshot(
          query(
            collection(db, "leave_requests"),
            where("employee_profile_id", "==", profile.id),
            where("employee_user_id", "==", profile.user_id),
            where(
              "workplace_warehouse_id",
              "==",
              profile.workplace_warehouse_id,
            ),
            where("is_deleted", "==", false),
            orderBy("created_at", "desc"),
          ),
          (snapshot) => {
            setRequests(
              snapshot.docs.map(
                (document) =>
                  ({ id: document.id, ...document.data() }) as LeaveRequest,
              ),
            );
            setIsLoading(false);
            setError(null);
          },
          () => void loadFallback(),
        );
        unsubscribeApprovalTasks = onSnapshot(
          query(
            collection(db, "leave_approval_tasks"),
            where("employee_user_id", "==", profile.user_id),
            where(
              "workplace_warehouse_id",
              "==",
              profile.workplace_warehouse_id,
            ),
            where("is_deleted", "==", false),
          ),
          (snapshot) =>
            setApprovalTasks(
              snapshot.docs.map(
                (document) =>
                  ({
                    id: document.id,
                    ...document.data(),
                  }) as LeaveApprovalTask,
              ),
            ),
          (snapshotError) => {
            console.error(
              "[useMyLeaveRequests] approval timeline error:",
              snapshotError,
            );
            setApprovalTasks([]);
          },
        );
      }
      unsubscribeHolidays = onSnapshot(
        query(
          collection(db, "company_holidays"),
          where("is_deleted", "==", false),
          orderBy("holiday_date", "asc"),
        ),
        (snapshot) => {
          setHolidays(
            snapshot.docs.map(
              (document) =>
                ({ id: document.id, ...document.data() }) as CompanyHoliday,
            ),
          );
          if (!canReadRequests) setIsLoading(false);
        },
        () => void loadFallback(),
      );
    });
    return () => {
      unsubscribeMutation();
      unsubscribeAuth();
      unsubscribeRequests?.();
      unsubscribeHolidays?.();
      unsubscribeApprovalTasks?.();
    };
  }, [
    canReadRequests,
    canUseLeave,
    loadFallback,
    profile?.id,
    profile?.user_id,
    profile?.workplace_warehouse_id,
  ]);

  const createRequest = useCallback(
    async (input: CreateLeaveRequestInput) => {
      const request = await createMyLeaveRequest(
        input,
        labels.leaveRequestSaveError,
      );
      emitDataMutation(["leave_requests", "leave_balance_buckets"]);
      return request;
    },
    [labels.leaveRequestSaveError],
  );
  const submitRequest = useCallback(
    async (requestId: string) => {
      const request = await submitMyLeaveRequest(
        requestId,
        { action_time: new Date() },
        labels.leaveRequestSaveError,
      );
      emitDataMutation(["leave_requests", "leave_balance_buckets"]);
      return request;
    },
    [labels.leaveRequestSaveError],
  );
  const cancelRequest = useCallback(
    async (requestId: string, reason: string) => {
      const request = await cancelMyLeaveRequest(
        requestId,
        { reason, action_time: new Date() },
        labels.leaveRequestSaveError,
      );
      emitDataMutation(["leave_requests", "leave_balance_buckets"]);
      return request;
    },
    [labels.leaveRequestSaveError],
  );
  const addHoliday = useCallback(
    async (input: UpsertCompanyHolidayInput) => {
      const holiday = await createCompanyHoliday(
        input,
        labels.holidaySaveError,
      );
      emitDataMutation(["company_holidays"]);
      return holiday;
    },
    [labels.holidaySaveError],
  );
  const removeHoliday = useCallback(
    async (holidayId: string) => {
      const holiday = await deleteCompanyHoliday(
        holidayId,
        new Date(),
        labels.holidaySaveError,
      );
      emitDataMutation(["company_holidays"]);
      return holiday;
    },
    [labels.holidaySaveError],
  );

  return {
    requests,
    holidays,
    approvalTasks,
    isLoading,
    error,
    createRequest,
    submitRequest,
    cancelRequest,
    addHoliday,
    removeHoliday,
  };
}
