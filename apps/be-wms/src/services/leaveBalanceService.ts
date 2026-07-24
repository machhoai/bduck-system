import {
  AuditAction,
  LeaveLedgerEntryType,
  type EmployeeProfile,
} from "@bduck/shared-types";
import {
  applyLeaveLedgerEntry,
  findLeaveBalanceBuckets,
  findLeaveLedgerEntries,
  type ApplyLeaveLedgerEntryResult,
} from "../repositories/leaveBalanceRepository.js";
import { getEmployeeProfileByUserId } from "../repositories/employeeProfileRepository.js";
import { logAudit } from "./auditService.js";
import type { AuthorizationService } from "./authorization/index.js";
import {
  buildLeaveBalanceSummary,
  createZeroLeaveDelta,
} from "./leaveBalancePolicy.js";
import { getVietnamLocalDate } from "./employeeEmploymentPolicy.js";

const SYSTEM_ACTOR = "system:cloud-scheduler:leave-maintenance";

const profileNotFoundError = {
  statusCode: 404,
  messages: {
    vi: "Hồ sơ nhân viên chưa được liên kết với tài khoản hiện tại.",
    zh: "当前账户尚未关联员工档案。",
  },
};

const writeLeaveAudits = async (
  result: ApplyLeaveLedgerEntryResult,
  actorId: string,
) => {
  if (result.status !== "APPLIED" || !result.entry || !result.bucket) return;
  await Promise.all([
    logAudit({
      entity_type: "leave_ledger_entries",
      entity_id: result.entry.id,
      warehouse_id: result.entry.workplace_warehouse_id,
      action: AuditAction.CREATE,
      user_id: actorId,
      old_value: null,
      new_value: result.entry as unknown as Record<string, unknown>,
    }),
    logAudit({
      entity_type: "leave_balance_buckets",
      entity_id: result.bucket.id,
      warehouse_id: result.bucket.workplace_warehouse_id,
      action: result.previous_bucket ? AuditAction.UPDATE : AuditAction.CREATE,
      user_id: actorId,
      old_value: result.previous_bucket
        ? (result.previous_bucket as unknown as Record<string, unknown>)
        : null,
      new_value: result.bucket as unknown as Record<string, unknown>,
    }),
  ]);
};

export const applyLeaveLedgerEntryWithAudit = async (
  input: Parameters<typeof applyLeaveLedgerEntry>[0],
) => {
  const result = await applyLeaveLedgerEntry(input);
  await writeLeaveAudits(result, input.created_by);
  return result;
};

export const releaseProbationLeaveForProfile = async (
  profile: EmployeeProfile,
  postingDate: string,
  actorId = SYSTEM_ACTOR,
): Promise<ApplyLeaveLedgerEntryResult[]> => {
  if (
    !profile.official_start_date ||
    profile.official_start_date > postingDate
  ) {
    return [];
  }
  const buckets = await findLeaveBalanceBuckets(profile.id);
  const results: ApplyLeaveLedgerEntryResult[] = [];
  for (const bucket of buckets) {
    if (bucket.pending_probation_units <= 0) continue;
    const units = bucket.pending_probation_units;
    results.push(
      await applyLeaveLedgerEntryWithAudit({
        profile,
        leave_year: bucket.leave_year,
        posting_date: postingDate,
        entry_type: LeaveLedgerEntryType.PROBATION_RELEASE,
        delta: {
          ...createZeroLeaveDelta(),
          available_units: units,
          pending_probation_units: -units,
        },
        idempotency_key: `probation-release:${profile.id}:${bucket.leave_year}:${bucket.last_ledger_entry_id ?? "initial"}`,
        reason: "OFFICIAL_STATUS_EFFECTIVE",
        created_by: actorId,
      }),
    );
  }
  return results;
};

export const fetchMyLeaveBalance = async (
  userId: string,
  authorization: AuthorizationService,
  asOfDate = getVietnamLocalDate(),
) => {
  const profile = await getEmployeeProfileByUserId(userId);
  if (!profile) throw profileNotFoundError;
  authorization.assert("leave.self.read", profile.workplace_warehouse_id);
  const [buckets, entries] = await Promise.all([
    findLeaveBalanceBuckets(profile.id),
    findLeaveLedgerEntries(profile.id),
  ]);
  return buildLeaveBalanceSummary({
    employee_profile_id: profile.id,
    as_of_date: asOfDate,
    buckets,
    recent_entries: entries,
  });
};
