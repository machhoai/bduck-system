"use client";

import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import { useCallback, useEffect, useState } from "react";
import type {
  NotificationDispatch,
  SendEmailNotificationPayload,
  SendInAppNotificationPayload,
} from "@bduck/shared-types";
import { emitDataMutation, subscribeDataMutation } from "@/lib/dataInvalidation";
import { auth, db } from "@/lib/firebase";
import { useUserStore } from "@/stores/useUserStore";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://api.wms.localhost";

interface UseNotificationSenderOptions {
  limit?: number;
}

function toDate(value: unknown): Date {
  if (value && typeof value === "object" && "toDate" in value) {
    const timestamp = value as { toDate: () => Date };
    return timestamp.toDate();
  }
  return value ? new Date(value as string | number | Date) : new Date();
}

function normalizeDispatch(data: Record<string, unknown>): NotificationDispatch {
  return {
    ...(data as unknown as NotificationDispatch),
    action_time: toDate(data.action_time),
    sync_time: toDate(data.sync_time),
    created_at: toDate(data.created_at),
    updated_at: toDate(data.updated_at),
  };
}

async function fetchDispatchesFromApi(
  limitCount: number,
  signal?: AbortSignal,
): Promise<NotificationDispatch[]> {
  const response = await fetch(
    `${API_BASE_URL}/api/notifications/dispatches?limit=${limitCount}`,
    {
      method: "GET",
      credentials: "include",
      signal,
    },
  );
  const body = await response.json().catch(() => null);

  if (!response.ok || !body?.success) {
    throw new Error(body?.messages?.vi || "Không thể tải lịch sử thông báo.");
  }

  return ((body.data || []) as Record<string, unknown>[]).map(normalizeDispatch);
}

async function postNotification<TPayload>(
  path: string,
  payload: TPayload,
): Promise<NotificationDispatch> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => null);

  if (!response.ok || !body?.success) {
    throw new Error(body?.messages?.vi || "Không thể gửi thông báo.");
  }

  return normalizeDispatch(body.data as Record<string, unknown>);
}

export function useNotificationSender(
  options: UseNotificationSenderOptions = {},
) {
  const dispatchLimit = options.limit || 30;
  const hasPermission = useUserStore((s) => s.hasPermission);
  const canReadHistory = hasPermission("notifications.read");
  const canSendInApp = hasPermission("notifications.send_in_app");
  const canSendEmail = hasPermission("notifications.send_email");
  const [dispatches, setDispatches] = useState<NotificationDispatch[]>([]);
  const [isLoading, setIsLoading] = useState(canReadHistory);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!canReadHistory) {
      setDispatches([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    const abortController = new AbortController();
    let unsubscribeSnapshot: (() => void) | undefined;
    let isDisposed = false;

    setIsLoading(true);

    const loadApiFallback = async () => {
      try {
        const data = await fetchDispatchesFromApi(
          dispatchLimit,
          abortController.signal,
        );
        if (isDisposed) return;
        setDispatches(data);
        setError(null);
      } catch (apiError) {
        if (isDisposed) return;
        console.error("[useNotificationSender] API fallback error:", apiError);
        setError(
          apiError instanceof Error
            ? apiError.message
            : "Không thể tải lịch sử thông báo.",
        );
      } finally {
        if (!isDisposed) setIsLoading(false);
      }
    };

    const unsubscribeMutation = subscribeDataMutation(
      "notification_dispatches",
      () => void loadApiFallback(),
    );

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      unsubscribeSnapshot?.();
      unsubscribeSnapshot = undefined;

      if (!user) {
        void loadApiFallback();
        return;
      }

      const dispatchQuery = query(
        collection(db, "notification_dispatches"),
        orderBy("created_at", "desc"),
        limit(dispatchLimit),
      );

      unsubscribeSnapshot = onSnapshot(
        dispatchQuery,
        (snapshot) => {
          if (isDisposed) return;
          const data = snapshot.docs.map((docSnap) =>
            normalizeDispatch({ ...docSnap.data(), id: docSnap.id }),
          );
          setDispatches(data);
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
  }, [canReadHistory, dispatchLimit]);

  const sendInAppNotification = useCallback(
    async (payload: SendInAppNotificationPayload) => {
      const dispatch = await postNotification(
        "/api/notifications/in-app",
        payload,
      );
      emitDataMutation(["in_app_notifications", "notification_dispatches"]);
      return dispatch;
    },
    [],
  );

  const sendEmailNotification = useCallback(
    async (payload: SendEmailNotificationPayload) => {
      const dispatch = await postNotification("/api/notifications/email", payload);
      emitDataMutation("notification_dispatches");
      return dispatch;
    },
    [],
  );

  return {
    dispatches,
    isLoading,
    error,
    canReadHistory,
    canSendInApp,
    canSendEmail,
    sendInAppNotification,
    sendEmailNotification,
  };
}
