"use client";

/**
 * useNotifications — Realtime Firebase listener for in-app notifications
 *
 * LUẬT THÉP: No reload buttons. Notifications update via onSnapshot.
 *
 * Returns:
 * - notifications: All unread notifications for the current user
 * - unreadCount: Badge count for header bell icon
 * - markAsRead: Mark a single notification as read
 * - markAllAsRead: Mark all notifications as read
 * - loading: Skeleton loading state
 */

import { useEffect, useState, useMemo, useCallback } from "react";
import {
  collection,
  onSnapshot,
  query,
  where,
  orderBy,
  doc,
  updateDoc,
  writeBatch,
  getDocs,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useUserStore } from "@/stores/useUserStore";
import type { InAppNotification } from "@bduck/shared-types";
import { useTranslation } from "@/lib/i18n";

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

// ─────────────────────────────────────────────
// i18n TEMPLATE RESOLVER
// ─────────────────────────────────────────────

const TEMPLATE_LABELS: Record<string, { vi: string; zh: string }> = {
  "notification.voucher_approved": {
    vi: "Phiếu nhập kho đã được duyệt",
    zh: "入库单已审批通过",
  },
  "notification.voucher_rejected": {
    vi: "Phiếu nhập kho bị từ chối",
    zh: "入库单已被拒绝",
  },
  "notification.receiving_completed": {
    vi: "Phiên kiểm đếm đã hoàn thành",
    zh: "收货会话已完成",
  },
  "notification.workflow_update": {
    vi: "Quy trình đã được cập nhật",
    zh: "工作流已更新",
  },
  "notification.nonconformity_created": {
    vi: "Phát hiện chênh lệch — đã tạo biên bản NC",
    zh: "发现差异 — 已创建不合格报告",
  },
  "notification.voucher_completed": {
    vi: "Phiếu nhập kho đã hoàn thành",
    zh: "入库单已完成",
  },
};

export function resolveTemplate(
  templateKey: string,
  lang: "vi" | "zh" = "vi",
  params: Record<string, unknown> = {},
): string {
  const localizedTitle = params[`title_${lang}`];
  if (typeof localizedTitle === "string") return localizedTitle;
  if (templateKey === "notification.manual" && typeof params.title === "string") {
    return params.title;
  }

  return (
    TEMPLATE_LABELS[templateKey]?.[lang] ??
    TEMPLATE_LABELS["notification.workflow_update"]![lang]
  );
}

// ─────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────

interface UseNotificationsReturn {
  notifications: InAppNotification[];
  unreadCount: number;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  loading: boolean;
}

export function useNotifications(): UseNotificationsReturn {
  const [rawNotifications, setRawNotifications] = useState<
    InAppNotification[]
  >([]);
  const [loading, setLoading] = useState(true);
  const user = useUserStore((s) => s.user);
  const { lang } = useTranslation();

  useEffect(() => {
    if (!user?.id) {
      setRawNotifications([]);
      setLoading(false);
      return;
    }

    // Query: notifications for this user, not deleted, newest first
    const q = query(
      collection(db, "in_app_notifications"),
      where("target_user_id", "==", user.id),
      where("is_deleted", "==", false),
      orderBy("created_at", "desc"),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const notifs: InAppNotification[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          notifs.push({
            id: docSnap.id,
            target_user_id: data.target_user_id,
            target_role_id: data.target_role_id,
            template_key: data.template_key,
            template_params: data.template_params || {},
            channel: data.channel,
            title: resolveTemplate(
              data.template_key,
              lang,
              data.template_params || {},
            ),
            body:
              data.template_params?.[`body_${lang}`] ||
              data.body ||
              data.template_params?.body ||
              "",
            action_url: data.action_url || null,
            priority: data.priority || "NORMAL",
            source_instance_id: data.source_instance_id,
            source_entity_id: data.source_entity_id,
            source_entity_type: data.source_entity_type,
            created_by: data.created_by || null,
            is_read: data.is_read ?? false,
            read_at: data.read_at?.toDate?.() ?? null,
            is_deleted: data.is_deleted ?? false,
            created_at: data.created_at?.toDate?.() ?? new Date(data.created_at),
            updated_at:
              data.updated_at?.toDate?.() ??
              data.created_at?.toDate?.() ??
              new Date(data.created_at),
          } as InAppNotification);
        });
        setRawNotifications(notifs);
        setLoading(false);
      },
      (error) => {
        console.error("[useNotifications] onSnapshot error:", error);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [lang, user?.id]);

  const unreadCount = useMemo(
    () => rawNotifications.filter((n) => !n.is_read).length,
    [rawNotifications],
  );

  const markAsRead = useCallback(
    async (notificationId: string) => {
      try {
        await updateDoc(
          doc(db, "in_app_notifications", notificationId),
          { is_read: true },
        );
      } catch (err) {
        console.error("[useNotifications] markAsRead error:", err);
      }
    },
    [],
  );

  const markAllAsRead = useCallback(async () => {
    if (!user?.id) return;
    try {
      const q = query(
        collection(db, "in_app_notifications"),
        where("target_user_id", "==", user.id),
        where("is_read", "==", false),
        where("is_deleted", "==", false),
      );
      const snap = await getDocs(q);
      if (snap.empty) return;

      const batch = writeBatch(db);
      snap.docs.forEach((d) => {
        batch.update(d.ref, { is_read: true });
      });
      await batch.commit();
    } catch (err) {
      console.error("[useNotifications] markAllAsRead error:", err);
    }
  }, [user?.id]);

  return {
    notifications: rawNotifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    loading,
  };
}
