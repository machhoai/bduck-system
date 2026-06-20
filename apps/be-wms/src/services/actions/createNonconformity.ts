/**
 * CREATE_NONCONFORMITY - system action for post-receiving exceptions.
 */

import { randomUUID } from "crypto";
import { db } from "../../config/firebase.js";
import {
  AuditAction,
  NonconformitySourceType,
  QuarantineStatus,
} from "@bduck/shared-types";
import { logAudit } from "../auditService.js";
import {
  aggregateInventoryLocks,
  applyInventoryLocksInTransaction,
  buildImportExceptions,
} from "./nonconformityImportHelpers.js";
import type {
  SystemActionContext,
  SystemActionResult,
} from "./updateInventoryATP.js";
import { notifyNonconformityCreated } from "../nonconformityNotificationService.js";

function buildReportNumber(now: Date, index: number): string {
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, "");
  const suffix = String(index + 1).padStart(3, "0");
  return `NC-${datePart}-${suffix}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

export async function createNonconformity(
  _params: Record<string, unknown>,
  ctx: SystemActionContext,
): Promise<SystemActionResult> {
  const voucherId = ctx.entityPayload.voucher_id as string;
  if (!voucherId) {
    return { skipped: true, reason: "missing_voucher_id" };
  }

  const existingSnap = await db
    .collection("nonconformity_reports")
    .where("source_type", "==", NonconformitySourceType.IMPORT)
    .where("source_id", "==", voucherId)
    .where("is_deleted", "==", false)
    .limit(1)
    .get();

  if (!existingSnap.empty) {
    return { skipped: true, reason: "nc_report_already_exists" };
  }

  const voucherSnap = await db.collection("import_vouchers").doc(voucherId).get();
  if (!voucherSnap.exists) {
    return { skipped: true, reason: "voucher_not_found" };
  }

  const voucher = voucherSnap.data()!;
  const warehouseId =
    typeof voucher.warehouse_id === "string" ? voucher.warehouse_id : "";
  if (!warehouseId) {
    return { skipped: true, reason: "missing_warehouse_id" };
  }

  const itemsSnap = await db
    .collection("import_vouchers")
    .doc(voucherId)
    .collection("items")
    .where("is_deleted", "==", false)
    .get();

  const exceptions = buildImportExceptions(itemsSnap.docs.map((doc) => doc.data()));
  if (exceptions.length === 0) {
    return { skipped: true, reason: "no_exception_found" };
  }

  const inventoryLocks = aggregateInventoryLocks(warehouseId, exceptions);
  const now = new Date();
  const reportPlans = exceptions.map((exception, index) => ({
    exception,
    reportId: randomUUID(),
    reportNumber: buildReportNumber(now, index),
    quarantineId:
      exception.bucketLock === "QUARANTINE" ? randomUUID() : null,
  }));
  const reportIds = reportPlans.map((plan) => plan.reportId);
  const quarantineRecordsCreated = reportPlans.filter(
    (plan) => plan.quarantineId,
  ).length;

  await db.runTransaction(async (txn) => {
    await applyInventoryLocksInTransaction(txn, inventoryLocks);

    reportPlans.forEach((plan) => {
      const { exception } = plan;
      txn.set(db.collection("nonconformity_reports").doc(plan.reportId), {
        id: plan.reportId,
        report_number: plan.reportNumber,
        source_type: NonconformitySourceType.IMPORT,
        source_id: voucherId,
        warehouse_id: warehouseId,
        warehouse_location_id: exception.locationId,
        product_id: exception.productId,
        quantity_affected: exception.quantity,
        issue_type: exception.issueType,
        status: exception.status,
        reporter_id: ctx.userId,
        reviewer_id: null,
        resolved_by: null,
        resolution_type: null,
        resolution_notes: null,
        requires_evidence: true,
        action_time: now,
        sync_time: now,
        is_deleted: false,
        created_at: now,
        updated_at: now,
      });

      if (!plan.quarantineId) return;

      txn.set(db.collection("quarantine_records").doc(plan.quarantineId), {
        id: plan.quarantineId,
        nonconformity_report_id: plan.reportId,
        product_id: exception.productId,
        warehouse_location_id: exception.locationId,
        quantity: exception.quantity,
        quarantine_reason: exception.reason,
        quarantined_at: now,
        released_at: null,
        released_by: null,
        release_notes: null,
        status: QuarantineStatus.QUARANTINED,
        is_deleted: false,
      });
    });
  });

  await logAudit({
    entity_type: "NONCONFORMITY_REPORT",
    entity_id: reportIds.join(","),
    warehouse_id: warehouseId,
    action: AuditAction.CREATE,
    user_id: ctx.userId,
    old_value: null,
    new_value: {
      source_voucher_id: voucherId,
      reports_created: reportIds.length,
      quarantine_records_created: quarantineRecordsCreated,
      inventory_locks: inventoryLocks,
      report_ids: reportIds,
    },
  });

  await notifyNonconformityCreated({
    warehouseId,
    reporterId: ctx.userId,
    reports: reportPlans.map((plan) => ({
      id: plan.reportId,
      report_number: plan.reportNumber,
      issue_type: plan.exception.issueType,
      quantity_affected: plan.exception.quantity,
    })),
  });

  return {
    reports_created: reportIds.length,
    quarantine_records_created: quarantineRecordsCreated,
    report_ids: reportIds,
  };
}
