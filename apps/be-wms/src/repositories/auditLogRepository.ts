import type { AuditLog } from "@bduck/shared-types";
import { db } from "../config/firebase.js";

const COLLECTION = "audit_logs";

export interface AuditLogSearchParams {
  entity_type?: string;
  entity_id?: string;
  warehouse_id?: string;
  action?: string;
  user_id?: string;
  from?: Date;
  to?: Date;
  limit: number;
  sort_by: "action_time" | "sync_time";
  sort_dir: "asc" | "desc";
}

class AuditLogRepository {
  async findAuditLogs(params: AuditLogSearchParams): Promise<AuditLog[]> {
    let query: FirebaseFirestore.Query = db
      .collection(COLLECTION)
      .orderBy(params.sort_by, params.sort_dir)
      .limit(params.limit);

    if (params.entity_type) {
      query = query.where("entity_type", "==", params.entity_type);
    }

    if (params.entity_id) {
      query = query.where("entity_id", "==", params.entity_id);
    }

    if (params.warehouse_id) {
      query = query.where("warehouse_id", "==", params.warehouse_id);
    }

    if (params.action) {
      query = query.where("action", "==", params.action);
    }

    if (params.user_id) {
      query = query.where("user_id", "==", params.user_id);
    }

    if (params.from) {
      query = query.where(params.sort_by, ">=", params.from);
    }

    if (params.to) {
      query = query.where(params.sort_by, "<=", params.to);
    }

    const snapshot = await query.get();
    const logs = snapshot.docs.map(
      (doc) =>
        ({
          id: doc.id,
          ...doc.data(),
        }) as AuditLog,
    );

    return this.attachUserNames(logs);
  }

  private async attachUserNames(logs: AuditLog[]): Promise<AuditLog[]> {
    const userIds = Array.from(
      new Set(logs.map((log) => log.user_id).filter(Boolean)),
    );

    if (userIds.length === 0) return logs;

    const userRefs = userIds.map((userId) =>
      db.collection("users").doc(userId),
    );
    const userSnapshots = await db.getAll(...userRefs);
    const userNameById = new Map<string, string>();

    userSnapshots.forEach((snapshot) => {
      if (!snapshot.exists) return;

      const user = snapshot.data() || {};
      const displayName =
        typeof user.full_name === "string" && user.full_name.trim()
          ? user.full_name.trim()
          : typeof user.username === "string" && user.username.trim()
            ? user.username.trim()
            : typeof user.email === "string" && user.email.trim()
              ? user.email.trim()
              : null;

      if (displayName) {
        userNameById.set(snapshot.id, displayName);
      }
    });

    return logs.map((log) => ({
      ...log,
      user_name: userNameById.get(log.user_id) || null,
    }));
  }
}

export const auditLogRepository = new AuditLogRepository();
