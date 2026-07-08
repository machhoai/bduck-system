"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { app } from "@/lib/firebase";
import { createDetailedApiError } from "@/utils/apiError";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://api.wms.localhost";

const PUSH_TOKEN_STORAGE_KEY = "wms:fcm-push-token";
const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || "";

type PushPermissionState = NotificationPermission | "unsupported";

function getPlatform() {
  if (typeof navigator === "undefined") return null;
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  return nav.userAgentData?.platform || navigator.platform || null;
}

async function postPushToken(path: string, token: string, method: "POST" | "DELETE") {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token,
      platform: getPlatform(),
      user_agent: navigator.userAgent,
    }),
  });
  const body = await response.json().catch(() => null);

  if (!response.ok || !body?.success) {
    throw createDetailedApiError(
      response,
      body,
      "Khong the cap nhat token thong bao.",
    );
  }
}

async function getMessagingToken() {
  const messagingModule = await import("firebase/messaging");
  const messagingSupported = await messagingModule.isSupported();

  if (!messagingSupported) {
    return null;
  }

  const registration = await navigator.serviceWorker.register(
    "/firebase-messaging-sw.js",
    { scope: "/" },
  );
  const messaging = messagingModule.getMessaging(app);

  return messagingModule.getToken(messaging, {
    vapidKey: VAPID_KEY,
    serviceWorkerRegistration: registration,
  });
}

export function useDevicePushNotifications() {
  const [permission, setPermission] = useState<PushPermissionState>("default");
  const [isSupported, setIsSupported] = useState(false);
  const [hasToken, setHasToken] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  const isConfigured = VAPID_KEY.length > 0;

  useEffect(() => {
    let disposed = false;

    const detectSupport = async () => {
      const basicSupport =
        typeof window !== "undefined" &&
        "Notification" in window &&
        "serviceWorker" in navigator &&
        "PushManager" in window;

      if (!basicSupport) {
        if (!disposed) {
          setPermission("unsupported");
          setIsSupported(false);
        }
        return;
      }

      const { isSupported: messagingIsSupported } = await import("firebase/messaging");
      const supported = await messagingIsSupported();
      if (disposed) return;

      setIsSupported(supported && isConfigured);
      setPermission(Notification.permission);
      setHasToken(Boolean(localStorage.getItem(PUSH_TOKEN_STORAGE_KEY)));
    };

    void detectSupport();
    return () => {
      disposed = true;
    };
  }, [isConfigured]);

  const registerCurrentDevice = useCallback(async () => {
    if (!isSupported || !isConfigured) return null;

    const token = await getMessagingToken();
    if (!token) return null;

    await postPushToken("/api/notifications/push-token", token, "POST");
    localStorage.setItem(PUSH_TOKEN_STORAGE_KEY, token);
    setHasToken(true);
    setPermission(Notification.permission);
    return token;
  }, [isConfigured, isSupported]);

  useEffect(() => {
    if (!isSupported || permission !== "granted" || hasToken) return;
    void registerCurrentDevice().catch((error) => {
      console.error("[useDevicePushNotifications] auto-register failed:", error);
    });
  }, [hasToken, isSupported, permission, registerCurrentDevice]);

  useEffect(() => {
    if (!isSupported || permission !== "granted") return;

    let unsubscribe: (() => void) | undefined;
    void import("firebase/messaging")
      .then(({ getMessaging, onMessage }) => {
        const messaging = getMessaging(app);
        unsubscribe = onMessage(messaging, (payload) => {
          if (payload.data?.title) {
            console.info("[useDevicePushNotifications] foreground message:", payload);
          }
        });
      })
      .catch((error) => {
        console.error("[useDevicePushNotifications] onMessage failed:", error);
      });

    return () => {
      unsubscribe?.();
    };
  }, [isSupported, permission]);

  const requestPermission = useCallback(async () => {
    if (!isSupported || !isConfigured) {
      setPermission("unsupported");
      return "unsupported" as const;
    }

    setIsBusy(true);
    try {
      const nextPermission = await Notification.requestPermission();
      setPermission(nextPermission);
      if (nextPermission !== "granted") return nextPermission;

      await registerCurrentDevice();
      return nextPermission;
    } finally {
      setIsBusy(false);
    }
  }, [isConfigured, isSupported, registerCurrentDevice]);

  const unregisterCurrentDevice = useCallback(async () => {
    const token = localStorage.getItem(PUSH_TOKEN_STORAGE_KEY);
    if (!token) return;

    await postPushToken("/api/notifications/push-token", token, "DELETE");
    localStorage.removeItem(PUSH_TOKEN_STORAGE_KEY);
    setHasToken(false);
  }, []);

  const isEnabled = permission === "granted" && hasToken;
  const shouldShowButton = useMemo(() => {
    if (!isSupported || !isConfigured) return false;
    return !isEnabled;
  }, [isConfigured, isEnabled, isSupported]);

  return {
    permission,
    isBusy,
    isEnabled,
    isSupported,
    shouldShowButton,
    requestPermission,
    unregisterCurrentDevice,
  };
}
