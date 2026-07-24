import type {
  LeaveBalanceAllocation,
  LeaveBalanceBucket,
  LeaveRequestDay,
} from "@bduck/shared-types";
import { getLeaveCarryoverExpiryDate } from "./leavePolicy.js";

export interface LeaveAllocationResult {
  allocations: LeaveBalanceAllocation[];
  insufficient_units: number;
}

const canUseBucketForDate = (
  bucket: LeaveBalanceBucket,
  leaveDate: string,
): boolean => {
  const leaveYear = Number(leaveDate.slice(0, 4));
  return (
    !bucket.is_deleted &&
    bucket.leave_year <= leaveYear &&
    leaveDate <= getLeaveCarryoverExpiryDate(bucket.leave_year)
  );
};

export const allocatePaidLeaveUnits = (
  days: readonly LeaveRequestDay[],
  buckets: readonly LeaveBalanceBucket[],
): LeaveAllocationResult => {
  const remainingByYear = new Map(
    buckets.map((bucket) => [bucket.leave_year, bucket.available_units]),
  );
  const allocatedByYear = new Map<number, number>();
  const orderedBuckets = [...buckets].sort(
    (left, right) => left.leave_year - right.leave_year,
  );
  let insufficientUnits = 0;

  for (const day of [...days].sort((a, b) => a.date.localeCompare(b.date))) {
    let remainingDayUnits = day.units;
    for (const bucket of orderedBuckets) {
      if (
        remainingDayUnits <= 0 ||
        !canUseBucketForDate(bucket, day.date)
      ) {
        continue;
      }
      const available = remainingByYear.get(bucket.leave_year) ?? 0;
      const used = Math.min(available, remainingDayUnits);
      if (used <= 0) continue;
      remainingByYear.set(bucket.leave_year, available - used);
      allocatedByYear.set(
        bucket.leave_year,
        (allocatedByYear.get(bucket.leave_year) ?? 0) + used,
      );
      remainingDayUnits -= used;
    }
    insufficientUnits += remainingDayUnits;
  }

  return {
    allocations: [...allocatedByYear.entries()].map(
      ([leave_year, units]) => ({ leave_year, units }),
    ),
    insufficient_units: insufficientUnits,
  };
};
