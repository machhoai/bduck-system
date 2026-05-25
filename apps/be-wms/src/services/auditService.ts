import { db } from "../config/firebase.js";
import { AuditAction } from "@bduck/shared-types";
import { randomUUID } from "crypto";

interface AuditLogParams {
  entity_type: string;
  entity_id: string;
  action: AuditAction;
  user_id: string;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  action_time?: Date;
  ip_address?: string | null;
  device_id?: string | null;
  session_token?: string | null;
  notes?: string | null;
}

export type AuditMetadata = Pick<
  AuditLogParams,
  "action_time" | "ip_address" | "device_id" | "session_token"
>;

/**
 * Audit Service (ISO 9001 Compliance)
 * IMMUTABLE operations: Only inserts are allowed for audit logs.
 */
export const logAudit = async (params: AuditLogParams) => {
  try {
    const auditRef = db.collection("audit_logs").doc(randomUUID());
    const action_time = params.action_time || new Date();
    const sync_time = new Date(); // Server receive time

    await auditRef.set({
      id: auditRef.id,
      entity_type: params.entity_type,
      entity_id: params.entity_id,
      action: params.action,
      user_id: params.user_id,
      action_time: action_time,
      sync_time: sync_time,
      old_value: params.old_value,
      new_value: params.new_value,
      ip_address: params.ip_address || null,
      device_id: params.device_id || null,
      session_token: params.session_token || null,
      notes: params.notes || null,
    });

    return auditRef.id;
  } catch (error) {
    // We log the error but usually don't want to throw and crash the main transaction
    // However, for high security systems, failing audit log could fail the transaction.
    // Assuming non-blocking audit logging for now, or this could be part of a batch.
    console.error("[auditService] Failed to write audit log:", error);
    throw error;
  }
};
