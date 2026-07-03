"use client";

import { useCallback, useEffect } from "react";
import {
  onAuthStateChanged,
  signOut,
  type User as FirebaseUser,
} from "firebase/auth";
import type { UserWarehouseRole } from "@bduck/shared-types";
import { auth } from "@/lib/firebase";
import { useUserStore } from "@/stores/useUserStore";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://api.wms.localhost";

const SESSION_REFRESH_INTERVAL_MS = 1000 * 60 * 60 * 12;

let lastSessionSyncAt = 0;
let sessionSyncPromise: Promise<void> | null = null;

async function readJson(response: Response) {
  return response.json().catch(() => null);
}

function logSessionSyncError(error: unknown) {
  console.warn("[AuthSessionProvider] session sync failed:", error);
}

export default function AuthSessionProvider() {
  const setAuthData = useUserStore((state) => state.setAuthData);
  const clearAuth = useUserStore((state) => state.clearAuth);

  const syncBackendSession = useCallback(
    async (firebaseUser: FirebaseUser, forceTokenRefresh = false) => {
      const now = Date.now();
      if (
        !forceTokenRefresh &&
        now - lastSessionSyncAt < SESSION_REFRESH_INTERVAL_MS
      ) {
        return;
      }

      if (sessionSyncPromise) {
        return sessionSyncPromise;
      }

      sessionSyncPromise = (async () => {
        const idToken = await firebaseUser.getIdToken(forceTokenRefresh);
        const response = await fetch(`${API_BASE_URL}/api/auth/sessionLogin`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken }),
        });

        const payload = await readJson(response);

        if (!response.ok) {
          if (
            response.status === 401 ||
            response.status === 403 ||
            response.status === 404
          ) {
            clearAuth();
            await signOut(auth).catch(() => undefined);
          }
          throw new Error(
            payload?.messages?.vi || "Khong the dong bo phien dang nhap.",
          );
        }

        const activeAssignments = ((payload?.data?.roles || []) as UserWarehouseRole[])
          .filter((role) => role.is_active);
        const roleIds = activeAssignments
          .map((role) => role.role_id)
          .filter(
            (id: string, index: number, all: string[]) =>
              all.indexOf(id) === index,
          );

        setAuthData(
          payload.data.user,
          payload.data.permissions,
          roleIds,
          activeAssignments,
        );
        lastSessionSyncAt = Date.now();
      })().finally(() => {
        sessionSyncPromise = null;
      });

      return sessionSyncPromise;
    },
    [clearAuth, setAuthData],
  );

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (!firebaseUser) {
        lastSessionSyncAt = 0;
        clearAuth();
        return;
      }

      void syncBackendSession(firebaseUser, true).catch(logSessionSyncError);
    });

    return unsubscribe;
  }, [clearAuth, syncBackendSession]);

  useEffect(() => {
    const refreshCurrentSession = () => {
      const firebaseUser = auth.currentUser;
      if (!firebaseUser) return;

      void syncBackendSession(firebaseUser).catch(logSessionSyncError);
    };

    const intervalId = window.setInterval(
      refreshCurrentSession,
      SESSION_REFRESH_INTERVAL_MS,
    );

    const refreshOnVisible = () => {
      if (document.visibilityState === "visible") {
        refreshCurrentSession();
      }
    };

    window.addEventListener("focus", refreshCurrentSession);
    window.addEventListener("online", refreshCurrentSession);
    document.addEventListener("visibilitychange", refreshOnVisible);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refreshCurrentSession);
      window.removeEventListener("online", refreshCurrentSession);
      document.removeEventListener("visibilitychange", refreshOnVisible);
    };
  }, [syncBackendSession]);

  return null;
}
