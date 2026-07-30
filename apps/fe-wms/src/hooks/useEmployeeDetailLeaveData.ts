"use client";

import type {
  EmployeeProfile,
  LeaveBalanceSummary,
  LeaveRequest,
} from "@bduck/shared-types";
import { useCallback, useEffect, useState } from "react";

import {
  fetchCompanyLeaveRequests,
  fetchEmployeeLeaveBalance,
  fetchMyLeaveBalance,
  fetchMyLeaveRequests,
} from "@/api/leaveApi";
import { subscribeDataMutation } from "@/lib/dataInvalidation";

type EmployeeDetailLeaveDataOptions = {
  profile: EmployeeProfile;
  enabled: boolean;
  isSelf: boolean;
  canReadBalance: boolean;
  canReadRequests: boolean;
  balanceErrorMessage: string;
  requestsErrorMessage: string;
};

export function useEmployeeDetailLeaveData({
  profile,
  enabled,
  isSelf,
  canReadBalance,
  canReadRequests,
  balanceErrorMessage,
  requestsErrorMessage,
}: EmployeeDetailLeaveDataOptions) {
  const [balance, setBalance] = useState<LeaveBalanceSummary | null>(null);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [balanceError, setBalanceError] = useState("");
  const [requestsError, setRequestsError] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!enabled) return;

    setLoading(true);
    const [balanceResult, requestsResult] = await Promise.allSettled([
      canReadBalance
        ? isSelf
          ? fetchMyLeaveBalance(balanceErrorMessage)
          : fetchEmployeeLeaveBalance(profile.id, balanceErrorMessage)
        : Promise.resolve(null),
      canReadRequests
        ? isSelf
          ? fetchMyLeaveRequests(requestsErrorMessage)
          : fetchCompanyLeaveRequests(requestsErrorMessage)
        : Promise.resolve([]),
    ]);

    if (balanceResult.status === "fulfilled") {
      setBalance(balanceResult.value);
      setBalanceError("");
    } else {
      setBalance(null);
      setBalanceError(balanceErrorMessage);
    }

    if (requestsResult.status === "fulfilled") {
      const scopedRequests = requestsResult.value.map((item) =>
        "request" in item ? item.request : item,
      );
      setRequests(
        scopedRequests.filter(
          (request) => request.employee_profile_id === profile.id,
        ),
      );
      setRequestsError("");
    } else {
      setRequests([]);
      setRequestsError(requestsErrorMessage);
    }
    setLoading(false);
  }, [
    balanceErrorMessage,
    canReadBalance,
    canReadRequests,
    enabled,
    isSelf,
    profile.id,
    requestsErrorMessage,
  ]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!enabled) return;
    return subscribeDataMutation(
      [
        "leave_balance_buckets",
        "leave_ledger_entries",
        "leave_requests",
      ],
      () => {
        void load();
      },
    );
  }, [enabled, load]);

  return {
    balance,
    requests,
    balanceError,
    requestsError,
    loading,
    reload: load,
  };
}
