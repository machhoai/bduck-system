import type {
  InAppNotification,
  NotificationDispatch,
} from "@bduck/shared-types";
import { randomUUID } from "crypto";
import { db } from "../config/firebase.js";

const IN_APP_COLLECTION = "in_app_notifications";
const DISPATCH_COLLECTION = "notification_dispatches";
const USER_ROLES_COLLECTION = "user_warehouse_roles";

type CreateInAppNotificationInput = Omit<
  InAppNotification,
  "id" | "is_deleted" | "created_at" | "updated_at" | "is_read" | "read_at"
>;

type CreateDispatchInput = Omit<
  NotificationDispatch,
  "id" | "is_deleted" | "created_at" | "updated_at" | "sync_time"
> & {
  id?: string;
};

function chunkArray<T>(items: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }
  return chunks;
}

class NotificationRepository {
  async createInAppNotification(
    input: CreateInAppNotificationInput,
  ): Promise<InAppNotification> {
    const now = new Date();
    const id = randomUUID();
    const notification: InAppNotification = {
      id,
      ...input,
      is_read: false,
      read_at: null,
      is_deleted: false,
      created_at: now,
      updated_at: now,
    };

    await db.collection(IN_APP_COLLECTION).doc(id).set(notification);
    return notification;
  }

  async createInAppNotifications(
    inputs: CreateInAppNotificationInput[],
  ): Promise<InAppNotification[]> {
    const now = new Date();
    const notifications = inputs.map((input) => ({
      id: randomUUID(),
      ...input,
      is_read: false,
      read_at: null,
      is_deleted: false,
      created_at: now,
      updated_at: now,
    })) satisfies InAppNotification[];

    for (const chunk of chunkArray(notifications, 450)) {
      const batch = db.batch();
      chunk.forEach((notification) => {
        batch.set(
          db.collection(IN_APP_COLLECTION).doc(notification.id),
          notification,
        );
      });
      await batch.commit();
    }

    return notifications;
  }

  async markRead(notificationId: string): Promise<void> {
    await db.collection(IN_APP_COLLECTION).doc(notificationId).update({
      is_read: true,
      read_at: new Date(),
      updated_at: new Date(),
    });
  }

  async markAllRead(userId: string): Promise<number> {
    const snapshot = await db
      .collection(IN_APP_COLLECTION)
      .where("target_user_id", "==", userId)
      .where("is_read", "==", false)
      .where("is_deleted", "==", false)
      .get();

    if (snapshot.empty) return 0;

    for (const chunk of chunkArray(snapshot.docs, 450)) {
      const batch = db.batch();
      chunk.forEach((docSnap) => {
        batch.update(docSnap.ref, {
          is_read: true,
          read_at: new Date(),
          updated_at: new Date(),
        });
      });
      await batch.commit();
    }

    return snapshot.size;
  }

  async createDispatch(
    input: CreateDispatchInput,
  ): Promise<NotificationDispatch> {
    const now = new Date();
    const dispatch: NotificationDispatch = {
      ...input,
      id: input.id || randomUUID(),
      sync_time: now,
      is_deleted: false,
      created_at: now,
      updated_at: now,
    };

    await db.collection(DISPATCH_COLLECTION).doc(dispatch.id).set(dispatch);
    return dispatch;
  }

  async findDispatches(limitCount: number): Promise<NotificationDispatch[]> {
    const snapshot = await db
      .collection(DISPATCH_COLLECTION)
      .orderBy("created_at", "desc")
      .limit(limitCount)
      .get();

    return snapshot.docs
      .map((docSnap) => docSnap.data() as NotificationDispatch)
      .filter((dispatch) => !dispatch.is_deleted);
  }

  async findActiveUserIdsByRoleIds(
    roleIds: string[],
    warehouseId?: string | null,
  ): Promise<string[]> {
    if (roleIds.length === 0) return [];

    const userIds = new Set<string>();

    for (const chunk of chunkArray(roleIds, 30)) {
      const snapshot = await db
        .collection(USER_ROLES_COLLECTION)
        .where("role_id", "in", chunk)
        .where("is_active", "==", true)
        .get();

      snapshot.docs.forEach((docSnap) => {
        const data = docSnap.data();
        if (
          warehouseId !== undefined &&
          data.warehouse_id &&
          data.warehouse_id !== warehouseId
        ) {
          return;
        }

        if (typeof data.user_id === "string" && data.user_id.trim()) {
          userIds.add(data.user_id);
        }
      });
    }

    return Array.from(userIds);
  }
}

export const notificationRepository = new NotificationRepository();
