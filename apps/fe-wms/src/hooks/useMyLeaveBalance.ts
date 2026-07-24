"use client";

import type {
  EmployeeProfile,
  LeaveBalanceBucket,
  LeaveBalanceSummary,
  LeaveLedgerEntry,
} from "@bduck/shared-types";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import { subscribeDataMutation } from "@/lib/dataInvalidation";
import { auth, db } from "@/lib/firebase";
import { useTranslation } from "@/lib/i18n";
import { createDetailedApiError } from "@/utils/apiError";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://api.wms.localhost";

const summarize = (
  profileId: string,
  buckets: LeaveBalanceBucket[],
  entries: LeaveLedgerEntry[],
): LeaveBalanceSummary => {
  const totals = buckets.reduce(
    (value, bucket) => ({
      available_units: value.available_units + bucket.available_units,
      held_units: value.held_units + bucket.held_units,
      used_units: value.used_units + bucket.used_units,
      pending_probation_units:
        value.pending_probation_units + bucket.pending_probation_units,
      expired_units: value.expired_units + bucket.expired_units,
    }),
    {
      available_units: 0,
      held_units: 0,
      used_units: 0,
      pending_probation_units: 0,
      expired_units: 0,
    },
  );
  return {
    employee_profile_id: profileId,
    as_of_date: new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Ho_Chi_Minh",
    }).format(new Date()),
    ...totals,
    buckets,
    recent_entries: entries,
  };
};

const fetchBalance = async (
  fallbackMessage: string,
  signal?: AbortSignal,
): Promise<LeaveBalanceSummary> => {
  const response = await fetch(`${API_BASE_URL}/api/leave/me/balance`, {
    credentials: "include",
    signal,
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.success) {
    throw createDetailedApiError(response, body, fallbackMessage);
  }
  return body.data as LeaveBalanceSummary;
};

export function useMyLeaveBalance(
  profile: EmployeeProfile | null,
  enabled: boolean,
) {
  const { t } = useTranslation();
  const fallbackMessage = (
    t as unknown as {
      employeeAdmin: { leaveBalanceLoadError: string };
    }
  ).employeeAdmin.leaveBalanceLoadError;
  const [summary, setSummary] = useState<LeaveBalanceSummary | null>(null);
  const [isLoading, setIsLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !profile?.user_id) {
      setSummary(null);
      setIsLoading(false);
      setError(null);
      return;
    }
    const abortController = new AbortController();
    let disposed = false;
    let unsubscribeBuckets: (() => void) | undefined;
    let unsubscribeEntries: (() => void) | undefined;
    let bucketData: LeaveBalanceBucket[] | null = null;
    let entryData: LeaveLedgerEntry[] | null = null;

    setIsLoading(true);
    const publishRealtime = () => {
      if (disposed || !bucketData || !entryData) return;
      setSummary(summarize(profile.id, bucketData, entryData));
      setIsLoading(false);
      setError(null);
    };
    const loadFallback = async () => {
      try {
        const data = await fetchBalance(
          fallbackMessage,
          abortController.signal,
        );
        if (!disposed) {
          setSummary(data);
          setError(null);
        }
      } catch (loadError) {
        if (!disposed) {
          console.error("[useMyLeaveBalance] load error:", loadError);
          setError(
            loadError instanceof Error ? loadError.message : fallbackMessage,
          );
        }
      } finally {
        if (!disposed) setIsLoading(false);
      }
    };

    const unsubscribeMutation = subscribeDataMutation(
      ["leave_balance_buckets", "leave_ledger_entries"],
      () => void loadFallback(),
    );
    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      unsubscribeBuckets?.();
      unsubscribeEntries?.();
      if (!firebaseUser) {
        void loadFallback();
        return;
      }
      const selfConstraints = [
        where("employee_profile_id", "==", profile.id),
        where("employee_user_id", "==", profile.user_id),
        where("workplace_warehouse_id", "==", profile.workplace_warehouse_id),
      ];
      unsubscribeBuckets = onSnapshot(
        query(
          collection(db, "leave_balance_buckets"),
          ...selfConstraints,
          where("is_deleted", "==", false),
          orderBy("leave_year", "desc"),
        ),
        (snapshot) => {
          bucketData = snapshot.docs.map(
            (document) =>
              ({ id: document.id, ...document.data() }) as LeaveBalanceBucket,
          );
          publishRealtime();
        },
        () => void loadFallback(),
      );
      unsubscribeEntries = onSnapshot(
        query(
          collection(db, "leave_ledger_entries"),
          ...selfConstraints,
          orderBy("posting_date", "desc"),
          limit(50),
        ),
        (snapshot) => {
          entryData = snapshot.docs.map(
            (document) =>
              ({ id: document.id, ...document.data() }) as LeaveLedgerEntry,
          );
          publishRealtime();
        },
        () => void loadFallback(),
      );
    });
    return () => {
      disposed = true;
      abortController.abort();
      unsubscribeMutation();
      unsubscribeAuth();
      unsubscribeBuckets?.();
      unsubscribeEntries?.();
    };
  }, [
    enabled,
    fallbackMessage,
    profile?.id,
    profile?.user_id,
    profile?.workplace_warehouse_id,
  ]);

  return { summary, isLoading, error };
}
