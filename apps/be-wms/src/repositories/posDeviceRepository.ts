import { randomUUID } from "crypto";

import type {
  PosDevice,
  PosDeviceEnrollment,
  PosDeviceStatus,
} from "@bduck/shared-types";
import { AuditAction } from "@bduck/shared-types";

import { db } from "../config/firebase.js";

export const POS_DEVICES_COLLECTION = "pos_devices";
export const POS_DEVICE_ENROLLMENTS_COLLECTION = "pos_device_enrollments";

type AuditContext = {
  ip_address?: string | null;
  device_id?: string | null;
  session_token?: string | null;
};

const createAuditRecord = (input: {
  entityType: string;
  entityId: string;
  warehouseId: string;
  action: AuditAction;
  actorId: string;
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  notes?: string;
  context?: AuditContext;
}) => {
  const now = new Date();
  return {
    id: randomUUID(),
    entity_type: input.entityType,
    entity_id: input.entityId,
    warehouse_id: input.warehouseId,
    action: input.action,
    user_id: input.actorId,
    user_name: input.actorId === "system" ? "System" : null,
    entity_name: null,
    action_time: now,
    sync_time: now,
    old_value: input.oldValue,
    new_value: input.newValue,
    ip_address: input.context?.ip_address ?? null,
    device_id: input.context?.device_id ?? null,
    session_token: input.context?.session_token ?? null,
    notes: input.notes ?? null,
  };
};

const toDate = (value: unknown): Date | null => {
  if (value instanceof Date) return value;
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof (value as { toDate: unknown }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate();
  }
  return null;
};

const mapDevice = (id: string, value: Record<string, unknown>): PosDevice => ({
  ...(value as unknown as PosDevice),
  id,
  enrolled_at: toDate(value.enrolled_at) ?? new Date(0),
  last_seen_at: toDate(value.last_seen_at),
  revoked_at: toDate(value.revoked_at),
  created_at: toDate(value.created_at) ?? new Date(0),
  updated_at: toDate(value.updated_at) ?? new Date(0),
});

const mapEnrollment = (
  id: string,
  value: Record<string, unknown>,
): PosDeviceEnrollment => ({
  ...(value as unknown as PosDeviceEnrollment),
  id,
  expires_at: toDate(value.expires_at) ?? new Date(0),
  used_at: toDate(value.used_at),
  revoked_at: toDate(value.revoked_at),
  created_at: toDate(value.created_at) ?? new Date(0),
  updated_at: toDate(value.updated_at) ?? new Date(0),
});

export const posDeviceRepository = {
  async listByWarehouse(warehouseId: string): Promise<PosDevice[]> {
    const snapshot = await db
      .collection(POS_DEVICES_COLLECTION)
      .where("warehouse_id", "==", warehouseId)
      .where("is_deleted", "==", false)
      .get();
    return snapshot.docs
      .map((document) => mapDevice(document.id, document.data()))
      .sort((left, right) => right.updated_at.getTime() - left.updated_at.getTime());
  },

  async findById(id: string): Promise<PosDevice | null> {
    const snapshot = await db.collection(POS_DEVICES_COLLECTION).doc(id).get();
    if (!snapshot.exists) return null;
    return mapDevice(snapshot.id, snapshot.data() || {});
  },

  async touchHeartbeat(id: string, appVersion: string): Promise<PosDevice> {
    const reference = db.collection(POS_DEVICES_COLLECTION).doc(id);
    const now = new Date();
    await reference.update({
      last_seen_at: now,
      app_version: appVersion,
      updated_at: now,
    });
    const snapshot = await reference.get();
    return mapDevice(snapshot.id, snapshot.data() || {});
  },

  async createEnrollment(
    enrollment: PosDeviceEnrollment,
    context?: AuditContext,
  ): Promise<void> {
    const enrollmentRef = db
      .collection(POS_DEVICE_ENROLLMENTS_COLLECTION)
      .doc(enrollment.id);
    const audit = createAuditRecord({
      entityType: "POS_DEVICE_ENROLLMENT",
      entityId: enrollment.id,
      warehouseId: enrollment.warehouse_id,
      action: AuditAction.CREATE,
      actorId: enrollment.created_by,
      oldValue: null,
      newValue: {
        warehouse_id: enrollment.warehouse_id,
        status: enrollment.status,
        expires_at: enrollment.expires_at,
      },
      notes: "Created one-time POS device pairing code after MFA verification",
      context,
    });
    const auditRef = db.collection("audit_logs").doc(audit.id);
    await db.runTransaction(async (transaction) => {
      transaction.create(enrollmentRef, enrollment);
      transaction.create(auditRef, audit);
    });
  },

  async activateDevice(input: {
    enrollmentId: string;
    device: PosDevice;
  }): Promise<{ enrollment: PosDeviceEnrollment; device: PosDevice }> {
    const enrollmentRef = db
      .collection(POS_DEVICE_ENROLLMENTS_COLLECTION)
      .doc(input.enrollmentId);
    const deviceRef = db.collection(POS_DEVICES_COLLECTION).doc(input.device.id);

    return db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(enrollmentRef);
      if (!snapshot.exists) throw new Error("POS_ENROLLMENT_NOT_FOUND");
      const enrollment = mapEnrollment(snapshot.id, snapshot.data() || {});
      const now = new Date();
      if (
        enrollment.is_deleted ||
        enrollment.status !== "PENDING" ||
        enrollment.expires_at.getTime() <= now.getTime()
      ) {
        throw new Error("POS_ENROLLMENT_NOT_USABLE");
      }

      const boundDevice: PosDevice = {
        ...input.device,
        warehouse_id: enrollment.warehouse_id,
        enrolled_by: enrollment.created_by,
      };
      const safeDevice = { ...boundDevice } as Record<string, unknown>;
      delete safeDevice.credential_hash;
      const audit = createAuditRecord({
        entityType: "POS_DEVICE",
        entityId: boundDevice.id,
        warehouseId: enrollment.warehouse_id,
        action: AuditAction.CREATE,
        actorId: "system",
        oldValue: null,
        newValue: safeDevice,
        notes: "Activated POS device using a one-time pairing code",
        context: { device_id: boundDevice.id },
      });
      const auditRef = db.collection("audit_logs").doc(audit.id);
      transaction.create(deviceRef, boundDevice);
      transaction.update(enrollmentRef, {
        status: "USED",
        used_by_device_id: input.device.id,
        used_at: now,
        updated_at: now,
      });
      transaction.create(auditRef, audit);
      return { enrollment, device: boundDevice };
    });
  },

  async updateStatus(
    id: string,
    status: PosDeviceStatus,
    actorId: string,
    context?: AuditContext,
  ): Promise<PosDevice> {
    const reference = db.collection(POS_DEVICES_COLLECTION).doc(id);
    return db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reference);
      if (!snapshot.exists) throw new Error("POS_DEVICE_NOT_FOUND");
      const previous = mapDevice(snapshot.id, snapshot.data() || {});
      const now = new Date();
      const current: PosDevice = {
        ...previous,
        status,
        revoked_by: status === "REVOKED" ? actorId : null,
        revoked_at: status === "REVOKED" ? now : null,
        updated_at: now,
      };
      const previousSafe = { ...previous } as Record<string, unknown>;
      const currentSafe = { ...current } as Record<string, unknown>;
      delete previousSafe.credential_hash;
      delete currentSafe.credential_hash;
      const audit = createAuditRecord({
        entityType: "POS_DEVICE",
        entityId: current.id,
        warehouseId: current.warehouse_id,
        action: AuditAction.UPDATE,
        actorId,
        oldValue: previousSafe,
        newValue: currentSafe,
        context,
      });
      const auditRef = db.collection("audit_logs").doc(audit.id);
      transaction.update(reference, {
        status: current.status,
        revoked_by: current.revoked_by,
        revoked_at: current.revoked_at,
        updated_at: current.updated_at,
      });
      transaction.create(auditRef, audit);
      return current;
    });
  },
};
