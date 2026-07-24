import {
  EmployeeEmploymentStatus,
  LeaveImportBatchStatus,
  resolveLeaveFeatureEnabled,
} from "@bduck/shared-types";
import { db } from "../config/firebase.js";
import { getCompanyLeaveApprovalConfig } from "../repositories/leaveApprovalConfigRepository.js";
import { findCompanyLeavePolicy } from "../repositories/leaveBalanceRepository.js";
import { findEmployeeProfiles } from "../repositories/employeeProfileRepository.js";
import { validateEmployeeEmploymentProfile } from "../services/employeeEmploymentPolicy.js";
import { runLeaveBalanceReconciliation } from "../services/leaveReconciliationService.js";
import { hasNonEmptySecret } from "../utils/secureSecret.js";

const run = async () => {
  const [profiles, policy, approvalConfig, reconciliation, importSnapshot] =
    await Promise.all([
      findEmployeeProfiles(),
      findCompanyLeavePolicy(),
      getCompanyLeaveApprovalConfig(),
      runLeaveBalanceReconciliation({ mode: "DRY_RUN" }),
      db
        .collection("leave_import_batches")
        .where("is_deleted", "==", false)
        .get(),
    ]);
  let featureFlagValid = true;
  try {
    resolveLeaveFeatureEnabled(
      process.env.LEAVE_FEATURE_ENABLED,
      process.env.NODE_ENV,
    );
  } catch {
    featureFlagValid = false;
  }

  const incompleteProfiles = profiles.flatMap((profile) => {
    const issues = validateEmployeeEmploymentProfile(profile);
    if (
      profile.employment_status === undefined ||
      profile.employment_status === EmployeeEmploymentStatus.UNSPECIFIED
    ) {
      issues.unshift({
        field: "employment_status",
        messages: {
          vi: "Trạng thái lao động chưa được HR chuẩn hóa.",
          zh: "劳动状态尚未由人事部门规范化。",
        },
      });
    }
    return issues.length > 0
      ? [
          {
            profile_id: profile.id,
            employee_code: profile.employee_code,
            issue_fields: [...new Set(issues.map((issue) => issue.field))],
          },
        ]
      : [];
  });
  const unfinishedImports = importSnapshot.docs
    .map((document) => ({
      id: document.id,
      status: document.data().status as LeaveImportBatchStatus,
    }))
    .filter(
      (batch) =>
        batch.status !== LeaveImportBatchStatus.COMMITTED &&
        batch.status !== LeaveImportBatchStatus.CANCELLED,
    );
  const enabledApprovalLevels =
    approvalConfig?.levels.filter((level) => level.enabled).length ?? 0;
  const blockers = {
    incomplete_profiles: incompleteProfiles.length,
    missing_leave_policy: policy === null,
    invalid_approval_config: enabledApprovalLevels < 1,
    reconciliation_mismatches:
      reconciliation.mismatched_buckets +
      reconciliation.invalid_ledger_buckets +
      reconciliation.failed_buckets +
      reconciliation.stale_buckets,
    missing_cron_secret: !hasNonEmptySecret(
      process.env.LEAVE_MAINTENANCE_CRON_SECRET,
    ),
    missing_employment_cron_secret: !hasNonEmptySecret(
      process.env.EMPLOYEE_EMPLOYMENT_CRON_SECRET,
    ),
    invalid_feature_flag: !featureFlagValid,
  };
  const ready = Object.values(blockers).every(
    (value) => value === 0 || value === false,
  );
  console.log(
    JSON.stringify(
      {
        status: ready ? "READY" : "BLOCKED",
        checked_at: new Date(),
        scanned_profiles: profiles.length,
        blockers,
        incomplete_profiles: incompleteProfiles.slice(0, 100),
        warnings: { unfinished_import_batches: unfinishedImports },
        reconciliation,
      },
      null,
      2,
    ),
  );
  if (!ready) process.exitCode = 2;
};

run().catch((error) => {
  console.error("[auditLeaveRolloutReadiness] failed", error);
  process.exitCode = 1;
});
