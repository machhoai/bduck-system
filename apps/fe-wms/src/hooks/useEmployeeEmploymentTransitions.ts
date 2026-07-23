"use client";

import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { useCallback, useEffect, useState } from "react";
import type {
  CancelEmployeeEmploymentTransitionInput,
  CreateEmployeeEmploymentTransitionInput,
  EmployeeEmploymentTransition,
} from "@bduck/shared-types";
import {
  emitDataMutation,
  subscribeDataMutation,
} from "@/lib/dataInvalidation";
import { auth, db } from "@/lib/firebase";
import { useTranslation } from "@/lib/i18n";
import { createDetailedApiError } from "@/utils/apiError";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://api.wms.localhost";

const request = async (
  path: string,
  fallbackMessage: string,
  init: RequestInit = {},
): Promise<unknown> => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: init.body ? { "Content-Type": "application/json" } : undefined,
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.success) {
    throw createDetailedApiError(response, body, fallbackMessage);
  }
  return body.data;
};

export function useEmployeeEmploymentTransitions(
  employeeProfileId: string | null,
  workplaceId: string | null,
) {
  const { t } = useTranslation();
  const loadErrorMessage = t.employeeManagement.employment.loadError;
  const [transitions, setTransitions] = useState<
    EmployeeEmploymentTransition[]
  >([]);
  const [isLoading, setIsLoading] = useState(Boolean(employeeProfileId));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!employeeProfileId || !workplaceId) {
      setTransitions([]);
      setIsLoading(false);
      setError(null);
      return;
    }
    const abortController = new AbortController();
    let unsubscribeSnapshot: (() => void) | undefined;
    let disposed = false;

    const loadFallback = async () => {
      try {
        const data = (await request(
          `/api/employee-profiles/${employeeProfileId}/employment-transitions`,
          loadErrorMessage,
          { signal: abortController.signal },
        )) as EmployeeEmploymentTransition[];
        if (!disposed) {
          setTransitions(data);
          setError(null);
        }
      } catch (loadError) {
        if (!disposed) {
          setError(
            loadError instanceof Error ? loadError.message : loadErrorMessage,
          );
        }
      } finally {
        if (!disposed) setIsLoading(false);
      }
    };

    const unsubscribeMutation = subscribeDataMutation(
      ["employee_employment_transitions", "employee_profiles"],
      () => void loadFallback(),
    );
    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      unsubscribeSnapshot?.();
      if (!firebaseUser) {
        void loadFallback();
        return;
      }
      unsubscribeSnapshot = onSnapshot(
        query(
          collection(db, "employee_employment_transitions"),
          where("employee_profile_id", "==", employeeProfileId),
          where("workplace_warehouse_id", "==", workplaceId),
          where("is_deleted", "==", false),
          orderBy("effective_date", "desc"),
        ),
        (snapshot) => {
          if (disposed) return;
          setTransitions(
            snapshot.docs.map(
              (document) =>
                ({
                  ...document.data(),
                  id: document.id,
                }) as EmployeeEmploymentTransition,
            ),
          );
          setIsLoading(false);
          setError(null);
        },
        () => void loadFallback(),
      );
    });
    return () => {
      disposed = true;
      abortController.abort();
      unsubscribeMutation();
      unsubscribeAuth();
      unsubscribeSnapshot?.();
    };
  }, [employeeProfileId, loadErrorMessage, workplaceId]);

  const createTransition = useCallback(
    async (input: CreateEmployeeEmploymentTransitionInput) => {
      if (!employeeProfileId) return;
      const result = await request(
        `/api/employee-profiles/${employeeProfileId}/employment-transitions`,
        loadErrorMessage,
        { method: "POST", body: JSON.stringify(input) },
      );
      emitDataMutation([
        "employee_employment_transitions",
        "employee_profiles",
        "audit_logs",
      ]);
      return result;
    },
    [employeeProfileId, loadErrorMessage],
  );

  const cancelTransition = useCallback(
    async (
      transitionId: string,
      input: CancelEmployeeEmploymentTransitionInput,
    ) => {
      const result = await request(
        `/api/employee-profiles/employment-transitions/${transitionId}/cancel`,
        loadErrorMessage,
        { method: "POST", body: JSON.stringify(input) },
      );
      emitDataMutation([
        "employee_employment_transitions",
        "employee_profiles",
        "audit_logs",
      ]);
      return result;
    },
    [loadErrorMessage],
  );

  return {
    transitions,
    isLoading,
    error,
    createTransition,
    cancelTransition,
  };
}
