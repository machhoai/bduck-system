/**
 * notificationService — Write in-app notifications to Firestore
 *
 * ARCHITECTURE:
 * - Notifications are written to Firestore `in_app_notifications` collection
 * - FE listens via onSnapshot (LUẬT THÉP: realtime, no reload button)
 * - Soft delete only (is_deleted flag)
 *
 * USED BY:
 * - Workflow Engine NOTIFICATION node
 * - Any service that needs to push user-facing messages
 */

import { db } from "../config/firebase.js";
import { randomUUID } from "crypto";

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

export interface CreateNotificationInput {
  /** Target user ID (null → use target_role_id) */
  target_user_id: string | null;
  /** Target role → all users with this role see it */
  target_role_id: string | null;
  /** i18n template key (e.g., "notification.voucher_approved") */
  template_key: string;
  /** Template params for interpolation */
  template_params: Record<string, unknown>;
  /** Channel: IN_APP, EMAIL, PUSH (for now only IN_APP) */
  channel: string;
  /** Workflow instance that triggered this notification */
  source_instance_id: string | null;
  /** Entity reference (e.g., voucher ID) */
  source_entity_id: string | null;
  source_entity_type: string | null;
}

export interface InAppNotification {
  id: string;
  target_user_id: string | null;
  target_role_id: string | null;
  template_key: string;
  template_params: Record<string, unknown>;
  channel: string;
  source_instance_id: string | null;
  source_entity_id: string | null;
  source_entity_type: string | null;
  is_read: boolean;
  is_deleted: boolean;
  created_at: Date;
}

// ─────────────────────────────────────────────
// SERVICE
// ─────────────────────────────────────────────

const COLLECTION = "in_app_notifications";

/**
 * Create an in-app notification.
 * Returns the created notification ID.
 */
export async function createNotification(
  input: CreateNotificationInput,
): Promise<string> {
  const now = new Date();
  const id = randomUUID();

  await db.collection(COLLECTION).doc(id).set({
    id,
    target_user_id: input.target_user_id,
    target_role_id: input.target_role_id,
    template_key: input.template_key,
    template_params: input.template_params,
    channel: input.channel,
    source_instance_id: input.source_instance_id,
    source_entity_id: input.source_entity_id,
    source_entity_type: input.source_entity_type,
    is_read: false,
    is_deleted: false,
    created_at: now,
  });

  return id;
}

/**
 * Mark a notification as read.
 */
export async function markNotificationRead(
  notificationId: string,
): Promise<void> {
  await db.collection(COLLECTION).doc(notificationId).update({
    is_read: true,
  });
}

/**
 * Mark all notifications for a user as read.
 */
export async function markAllNotificationsRead(
  userId: string,
): Promise<number> {
  const snapshot = await db
    .collection(COLLECTION)
    .where("target_user_id", "==", userId)
    .where("is_read", "==", false)
    .where("is_deleted", "==", false)
    .get();

  if (snapshot.empty) return 0;

  const batch = db.batch();
  snapshot.docs.forEach((doc) => {
    batch.update(doc.ref, { is_read: true });
  });
  await batch.commit();

  return snapshot.size;
}
