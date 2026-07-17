"use client";

import { onAuthStateChanged } from "firebase/auth";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { EmployeeProfile } from "@bduck/shared-types";
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
import { createDetailedApiError } from "@/utils/apiError";
import { getAnyFacilityScope } from "@/utils/facilityPermissionScope";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://api.wms.localhost";

async function fetchEmployeeProfilesFromApi(signal?: AbortSignal) {
  const response = await fetch(`${API_BASE_URL}/api/employee-profiles`, {
    method: "GET",
    credentials: "include",
    signal,
  });
  const body = await response.json().catch(() => null);

  if (!response.ok || !body?.success) {
    throw createDetailedApiError(
      response,
      body,
      "Khong the tai danh sach ho so nhan vien.",
    );
  }

  return (body.data || []) as EmployeeProfile[];
}

async function fetchMyEmployeeProfileFromApi(signal?: AbortSignal) {
  const response = await fetch(`${API_BASE_URL}/api/employee-profiles/me`, {
    method: "GET",
    credentials: "include",
    signal,
  });
  const body = await response.json().catch(() => null);

  if (!response.ok || !body?.success) {
    throw createDetailedApiError(
      response,
      body,
      "Khong the tai ho so ca nhan.",
    );
  }

  return (body.data || null) as EmployeeProfile | null;
}

async function mutateEmployeeProfile(
  path: string,
  method: "POST" | "PUT" | "DELETE",
  payload?: unknown,
) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    credentials: "include",
    headers: payload ? { "Content-Type": "application/json" } : undefined,
    body: payload ? JSON.stringify(payload) : undefined,
  });
  const body = await response.json().catch(() => null);

  if (!response.ok || !body?.success) {
    throw createDetailedApiError(
      response,
      body,
      "Khong the luu ho so nhan vien.",
    );
  }

  return body;
}

export function useEmployeeProfiles() {
  const permissions = useUserStore((state) => state.permissions);
  const facilityScope = useMemo(
    () => getAnyFacilityScope(permissions),
    [permissions],
  );
  const [profiles, setProfiles] = useState<EmployeeProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const abortController = new AbortController();
    let unsubscribeSnapshot: (() => void) | undefined;
    let isDisposed = false;

    const loadApiFallback = async () => {
      try {
        const data = await fetchEmployeeProfilesFromApi(abortController.signal);
        if (isDisposed) return;
        setProfiles(data);
        setError(null);
      } catch (apiError) {
        if (isDisposed) return;
        console.error("[useEmployeeProfiles] API fallback error:", apiError);
        setProfiles([]);
        setError(
          apiError instanceof Error
            ? apiError.message
            : "Khong the tai danh sach ho so nhan vien.",
        );
      } finally {
        if (!isDisposed) setIsLoading(false);
      }
    };

    const unsubscribeMutation = subscribeDataMutation(
      ["employee_profiles", "users", "audit_logs"],
      () => {
        void loadApiFallback();
      },
    );

    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      unsubscribeSnapshot?.();
      unsubscribeSnapshot = undefined;

      if (!firebaseUser) {
        void loadApiFallback();
        return;
      }

      unsubscribeSnapshot = subscribeToMergedQueries<EmployeeProfile>({
        queries: buildFacilityScopedQueries({
          db,
          collectionName: "employee_profiles",
          facilityField: "workplace_warehouse_id",
          scope: facilityScope,
          constraints: [where("is_deleted", "==", false)],
        }),
        mapDocument: (document) => ({
          ...document.data(),
          id: document.id,
        }) as EmployeeProfile,
        onData: (records) => {
          if (isDisposed) return;
          setProfiles(records);
          setIsLoading(false);
          setError(null);
        },
        onError: () => void loadApiFallback(),
      });
    });

    return () => {
      isDisposed = true;
      abortController.abort();
      unsubscribeMutation();
      unsubscribeAuth();
      unsubscribeSnapshot?.();
    };
  }, [facilityScope]);

  const createProfile = useCallback(async (payload: unknown) => {
    const result = await mutateEmployeeProfile(
      "/api/employee-profiles",
      "POST",
      payload,
    );
    emitDataMutation([
      "employee_profiles",
      "users",
      "user_warehouse_roles",
      "audit_logs",
    ]);
    return result;
  }, []);

  const updateProfile = useCallback(async (id: string, payload: unknown) => {
    const result = await mutateEmployeeProfile(
      `/api/employee-profiles/${id}`,
      "PUT",
      payload,
    );
    emitDataMutation(["employee_profiles", "audit_logs"]);
    return result;
  }, []);

  const deleteProfile = useCallback(async (id: string) => {
    const result = await mutateEmployeeProfile(
      `/api/employee-profiles/${id}`,
      "DELETE",
    );
    emitDataMutation(["employee_profiles", "audit_logs"]);
    return result;
  }, []);

  return {
    profiles,
    isLoading,
    error,
    createProfile,
    updateProfile,
    deleteProfile,
  };
}

export function useMyEmployeeProfile() {
  const currentUserId = useUserStore((state) => state.user?.id);
  const [profile, setProfile] = useState<EmployeeProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const abortController = new AbortController();
    let unsubscribeSnapshot: (() => void) | undefined;
    let isDisposed = false;

    const loadApiFallback = async () => {
      try {
        const data = await fetchMyEmployeeProfileFromApi(
          abortController.signal,
        );
        if (isDisposed) return;
        setProfile(data);
        setError(null);
      } catch (apiError) {
        if (isDisposed) return;
        console.error("[useMyEmployeeProfile] API fallback error:", apiError);
        setProfile(null);
        setError(
          apiError instanceof Error
            ? apiError.message
            : "Khong the tai ho so ca nhan.",
        );
      } finally {
        if (!isDisposed) setIsLoading(false);
      }
    };

    const unsubscribeMutation = subscribeDataMutation(
      ["employee_profiles", "users"],
      () => {
        void loadApiFallback();
      },
    );

    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      unsubscribeSnapshot?.();
      unsubscribeSnapshot = undefined;

      if (!firebaseUser || !currentUserId) {
        void loadApiFallback();
        return;
      }

      unsubscribeSnapshot = onSnapshot(
        query(
          collection(db, "employee_profiles"),
          where("user_id", "==", currentUserId),
          where("is_deleted", "==", false),
        ),
        (snapshot) => {
          if (isDisposed) return;
          const firstDoc = snapshot.docs[0];
          setProfile(
            firstDoc
              ? ({
                  ...firstDoc.data(),
                  id: firstDoc.id,
                } as EmployeeProfile)
              : null,
          );
          setIsLoading(false);
          setError(null);
        },
        () => void loadApiFallback(),
      );
    });

    return () => {
      isDisposed = true;
      abortController.abort();
      unsubscribeMutation();
      unsubscribeAuth();
      unsubscribeSnapshot?.();
    };
  }, [currentUserId]);

  return { profile, isLoading, error };
}
