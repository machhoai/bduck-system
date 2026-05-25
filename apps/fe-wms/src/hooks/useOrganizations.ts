"use client";

import { onAuthStateChanged } from "firebase/auth";
import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { useCallback, useEffect, useState } from "react";
import type { Organization } from "@bduck/shared-types";
import { auth, db } from "@/lib/firebase";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://api.wms.localhost";

async function fetchOrganizationsFromApi(signal?: AbortSignal) {
  const response = await fetch(`${API_BASE_URL}/api/organizations`, {
    method: "GET",
    credentials: "include",
    signal,
  });
  const body = await response.json().catch(() => null);

  if (!response.ok || !body?.success) {
    throw new Error(
      body?.messages?.vi || "Không thể tải danh sách tổ chức.",
    );
  }

  return (body.data || []) as Organization[];
}

async function callOrganizationApi(
  method: "POST" | "PUT" | "DELETE",
  id?: string,
  payload?: unknown,
) {
  const url = id
    ? `${API_BASE_URL}/api/organizations/${id}`
    : `${API_BASE_URL}/api/organizations`;

  const response = await fetch(url, {
    method,
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: payload ? JSON.stringify(payload) : undefined,
  });
  const body = await response.json().catch(() => null);

  if (!response.ok || !body?.success) {
    throw new Error(body?.messages?.vi || "Không thể lưu dữ liệu tổ chức.");
  }

  return body;
}

export function useOrganizations() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const abortController = new AbortController();
    let unsubscribeSnapshot: (() => void) | undefined;
    let isDisposed = false;

    const loadApiFallback = async () => {
      try {
        const data = await fetchOrganizationsFromApi(abortController.signal);
        if (isDisposed) return;
        setOrganizations(data);
        setError(null);
      } catch (apiError) {
        if (isDisposed) return;
        const message =
          apiError instanceof Error
            ? apiError.message
            : "Không thể tải danh sách tổ chức.";
        console.error("[useOrganizations] API fallback error:", apiError);
        setOrganizations([]);
        setError(message);
      } finally {
        if (!isDisposed) setLoading(false);
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

      const organizationsQuery = query(
        collection(db, "organizations"),
        where("is_deleted", "==", false),
        orderBy("name", "asc"),
      );

      unsubscribeSnapshot = onSnapshot(
        organizationsQuery,
        (snapshot) => {
          if (isDisposed) return;
          const data = snapshot.docs.map((doc) => ({
            ...doc.data(),
            id: doc.id,
          })) as Organization[];
          setOrganizations(data);
          setLoading(false);
          setError(null);
        },
        (snapshotError) => {
          console.warn("[useOrganizations] onSnapshot error:", snapshotError);
          void loadApiFallback();
        },
      );
    });

    return () => {
      isDisposed = true;
      abortController.abort();
      unsubscribeAuth();
      if (unsubscribeSnapshot) unsubscribeSnapshot();
    };
  }, []);

  const createOrganization = useCallback(
    (payload: unknown) => callOrganizationApi("POST", undefined, payload),
    [],
  );
  const updateOrganization = useCallback(
    (id: string, payload: unknown) => callOrganizationApi("PUT", id, payload),
    [],
  );
  const deleteOrganization = useCallback(
    (id: string) => callOrganizationApi("DELETE", id),
    [],
  );

  return {
    organizations,
    loading,
    error,
    createOrganization,
    updateOrganization,
    deleteOrganization,
  };
}
