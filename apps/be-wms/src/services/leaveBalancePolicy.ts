import {
  type LeaveBalanceBucket,
  type LeaveBalanceSummary,
  type LeaveLedgerDelta,
  type LeaveLedgerEntry,
  type LocalDate,
} from "@bduck/shared-types";
import { createHash } from "crypto";
import { getLeaveCarryoverExpiryDate } from "./leavePolicy.js";

const BALANCE_FIELDS = [
  "available_units",
  "held_units",
  "used_units",
  "pending_probation_units",
  "expired_units",
] as const;

export type LeaveBalanceField = (typeof BALANCE_FIELDS)[number];

export const createZeroLeaveDelta = (): LeaveLedgerDelta => ({
  available_units: 0,
  held_units: 0,
  used_units: 0,
  pending_probation_units: 0,
  expired_units: 0,
});

export const createLeaveLedgerDocumentId = (idempotencyKey: string): string =>
  createHash("sha256").update(idempotencyKey).digest("hex");

export const applyLeaveDelta = (
  bucket: LeaveBalanceBucket,
  delta: LeaveLedgerDelta,
): LeaveBalanceBucket => {
  const next = { ...bucket };
  for (const field of BALANCE_FIELDS) {
    const value = bucket[field] + delta[field];
    if (!Number.isFinite(value) || value < 0) {
      throw new Error(`INVALID_LEAVE_BALANCE:${field}`);
    }
    next[field] = value;
  }
  return next;
};

export const getLeaveEntitlementUnits = (
  bucket: Pick<
    LeaveBalanceBucket,
    | "available_units"
    | "held_units"
    | "used_units"
    | "pending_probation_units"
    | "expired_units"
  >,
): number =>
  bucket.available_units +
  bucket.held_units +
  bucket.used_units +
  bucket.pending_probation_units +
  bucket.expired_units;

export const isLeaveYearExpired = (
  leaveYear: number,
  asOfDate: LocalDate,
): boolean => asOfDate > getLeaveCarryoverExpiryDate(leaveYear);

export const buildLeaveBalanceSummary = (input: {
  employee_profile_id: string;
  as_of_date: LocalDate;
  buckets: LeaveBalanceBucket[];
  recent_entries: LeaveLedgerEntry[];
}): LeaveBalanceSummary => {
  const totals = input.buckets.reduce(
    (result, bucket) => ({
      available_units: result.available_units + bucket.available_units,
      held_units: result.held_units + bucket.held_units,
      used_units: result.used_units + bucket.used_units,
      pending_probation_units:
        result.pending_probation_units + bucket.pending_probation_units,
      expired_units: result.expired_units + bucket.expired_units,
    }),
    createZeroLeaveDelta(),
  );

  return {
    employee_profile_id: input.employee_profile_id,
    as_of_date: input.as_of_date,
    ...totals,
    buckets: [...input.buckets].sort(
      (left, right) => right.leave_year - left.leave_year,
    ),
    recent_entries: input.recent_entries,
  };
};
