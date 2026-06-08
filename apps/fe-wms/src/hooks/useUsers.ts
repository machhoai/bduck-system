"use client";

import { onAuthStateChanged } from "firebase/auth";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { useCallback, useEffect, useState } from "react";
import type { User, UserWarehouseRole } from "@bduck/shared-types";
import {
  emitDataMutation,
  subscribeDataMutation,
} from "@/lib/dataInvalidation";
import { auth, db } from "@/lib/firebase";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://api.wms.localhost";

export interface UserWithAssignments extends User {
  assignments: UserWarehouseRole[];
}

async function fetchUsersFromApi(signal?: AbortSignal) {
  const response = await fetch(`${API_BASE_URL}/api/users`, {
    method: "GET",
    credentials: "include",
    signal,
  });
  const body = await response.json().catch(() => null);

  if (!response.ok || !body?.success) {
    throw new Error(
      body?.messages?.vi || "Không thể tải danh sách người dùng.",
    );
  }

  return (body.data || []) as UserWithAssignments[];
}

async function mutateUser(
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
    throw new Error(body?.messages?.vi || "Không thể lưu người dùng.");
  }

  return body;
}

export function useUsers() {
  const [users, setUsers] = useState<UserWithAssignments[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const abortController = new AbortController();
    let unsubscribeUsers: (() => void) | undefined;
    let unsubscribeAssignments: (() => void) | undefined;
    let isDisposed = false;
    let latestUsers: User[] = [];
    let latestAssignments: UserWarehouseRole[] = [];

    const publish = () => {
      const assignmentsByUser = latestAssignments.reduce<
        Record<string, UserWarehouseRole[]>
      >((acc, assignment) => {
        acc[assignment.user_id] = acc[assignment.user_id] || [];
        acc[assignment.user_id].push(assignment);
        return acc;
      }, {});

      setUsers(
        latestUsers.map((user) => ({
          ...user,
          assignments: assignmentsByUser[user.id] || [],
        })),
      );
      setIsLoading(false);
      setError(null);
    };

    const loadApiFallback = async () => {
      try {
        const data = await fetchUsersFromApi(abortController.signal);
        if (isDisposed) return;
        setUsers(data);
        setError(null);
      } catch (apiError) {
        if (isDisposed) return;
        console.error("[useUsers] API fallback error:", apiError);
        setUsers([]);
        setError(
          apiError instanceof Error
            ? apiError.message
            : "Không thể tải danh sách người dùng.",
        );
      } finally {
        if (!isDisposed) setIsLoading(false);
      }
    };

    const unsubscribeMutation = subscribeDataMutation(
      ["users", "user_warehouse_roles"],
      () => {
        void loadApiFallback();
      },
    );

    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      unsubscribeUsers?.();
      unsubscribeAssignments?.();
      unsubscribeUsers = undefined;
      unsubscribeAssignments = undefined;

      if (!firebaseUser) {
        void loadApiFallback();
        return;
      }

      unsubscribeUsers = onSnapshot(
        query(collection(db, "users"), where("is_deleted", "==", false)),
        (snapshot) => {
          if (isDisposed) return;
          latestUsers = snapshot.docs.map((doc) => ({
            ...doc.data(),
            id: doc.id,
          })) as User[];
          publish();
        },
        () => void loadApiFallback(),
      );

      unsubscribeAssignments = onSnapshot(
        query(collection(db, "user_warehouse_roles")),
        (snapshot) => {
          if (isDisposed) return;
          latestAssignments = snapshot.docs.map((doc) => ({
            ...doc.data(),
            id: doc.id,
          })) as UserWarehouseRole[];
          publish();
        },
        () => void loadApiFallback(),
      );
    });

    return () => {
      isDisposed = true;
      abortController.abort();
      unsubscribeMutation();
      unsubscribeAuth();
      unsubscribeUsers?.();
      unsubscribeAssignments?.();
    };
  }, []);

  const createUser = useCallback(async (payload: unknown) => {
    const result = await mutateUser("/api/users", "POST", payload);
    emitDataMutation(["users", "user_warehouse_roles", "audit_logs"]);
    return result;
  }, []);
  const updateUser = useCallback(async (id: string, payload: unknown) => {
    const result = await mutateUser(`/api/users/${id}`, "PUT", payload);
    emitDataMutation(["users", "user_warehouse_roles", "audit_logs"]);
    return result;
  }, []);
  const deleteUser = useCallback(async (id: string) => {
    const result = await mutateUser(`/api/users/${id}`, "DELETE");
    emitDataMutation(["users", "user_warehouse_roles", "audit_logs"]);
    return result;
  }, []);
  const resendInvitation = useCallback(async (id: string) => {
    const result = await mutateUser(`/api/users/${id}/invitation`, "POST");
    emitDataMutation(["audit_logs"]);
    return result;
  }, []);

  return {
    users,
    isLoading,
    error,
    createUser,
    updateUser,
    deleteUser,
    resendInvitation,
  };
}
