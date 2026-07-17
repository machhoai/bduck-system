"use client";

import { useCallback, useEffect } from "react";
import {
  onIdTokenChanged,
  signOut,
  type User as FirebaseUser,
} from "firebase/auth";
import type { UserWarehouseRole } from "@bduck/shared-types";
import { auth } from "@/lib/firebase";
import { isolateClientDataForAccount } from "@/lib/clientDataIsolation";
import { useUserStore } from "@/stores/useUserStore";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://api.wms.localhost";
const SESSION_VALIDATION_DEDUPE_MS = 60_000;

let lastSessionSyncAt = 0;
const sessionSyncPromises = new Map<string, Promise<void>>();

async function readJson(response: Response) {
  return response.json().catch(() => null);
}

function logSessionSyncError(error: unknown) {
  console.warn("[AuthSessionProvider] session sync failed:", error);
}

export default function AuthSessionProvider() {
  const setAuthData = useUserStore((state) => state.setAuthData);
  const beginAuthVerification = useUserStore(
    (state) => state.beginAuthVerification,
  );
  const clearAuth = useUserStore((state) => state.clearAuth);

  const syncBackendSession = useCallback(
    async (firebaseUser: FirebaseUser, forceTokenRefresh = false) => {
      if (
        !forceTokenRefresh &&
        Date.now() - lastSessionSyncAt < SESSION_VALIDATION_DEDUPE_MS
      ) {
        return;
      }
      const existingSync = sessionSyncPromises.get(firebaseUser.uid);
      if (existingSync) return existingSync;

      const sessionSyncPromise = (async () => {
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
            auth.currentUser?.uid === firebaseUser.uid &&
            [401, 403, 404].includes(response.status)
          ) {
            clearAuth();
            await isolateClientDataForAccount(null);
            await signOut(auth).catch(() => undefined);
          }
          throw new Error(
            payload?.messages?.vi || "Khong the dong bo phien dang nhap.",
          );
        }
        if (
          auth.currentUser?.uid !== firebaseUser.uid ||
          payload?.data?.user?.id !== firebaseUser.uid
        ) {
          return;
        }

        const activeAssignments = (
          (payload?.data?.roles || []) as UserWarehouseRole[]
        ).filter((role) => role.is_active);
        const roleIds = Array.from(
          new Set(activeAssignments.map((role) => role.role_id)),
        );
        setAuthData(payload.data.user, roleIds, activeAssignments);
        lastSessionSyncAt = Date.now();
      })().finally(() => {
        sessionSyncPromises.delete(firebaseUser.uid);
      });
      sessionSyncPromises.set(firebaseUser.uid, sessionSyncPromise);
      return sessionSyncPromise;
    },
    [clearAuth, setAuthData],
  );

  useEffect(() => {
    return onIdTokenChanged(auth, (firebaseUser) => {
      if (!firebaseUser) {
        lastSessionSyncAt = 0;
        clearAuth();
        void isolateClientDataForAccount(null).catch(logSessionSyncError);
        return;
      }
      beginAuthVerification(firebaseUser.uid);
      void isolateClientDataForAccount(firebaseUser.uid)
        .then(() => syncBackendSession(firebaseUser, true))
        .catch(logSessionSyncError);
    });
  }, [beginAuthVerification, clearAuth, syncBackendSession]);

  useEffect(() => {
    const validateCurrentSession = () => {
      if (!auth.currentUser) return;
      void syncBackendSession(auth.currentUser).catch(logSessionSyncError);
    };
    const validateOnVisible = () => {
      if (document.visibilityState === "visible") validateCurrentSession();
    };
    window.addEventListener("focus", validateCurrentSession);
    window.addEventListener("online", validateCurrentSession);
    document.addEventListener("visibilitychange", validateOnVisible);
    return () => {
      window.removeEventListener("focus", validateCurrentSession);
      window.removeEventListener("online", validateCurrentSession);
      document.removeEventListener("visibilitychange", validateOnVisible);
    };
  }, [syncBackendSession]);

  return null;
}
