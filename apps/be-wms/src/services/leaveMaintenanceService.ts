import {
  EmployeeEmploymentStatus,
  LEAVE_DEFAULT_ANNUAL_CAP_UNITS,
  LEAVE_DEFAULT_MONTHLY_ACCRUAL_UNITS,
  LeaveLedgerEntryType,
  type EmployeeProfile,
  type LeaveLedgerDelta,
  type LeavePolicy,
  type LocalDate,
} from "@bduck/shared-types";
import {
  findCompanyLeavePolicy,
  findLeaveBalanceBuckets,
  type ApplyLeaveLedgerEntryResult,
} from "../repositories/leaveBalanceRepository.js";
import { findEmployeeProfiles } from "../repositories/employeeProfileRepository.js";
import {
  createZeroLeaveDelta,
  isLeaveYearExpired,
} from "./leaveBalancePolicy.js";
import {
  applyLeaveLedgerEntryWithAudit,
  releaseProbationLeaveForProfile,
} from "./leaveBalanceService.js";
import { getVietnamLocalDate } from "./employeeEmploymentPolicy.js";
import {
  classifyMonthlyLeaveAccrual,
  type MonthlyLeaveAccrualClassification,
} from "./leavePolicy.js";

const SYSTEM_ACTOR = "system:cloud-scheduler:leave-maintenance";

interface EffectiveLeavePolicy {
  monthly_accrual_units: number;
  annual_cap_units: number;
}

export interface LeaveMaintenanceResult {
  posting_date: LocalDate;
  scanned_profiles: number;
  accruals_applied: number;
  probation_releases_applied: number;
  expirations_applied: number;
  duplicates: number;
  capped: number;
  skipped: number;
  failed: number;
}

const invalidEmploymentDateError = {
  statusCode: 400,
  messages: {
    vi: "Mốc ngày lao động không hợp lệ nên chưa thể tính ngày phép.",
    zh: "劳动日期无效，暂时无法计算假期余额。",
  },
};

const invalidPolicyError = {
  statusCode: 500,
  messages: {
    vi: "Chính sách ngày phép có giá trị tích lũy hoặc giới hạn năm không hợp lệ.",
    zh: "假期政策中的累积值或年度上限无效。",
  },
};

const resolveEffectivePolicy = (
  configured: LeavePolicy | null,
): EffectiveLeavePolicy => {
  const policy = {
    monthly_accrual_units:
      configured?.monthly_accrual_units ?? LEAVE_DEFAULT_MONTHLY_ACCRUAL_UNITS,
    annual_cap_units:
      configured?.annual_cap_units ?? LEAVE_DEFAULT_ANNUAL_CAP_UNITS,
  };
  if (
    !Number.isFinite(policy.monthly_accrual_units) ||
    policy.monthly_accrual_units <= 0 ||
    !Number.isFinite(policy.annual_cap_units) ||
    policy.annual_cap_units <= 0
  ) {
    throw invalidPolicyError;
  }
  return policy;
};

const incrementResult = (
  result: LeaveMaintenanceResult,
  writeResult: ApplyLeaveLedgerEntryResult,
  appliedField:
    | "accruals_applied"
    | "probation_releases_applied"
    | "expirations_applied",
) => {
  if (writeResult.status === "APPLIED") result[appliedField] += 1;
  if (writeResult.status === "DUPLICATE") result.duplicates += 1;
  if (writeResult.status === "ANNUAL_CAP_REACHED") result.capped += 1;
};

const accrualDeltaFor = (
  classification: MonthlyLeaveAccrualClassification,
  units: number,
): LeaveLedgerDelta => ({
  ...createZeroLeaveDelta(),
  ...(classification === "PENDING_PROBATION"
    ? { pending_probation_units: units }
    : { available_units: units }),
});

const applyMonthlyAccrual = async (
  profile: EmployeeProfile,
  postingDate: LocalDate,
  policy: EffectiveLeavePolicy,
  actorId: string,
) => {
  const classification = classifyMonthlyLeaveAccrual({
    posting_date: postingDate,
    probation_start_date: profile.probation_start_date ?? null,
    official_start_date: profile.official_start_date ?? null,
    resignation_date: profile.resignation_date ?? null,
  });
  if (classification === "INVALID_DATE") throw invalidEmploymentDateError;
  if (
    classification !== "PENDING_PROBATION" &&
    classification !== "AVAILABLE"
  ) {
    return null;
  }

  const entryType =
    classification === "PENDING_PROBATION"
      ? LeaveLedgerEntryType.PROBATION_ACCRUAL
      : LeaveLedgerEntryType.MONTHLY_ACCRUAL;
  return applyLeaveLedgerEntryWithAudit({
    profile,
    leave_year: Number(postingDate.slice(0, 4)),
    posting_date: postingDate,
    entry_type: entryType,
    delta: accrualDeltaFor(classification, policy.monthly_accrual_units),
    idempotency_key: `leave-accrual:${profile.id}:${postingDate}`,
    source_reference: postingDate,
    reason: classification,
    created_by: actorId,
    annual_cap_units: policy.annual_cap_units,
  });
};

const expireCarryoverForProfile = async (
  profile: EmployeeProfile,
  postingDate: LocalDate,
  actorId: string,
) => {
  const buckets = await findLeaveBalanceBuckets(profile.id);
  const results: ApplyLeaveLedgerEntryResult[] = [];
  for (const bucket of buckets) {
    if (
      bucket.available_units <= 0 ||
      !isLeaveYearExpired(bucket.leave_year, postingDate)
    ) {
      continue;
    }
    const units = bucket.available_units;
    results.push(
      await applyLeaveLedgerEntryWithAudit({
        profile,
        leave_year: bucket.leave_year,
        posting_date: postingDate,
        entry_type: LeaveLedgerEntryType.YEAR_END_EXPIRED,
        delta: {
          ...createZeroLeaveDelta(),
          available_units: -units,
          expired_units: units,
        },
        idempotency_key: `leave-expiry:${profile.id}:${bucket.leave_year}:${bucket.last_ledger_entry_id ?? "initial"}`,
        reason: "CARRYOVER_EXPIRED_AFTER_MARCH_31",
        created_by: actorId,
      }),
    );
  }
  return results;
};

export const runDailyLeaveMaintenance = async (
  postingDate = getVietnamLocalDate(),
  actorId = SYSTEM_ACTOR,
): Promise<LeaveMaintenanceResult> => {
  const [profiles, configuredPolicy] = await Promise.all([
    findEmployeeProfiles(),
    findCompanyLeavePolicy(),
  ]);
  const policy = resolveEffectivePolicy(configuredPolicy);
  const result: LeaveMaintenanceResult = {
    posting_date: postingDate,
    scanned_profiles: profiles.length,
    accruals_applied: 0,
    probation_releases_applied: 0,
    expirations_applied: 0,
    duplicates: 0,
    capped: 0,
    skipped: 0,
    failed: 0,
  };

  for (const profile of profiles) {
    if (
      !profile.employment_status ||
      profile.employment_status === EmployeeEmploymentStatus.UNSPECIFIED
    ) {
      result.skipped += 1;
      continue;
    }
    try {
      const accrual = await applyMonthlyAccrual(
        profile,
        postingDate,
        policy,
        actorId,
      );
      if (accrual) incrementResult(result, accrual, "accruals_applied");

      const releases = await releaseProbationLeaveForProfile(
        profile,
        postingDate,
        actorId,
      );
      releases.forEach((item) =>
        incrementResult(result, item, "probation_releases_applied"),
      );

      const expirations = await expireCarryoverForProfile(
        profile,
        postingDate,
        actorId,
      );
      expirations.forEach((item) =>
        incrementResult(result, item, "expirations_applied"),
      );
    } catch (error) {
      result.failed += 1;
      console.error(
        "[leaveMaintenanceService] failed for profile",
        profile.id,
        error,
      );
    }
  }
  return result;
};
