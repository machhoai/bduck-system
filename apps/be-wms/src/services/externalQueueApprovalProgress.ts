import type { ApprovalRecord } from "@bduck/shared-types";
import { canActOnApprovalRecord, type ScopedUser } from "./scopedRoleAccess.js";

export interface ExternalQueueNextApproval {
  level: number;
  role_id: string;
  role_name: string | null;
  approved_count: number;
  required_count: number;
  actionable_record_id?: string | null;
  can_act?: boolean;
}

/**
 * Resolve the actionable approval level for an export voucher.
 *
 * Stored levels are zero-based, while the external queue UI presents levels
 * 1–3. Only the latest resubmission attempt is considered.
 */
export function resolveExternalQueueNextApproval(
  records: readonly ApprovalRecord[],
  roleNamesById: ReadonlyMap<string, string>,
  user?: ScopedUser,
): ExternalQueueNextApproval | null {
  if (records.length === 0) return null;

  const latestAttempt = records.reduce(
    (maximum, record) => Math.max(maximum, record.approval_attempt ?? 1),
    1,
  );
  const currentAttemptRecords = records.filter(
    (record) => (record.approval_attempt ?? 1) === latestAttempt,
  );
  const pendingLevels = currentAttemptRecords
    .filter((record) => record.status === "PENDING")
    .map((record) => record.level);
  if (pendingLevels.length === 0) return null;

  const internalLevel = Math.min(...pendingLevels);
  const levelRecords = currentAttemptRecords.filter(
    (record) => record.level === internalLevel,
  );
  const pendingRecord = levelRecords.find(
    (record) => record.status === "PENDING",
  );
  if (!pendingRecord) return null;

  const alreadyApprovedByUser = user
    ? levelRecords.some(
        (record) =>
          record.status === "APPROVED" && record.approver_id === user.id,
      )
    : false;
  const actionableRecord = user
    ? levelRecords.find(
        (record) =>
          record.status === "PENDING" &&
          record.creator_id !== user.id &&
          !alreadyApprovedByUser &&
          canActOnApprovalRecord(user, record),
      )
    : null;

  return {
    level: internalLevel + 1,
    role_id: pendingRecord.role_id,
    role_name: roleNamesById.get(pendingRecord.role_id) ?? null,
    approved_count: levelRecords.filter(
      (record) => record.status === "APPROVED",
    ).length,
    required_count: levelRecords.length,
    ...(user
      ? {
          actionable_record_id: actionableRecord?.id ?? null,
          can_act: Boolean(actionableRecord),
        }
      : {}),
  };
}
