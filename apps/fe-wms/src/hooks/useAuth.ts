import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
} from "firebase/auth";
import { gooeyToast } from "goey-toast";
import { useState } from "react";
import { auth } from "../lib/firebase";
import { useUserStore } from "../stores/useUserStore";
import { useMfaStore } from "../stores/useMfaStore";
import { createDetailedApiError } from "@/utils/apiError";
import { useTranslation } from "@/lib/i18n";
import { AUTH_TOAST_TEXT } from "@/lib/i18n/componentTranslations";
import { isolateClientDataForAccount } from "@/lib/clientDataIsolation";
import { buildMaterializedPermissions } from "@/lib/accessSnapshotPolicy";
import type {
  UserAccessMetadata,
  UserFacilityAccessGrant,
} from "@bduck/shared-types";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://api.wms.localhost";

type LoginResult =
  | { ok: true }
  | { ok: false; reason: "wrong-password" | "unknown" };

function getAuthErrorCode(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) return "";
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : "";
}

function isWrongPasswordError(error: unknown) {
  return [
    "auth/wrong-password",
    "auth/invalid-password",
    "auth/invalid-credential",
    "auth/invalid-login-credentials",
  ].includes(getAuthErrorCode(error));
}

export const useAuth = () => {
  const [isLoading, setIsLoading] = useState(false);
  const setAuthData = useUserStore((state) => state.setAuthData);
  const clearAuth = useUserStore((state) => state.clearAuth);
  const { lang } = useTranslation();
  const copy = AUTH_TOAST_TEXT[lang === "zh" ? "zh" : "vi"];

  const login = async (
    identifier: string,
    password: string,
  ): Promise<LoginResult> => {
    setIsLoading(true);

    const loginAction = async () => {
      const resolveResponse = await fetch(
        `${API_BASE_URL}/api/auth/login/resolve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ identifier }),
        },
      );
      const resolveBody = await resolveResponse.json().catch(() => null);

      if (!resolveResponse.ok || !resolveBody?.data?.email) {
        throw { code: "auth/invalid-credential" };
      }

      const userCredential = await signInWithEmailAndPassword(
        auth,
        resolveBody.data.email,
        password,
      );
      const idToken = await userCredential.user.getIdToken();

      const response = await fetch(`${API_BASE_URL}/api/auth/sessionLogin`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        await firebaseSignOut(auth);
        throw createDetailedApiError(
          response,
          errorData,
          copy.loginSystemFallback,
        );
      }

      const { data, messages } = await response.json();
      const activeAssignments = (data.roles || []).filter(
        (r: any) => r.is_active,
      );
      // Keep unique role_ids for compatibility with existing Firestore queries.
      const roleIds = activeAssignments
        .map((r: any) => r.role_id)
        .filter(
          (id: string, i: number, arr: string[]) => arr.indexOf(id) === i,
        );
      await isolateClientDataForAccount(data.user.id);
      const metadata = data.access?.metadata as UserAccessMetadata | undefined;
      const grants = (data.access?.grants || []) as UserFacilityAccessGrant[];
      if (!metadata?.active_version_id) {
        await firebaseSignOut(auth);
        throw new Error("Phan hoi dang nhap thieu snapshot phan quyen.");
      }
      const permissions = buildMaterializedPermissions(metadata, grants);
      setAuthData(data.user, roleIds, activeAssignments);
      useUserStore
        .getState()
        .applyAccessSnapshot(
          metadata.access_version,
          metadata.active_version_id,
          permissions,
        );

      // Lock screen on login
      useMfaStore.getState().lockScreen();

      return messages;
    };

    const actionPromise = loginAction();
    gooeyToast.promise(actionPromise, {
      loading: copy.loginLoading,
      success: (msgs) => msgs?.[lang] || copy.loginSuccess,
      error: copy.loginError,
      description: {
        success: copy.loginSuccessDescription,
        error: copy.loginErrorDescription,
      },
      action: {
        error: {
          label: copy.retry,
          onClick: () => {
            void login(identifier, password);
          },
        },
      },
    });

    try {
      await actionPromise;
      return { ok: true };
    } catch (error) {
      console.error("[useAuth] login failed:", error);
      return {
        ok: false,
        reason: isWrongPasswordError(error) ? "wrong-password" : "unknown",
      };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);

    const logoutAction = async () => {
      let backendSessionCleared = true;

      try {
        const response = await fetch(`${API_BASE_URL}/api/auth/logout`, {
          method: "POST",
          credentials: "include",
        });

        backendSessionCleared = response.ok;
      } catch (error) {
        backendSessionCleared = false;
        console.error("[useAuth] logout backend request failed:", error);
      }

      await firebaseSignOut(auth);
      clearAuth();
      await isolateClientDataForAccount(null);

      return { backendSessionCleared };
    };

    const actionPromise = logoutAction();
    gooeyToast.promise(actionPromise, {
      loading: copy.logoutLoading,
      success: ({ backendSessionCleared }) =>
        backendSessionCleared ? copy.logoutSuccess : copy.logoutLocalSuccess,
      error: copy.logoutError,
      description: {
        success: copy.logoutSuccessDescription,
        error: copy.logoutErrorDescription,
      },
    });

    try {
      await actionPromise;
    } catch (error) {
      console.error("[useAuth] logout failed:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const resetPassword = async (email: string) => {
    setIsLoading(true);
    const resetAction = async () => {
      const response = await fetch(
        `${API_BASE_URL}/api/auth/password-reset/request`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        },
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw createDetailedApiError(
          response,
          errorData,
          copy.resetSendFallback,
        );
      }
      const data = await response.json();
      return data.messages;
    };

    const actionPromise = resetAction();
    gooeyToast.promise(actionPromise, {
      loading: copy.resetLoading,
      success: (msgs) => msgs?.[lang] || copy.resetSuccess,
      error: (err: any) =>
        err?.statusCode === 429 ? copy.resetPending : copy.resetError,
      description: {
        success: copy.resetSuccessDescription,
        error: (err: any) =>
          err?.messages?.[lang] || copy.resetErrorDescription,
      },
    });

    try {
      await actionPromise;
    } catch (error) {
      console.error("[useAuth] reset password failed:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return { login, logout, resetPassword, isLoading };
};
