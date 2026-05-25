"use client";

import { onAuthStateChanged } from "firebase/auth";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { useEffect, useState } from "react";
import type { Role } from "@bduck/shared-types";
import { auth, db } from "@/lib/firebase";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://api.wms.localhost";

async function fetchRolesFromApi(signal?: AbortSignal) {
  const response = await fetch(`${API_BASE_URL}/api/roles`, {
    method: "GET",
    credentials: "include",
    signal,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.messages?.vi || "Không thể tải danh sách role.");
  }

  const body = await response.json();
  return (body.data || []) as Role[];
}

async function mutateRole(
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

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.messages?.vi || "Không thể lưu role.");
  }

  return response.json();
}

export function useRoles() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const abortController = new AbortController();
    let unsubscribeSnapshot: (() => void) | undefined;
    let isDisposed = false;

    const loadApiFallback = async () => {
      try {
        const data = await fetchRolesFromApi(abortController.signal);
        if (isDisposed) return;
        setRoles(data);
        setError(null);
      } catch (apiError) {
        if (isDisposed) return;
        console.error("[useRoles] API fallback error:", apiError);
        setRoles([]);
        setError(
          apiError instanceof Error
            ? apiError.message
            : "Không thể tải danh sách role.",
        );
      } finally {
        if (!isDisposed) setIsLoading(false);
      }
    };

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
        unsubscribeSnapshot = undefined;
      }

      if (!user) {
        void loadApiFallback();
        return;
      }

      const rolesQuery = query(
        collection(db, "roles"),
        where("is_deleted", "==", false),
      );

      unsubscribeSnapshot = onSnapshot(
        rolesQuery,
        (snapshot) => {
          if (isDisposed) return;
          const data = snapshot.docs.map((doc) => ({
            ...doc.data(),
            id: doc.id,
          })) as Role[];
          setRoles(data);
          setIsLoading(false);
          setError(null);
        },
        () => void loadApiFallback(),
      );
    });

    return () => {
      isDisposed = true;
      abortController.abort();
      unsubscribeAuth();
      if (unsubscribeSnapshot) unsubscribeSnapshot();
    };
  }, []);

  return {
    roles,
    isLoading,
    error,
    createRole: (payload: unknown) => mutateRole("/api/roles", "POST", payload),
    updateRole: (id: string, payload: unknown) =>
      mutateRole(`/api/roles/${id}`, "PUT", payload),
    deleteRole: (id: string) => mutateRole(`/api/roles/${id}`, "DELETE"),
  };
}
