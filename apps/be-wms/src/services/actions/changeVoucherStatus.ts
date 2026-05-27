/**
 * CHANGE_VOUCHER_STATUS — System Action Handler
 *
 * Updates the target entity's status field in Firestore.
 * Generic: works for import_vouchers, export_vouchers, etc.
 *
 * params.target_status  — The new status string
 * ctx.entityPayload     — Must contain { voucher_id, entity_collection? }
 *
 * IDEMPOTENCY: If the entity already has the target status, skip.
 */

import { db } from "../../config/firebase.js";
import { AuditAction } from "@bduck/shared-types";
import { logAudit } from "../auditService.js";
import type {
  SystemActionContext,
  SystemActionResult,
} from "../systemActionRegistry.js";

/** Map entity_type → Firestore collection name */
const ENTITY_COLLECTIONS: Record<string, string> = {
  IMPORT_VOUCHER: "import_vouchers",
  EXPORT_VOUCHER: "export_vouchers",
  TRANSFER_ORDER: "transfer_orders",
  PURCHASE_ORDER: "purchase_orders",
};

export async function changeVoucherStatus(
  params: Record<string, unknown>,
  ctx: SystemActionContext,
): Promise<SystemActionResult> {
  const targetStatus = params.target_status as string;
  if (!targetStatus) {
    return { skipped: true, reason: "missing_target_status" };
  }

  const entityId = ctx.entityPayload.voucher_id as string;
  const entityType = ctx.entityPayload.entity_type as string;
  const collection =
    ENTITY_COLLECTIONS[entityType] ||
    (params.entity_collection as string) ||
    "import_vouchers";

  if (!entityId) {
    return { skipped: true, reason: "missing_voucher_id_in_payload" };
  }

  const docRef = db.collection(collection).doc(entityId);
  const snap = await docRef.get();
  if (!snap.exists) {
    return { skipped: true, reason: "entity_not_found" };
  }

  const currentData = snap.data()!;
  const oldStatus = currentData.status;

  // Idempotency: already at target status
  if (oldStatus === targetStatus) {
    return { skipped: true, reason: "already_at_target_status", oldStatus };
  }

  const now = new Date();
  const updateData: Record<string, unknown> = {
    status: targetStatus,
    updated_at: now,
    sync_time: now,
  };

  // If approving, set approver_id (Self-Approval Block enforced by workflow DAG)
  if (targetStatus === "APPROVED" || targetStatus === "COMPLETED") {
    updateData.approver_id = ctx.userId !== "SYSTEM" ? ctx.userId : null;
    updateData.approved_at = now;
  }

  await docRef.update(updateData);

  // Audit trail (ISO 9001)
  await logAudit({
    entity_type: entityType || "IMPORT_VOUCHER",
    entity_id: entityId,
    warehouse_id:
      typeof currentData.warehouse_id === "string"
        ? currentData.warehouse_id
        : null,
    action: AuditAction.UPDATE,
    user_id: ctx.userId,
    old_value: { status: oldStatus },
    new_value: { status: targetStatus },
  });

  return { oldStatus, newStatus: targetStatus };
}
