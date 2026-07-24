import type { LeaveReconciliationRunMode } from "@bduck/shared-types";
import { runLeaveBalanceReconciliation } from "../services/leaveReconciliationService.js";

const resolveMode = (): LeaveReconciliationRunMode => {
  const repair = process.argv.includes("--apply");
  const record = process.argv.includes("--record");
  if (repair && record) {
    throw new Error("Use either --apply or --record, not both.");
  }
  if (repair) return "REPAIR";
  if (record) return "RECORDED";
  return "DRY_RUN";
};

const run = async () => {
  const report = await runLeaveBalanceReconciliation({ mode: resolveMode() });
  console.log(JSON.stringify(report, null, 2));
  if (
    report.mismatched_buckets > 0 ||
    report.invalid_ledger_buckets > 0 ||
    report.stale_buckets > 0 ||
    report.failed_buckets > 0
  ) {
    process.exitCode = 2;
  }
};

run().catch((error) => {
  console.error("[reconcileLeaveBalances] failed", error);
  process.exitCode = 1;
});
