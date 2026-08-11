import { randomUUID } from "crypto";

import { AuditAction, type PosTicketSettings } from "@bduck/shared-types";

import { db } from "../config/firebase.js";

export const POS_TICKET_SETTINGS_COLLECTION = "pos_ticket_settings";

const toDate = (value: unknown): Date => {
  if (value instanceof Date) return value;
  if (value && typeof value === "object" && "toDate" in value) {
    return (value as { toDate: () => Date }).toDate();
  }
  return new Date(0);
};

const mapSettings = (value: Record<string, unknown>): PosTicketSettings => ({
  ...(value as unknown as PosTicketSettings),
  created_at: toDate(value.created_at),
  updated_at: toDate(value.updated_at),
});

export const posTicketSettingsRepository = {
  async findByWarehouse(
    warehouseId: string,
  ): Promise<PosTicketSettings | null> {
    const snapshot = await db
      .collection(POS_TICKET_SETTINGS_COLLECTION)
      .doc(warehouseId)
      .get();
    return snapshot.exists ? mapSettings(snapshot.data() || {}) : null;
  },

  waitForVersionChange(
    warehouseId: string,
    knownVersion: number | null,
    timeoutMs: number,
    signal?: AbortSignal,
  ): Promise<{ changed: boolean; settings: PosTicketSettings | null }> {
    const reference = db
      .collection(POS_TICKET_SETTINGS_COLLECTION)
      .doc(warehouseId);
    return new Promise((resolve, reject) => {
      let unsubscribe: () => void = () => undefined;
      let settled = false;
      const handleAbort = () => finish({ changed: false, settings: null });
      const finish = (result: {
        changed: boolean;
        settings: PosTicketSettings | null;
      }) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        signal?.removeEventListener("abort", handleAbort);
        unsubscribe();
        resolve(result);
      };
      const timer = setTimeout(
        () => finish({ changed: false, settings: null }),
        timeoutMs,
      );
      if (signal?.aborted) return finish({ changed: false, settings: null });
      signal?.addEventListener("abort", handleAbort, { once: true });
      unsubscribe = reference.onSnapshot(
        (snapshot) => {
          const settings = snapshot.exists
            ? mapSettings(snapshot.data() || {})
            : null;
          if ((settings?.version ?? null) !== knownVersion)
            finish({ changed: true, settings });
        },
        (error) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          signal?.removeEventListener("abort", handleAbort);
          unsubscribe();
          reject(error);
        },
      );
    });
  },

  async save(input: {
    warehouseId: string;
    actorId: string;
    value: Omit<
      PosTicketSettings,
      | "id"
      | "warehouse_id"
      | "version"
      | "updated_by"
      | "created_at"
      | "updated_at"
      | "is_deleted"
    >;
    context?: {
      ip_address?: string | null;
      device_id?: string | null;
      session_token?: string | null;
    };
    source?: "JPULSE" | "JPOS";
  }): Promise<PosTicketSettings> {
    const reference = db
      .collection(POS_TICKET_SETTINGS_COLLECTION)
      .doc(input.warehouseId);
    return db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reference);
      const previous = snapshot.exists
        ? mapSettings(snapshot.data() || {})
        : null;
      const now = new Date();
      const current: PosTicketSettings = {
        ...input.value,
        id: input.warehouseId,
        warehouse_id: input.warehouseId,
        version: (previous?.version ?? 0) + 1,
        updated_by: input.actorId,
        is_deleted: false,
        created_at: previous?.created_at ?? now,
        updated_at: now,
      };
      const auditId = randomUUID();
      transaction.set(reference, current);
      transaction.create(db.collection("audit_logs").doc(auditId), {
        id: auditId,
        entity_type: "POS_TICKET_SETTINGS",
        entity_id: input.warehouseId,
        warehouse_id: input.warehouseId,
        action: previous ? AuditAction.UPDATE : AuditAction.CREATE,
        user_id: input.actorId,
        user_name: null,
        entity_name: null,
        action_time: now,
        sync_time: now,
        old_value: previous,
        new_value: current,
        ip_address: input.context?.ip_address ?? null,
        device_id: input.context?.device_id ?? null,
        session_token: input.context?.session_token ?? null,
        notes: `Updated JPOS ticket settings from ${input.source ?? "JPULSE"}`,
      });
      return current;
    });
  },
};
