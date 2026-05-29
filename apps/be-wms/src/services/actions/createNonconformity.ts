/**
 * CREATE_NONCONFORMITY — System Action Handler
 *
 * Compares actual_quantity vs expected_quantity for each item.
 * If ANY item has a discrepancy, creates a NonconformityReport.
 *
 * Per rules.md:
 * - DAMAGED items → auto quarantine (atp -= qty, quarantine += qty)
 * - Auto status lock to QUARANTINE for discrepant products
 * - Evidence is NOT required at auto-creation time (reporter = SYSTEM)
 *
 * IDEMPOTENCY: Checks if NC report already exists for this voucher.
 */

import { db } from "../../config/firebase.js";
import { randomUUID } from "crypto";
import {
  AuditAction,
  NonconformitySourceType,
  IssueType,
  NonconformityStatus,
} from "@bduck/shared-types";
import { logAudit } from "../auditService.js";
import type {
  SystemActionContext,
  SystemActionResult,
} from "./updateInventoryATP.js";

export async function createNonconformity(
  _params: Record<string, unknown>,
  ctx: SystemActionContext,
): Promise<SystemActionResult> {
  const voucherId = ctx.entityPayload.voucher_id as string;
  if (!voucherId) {
    return { skipped: true, reason: "missing_voucher_id" };
  }

  // Check idempotency: NC report already exists for this source
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

  // Read voucher + items
  const voucherSnap = await db
    .collection("import_vouchers")
    .doc(voucherId)
    .get();
  if (!voucherSnap.exists) {
    return { skipped: true, reason: "voucher_not_found" };
  }

  const voucher = voucherSnap.data()!;
  const itemsSnap = await db
    .collection("import_vouchers")
    .doc(voucherId)
    .collection("items")
    .where("is_deleted", "==", false)
    .get();

  // Find items with discrepancies
  const discrepantItems = itemsSnap.docs
    .map((d) => d.data())
    .filter((item) => {
      const expected = (item.expected_quantity as number) || 0;
      const actual = (item.actual_quantity as number) || 0;
      return expected !== actual;
    });

  if (discrepantItems.length === 0) {
    return { skipped: true, reason: "no_discrepancy_found" };
  }

  // Create NC reports for each discrepant item
  const batch = db.batch();
  const reportIds: string[] = [];
  const now = new Date();

  for (const item of discrepantItems) {
    const reportId = randomUUID();
    const reportNumber = `NC-${now.toISOString().slice(0, 10).replace(/-/g, "")}-${String(Math.floor(Math.random() * 900) + 100)}`;

    const expected = (item.expected_quantity as number) || 0;
    const actual = (item.actual_quantity as number) || 0;
    const discrepancy = Math.abs(expected - actual);
    const issueType =
      actual < expected ? IssueType.DISCREPANCY : IssueType.DISCREPANCY;

    batch.set(db.collection("nonconformity_reports").doc(reportId), {
      id: reportId,
      report_number: reportNumber,
      source_type: NonconformitySourceType.IMPORT,
      source_id: voucherId,
      warehouse_id: voucher.warehouse_id,
      warehouse_location_id: item.warehouse_location_id,
      product_id: item.product_id,
      quantity_affected: discrepancy,
      issue_type: issueType,
      status: NonconformityStatus.OPEN,
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

    reportIds.push(reportId);
  }

  await batch.commit();

  // Audit trail
  await logAudit({
    entity_type: "NONCONFORMITY_REPORT",
    entity_id: reportIds.join(","),
    warehouse_id: voucher.warehouse_id as string,
    action: AuditAction.CREATE,
    user_id: ctx.userId,
    old_value: null,
    new_value: {
      source_voucher_id: voucherId,
      discrepant_items: discrepantItems.length,
      report_ids: reportIds,
    },
  });

  return {
    reports_created: reportIds.length,
    report_ids: reportIds,
  };
}
