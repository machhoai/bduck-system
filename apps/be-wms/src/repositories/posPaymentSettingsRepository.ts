import { randomUUID } from "crypto";

import {
  AuditAction,
  type PosPaymentSettings,
  type PosPaymentSettingsInput,
} from "@bduck/shared-types";

import { db } from "../config/firebase.js";

export const POS_PAYMENT_SETTINGS_COLLECTION = "pos_payment_settings";

export const posPaymentSettingsRepository = {
  async findByDevice(
    deviceId: string,
    warehouseId: string,
  ): Promise<PosPaymentSettings | null> {
    const collection = db.collection(POS_PAYMENT_SETTINGS_COLLECTION);
    const deviceSnapshot = await collection.doc(deviceId).get();
    const snapshot = deviceSnapshot.exists
      ? deviceSnapshot
      : await collection.doc(warehouseId).get();
    if (!snapshot.exists) return null;
    const settings = snapshot.data() as Omit<PosPaymentSettings, "deviceId"> & {
      deviceId?: string;
    };
    return {
      ...settings,
      deviceId,
      warehouseId,
      fixedTransferOnly: settings.fixedTransferOnly === true,
    };
  },

  async save(input: {
    deviceId: string;
    warehouseId: string;
    actorId: string;
    value: PosPaymentSettingsInput;
    context?: {
      ip_address?: string | null;
      device_id?: string | null;
      session_token?: string | null;
    };
  }): Promise<PosPaymentSettings> {
    const reference = db
      .collection(POS_PAYMENT_SETTINGS_COLLECTION)
      .doc(input.deviceId);
    return db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reference);
      const previous = snapshot.exists
        ? (snapshot.data() as PosPaymentSettings)
        : null;
      const now = new Date().toISOString();
      const current: PosPaymentSettings = {
        deviceId: input.deviceId,
        warehouseId: input.warehouseId,
        ...input.value,
        version: (previous?.version ?? 0) + 1,
        updatedAt: now,
        updatedByUid: input.actorId,
      };
      const auditId = randomUUID();
      transaction.set(reference, current);
      transaction.create(db.collection("audit_logs").doc(auditId), {
        id: auditId,
        entity_type: "POS_PAYMENT_SETTINGS",
        entity_id: input.deviceId,
        warehouse_id: input.warehouseId,
        action: previous ? AuditAction.UPDATE : AuditAction.CREATE,
        user_id: input.actorId,
        user_name: null,
        entity_name: null,
        action_time: new Date(),
        sync_time: new Date(),
        old_value: previous,
        new_value: current,
        ip_address: input.context?.ip_address ?? null,
        device_id: input.context?.device_id ?? null,
        session_token: input.context?.session_token ?? null,
        notes: `Updated JPOS transfer payment settings for device ${input.deviceId} from JPULSE`,
      });
      return current;
    });
  },
};
