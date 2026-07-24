import {
  type LeaveBalanceReconciliationReport,
  type LeaveReconciliationRunMode,
} from "@bduck/shared-types";
import { randomUUID } from "node:crypto";
import { findEmployeeProfiles } from "../repositories/employeeProfileRepository.js";
import {
  loadLeaveReconciliationSource,
  recordLeaveReconciliationReport,
  repairLeaveBalanceProjection,
} from "../repositories/leaveReconciliationRepository.js";
import { reconcileLeaveBalanceProjection } from "./leaveReconciliationPolicy.js";

const SYSTEM_ACTOR = "system:migration:leave-reconciliation";

const countsFor = (
  items: ReturnType<typeof reconcileLeaveBalanceProjection>,
) => ({
  compared_buckets: items.length,
  matched_buckets: items.filter((item) => item.status === "MATCHED").length,
  mismatched_buckets: items.filter(
    (item) => item.status === "MISMATCH" || item.status === "MISSING_BUCKET",
  ).length,
  invalid_ledger_buckets: items.filter(
    (item) => item.status === "INVALID_LEDGER",
  ).length,
});

export const runLeaveBalanceReconciliation = async (options: {
  mode: LeaveReconciliationRunMode;
  actorId?: string;
  actionTime?: Date;
}): Promise<LeaveBalanceReconciliationReport> => {
  const runId = randomUUID();
  const actorId = options.actorId ?? SYSTEM_ACTOR;
  const actionTime = options.actionTime ?? new Date();
  const [initialSource, profiles] = await Promise.all([
    loadLeaveReconciliationSource(),
    findEmployeeProfiles(),
  ]);
  const profilesById = new Map(
    profiles.map((profile) => [profile.id, profile]),
  );
  const initialItems = reconcileLeaveBalanceProjection(initialSource);
  let repairedBuckets = 0;
  let staleBuckets = 0;
  let failedBuckets = 0;

  if (options.mode === "REPAIR") {
    for (const item of initialItems) {
      if (item.status !== "MISMATCH" && item.status !== "MISSING_BUCKET") {
        continue;
      }
      const profile = profilesById.get(item.employee_profile_id);
      if (!profile) {
        failedBuckets += 1;
        continue;
      }
      try {
        const result = await repairLeaveBalanceProjection({
          runId,
          actorId,
          actionTime,
          profile,
          item,
        });
        if (result === "APPLIED") repairedBuckets += 1;
        if (result === "STALE") staleBuckets += 1;
      } catch (error) {
        failedBuckets += 1;
        console.error(
          "[leaveReconciliationService] repair failed",
          item.bucket_id,
          error,
        );
      }
    }
  }

  const finalSource =
    options.mode === "REPAIR"
      ? await loadLeaveReconciliationSource()
      : initialSource;
  const items = reconcileLeaveBalanceProjection(finalSource);
  const counts = countsFor(items);
  const syncTime = new Date();
  const report: LeaveBalanceReconciliationReport = {
    run_id: runId,
    mode: options.mode,
    status:
      failedBuckets > 0 || staleBuckets > 0 || counts.invalid_ledger_buckets > 0
        ? "COMPLETED_WITH_ERRORS"
        : "COMPLETED",
    scanned_ledger_entries: finalSource.ledgerEntries.length,
    scanned_buckets: finalSource.buckets.length,
    ...counts,
    repaired_buckets: repairedBuckets,
    stale_buckets: staleBuckets,
    failed_buckets: failedBuckets,
    items,
    created_by: actorId,
    action_time: actionTime,
    sync_time: syncTime,
  };
  if (options.mode !== "DRY_RUN") {
    await recordLeaveReconciliationReport(report);
  }
  return report;
};
