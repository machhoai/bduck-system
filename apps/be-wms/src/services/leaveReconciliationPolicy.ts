import {
  LEAVE_RECONCILIATION_DIMENSIONS,
  type LeaveBalanceBucket,
  type LeaveBalanceReconciliationItem,
  type LeaveLedgerDelta,
  type LeaveLedgerEntry,
} from "@bduck/shared-types";

const bucketKey = (profileId: string, leaveYear: number) =>
  `${profileId}_${leaveYear}`;

const zeroDelta = (): LeaveLedgerDelta => ({
  available_units: 0,
  held_units: 0,
  used_units: 0,
  pending_probation_units: 0,
  expired_units: 0,
});

const unitsEqual = (left: number, right: number) =>
  Math.abs(left - right) < 0.000_001;

const isHalfUnit = (value: number) =>
  Number.isFinite(value) && Number.isInteger(value * 2);

const entryTime = (entry: LeaveLedgerEntry): number => {
  const value = entry.created_at as unknown;
  if (value instanceof Date) return value.getTime();
  if (
    value &&
    typeof value === "object" &&
    "toMillis" in value &&
    typeof value.toMillis === "function"
  ) {
    return value.toMillis();
  }
  return 0;
};

const actualDeltaFor = (bucket: LeaveBalanceBucket): LeaveLedgerDelta => ({
  available_units: bucket.available_units,
  held_units: bucket.held_units,
  used_units: bucket.used_units,
  pending_probation_units: bucket.pending_probation_units,
  expired_units: bucket.expired_units,
});

export const reconcileLeaveBalanceProjection = (input: {
  ledgerEntries: readonly LeaveLedgerEntry[];
  buckets: readonly LeaveBalanceBucket[];
}): LeaveBalanceReconciliationItem[] => {
  const entriesByBucket = new Map<string, LeaveLedgerEntry[]>();
  input.ledgerEntries.forEach((entry) => {
    const key = bucketKey(entry.employee_profile_id, entry.leave_year);
    const entries = entriesByBucket.get(key) ?? [];
    entries.push(entry);
    entriesByBucket.set(key, entries);
  });
  const bucketsById = new Map(
    input.buckets.map((bucket) => [bucket.id, bucket]),
  );
  const keys = new Set([...entriesByBucket.keys(), ...bucketsById.keys()]);

  return [...keys].sort().map((key) => {
    const entries = entriesByBucket.get(key) ?? [];
    const bucket = bucketsById.get(key) ?? null;
    const expected = entries.reduce((total, entry) => {
      LEAVE_RECONCILIATION_DIMENSIONS.forEach((field) => {
        total[field] += entry.delta[field];
      });
      return total;
    }, zeroDelta());
    const actual = bucket ? actualDeltaFor(bucket) : null;
    const differingFields: LeaveBalanceReconciliationItem["differing_fields"] =
      actual
        ? LEAVE_RECONCILIATION_DIMENSIONS.filter(
            (field) => !unitsEqual(expected[field], actual[field]),
          )
        : [...LEAVE_RECONCILIATION_DIMENSIONS];
    const latestEntry = [...entries].sort(
      (left, right) =>
        entryTime(right) - entryTime(left) || right.id.localeCompare(left.id),
    )[0];
    const invalidLedger = LEAVE_RECONCILIATION_DIMENSIONS.some(
      (field) => expected[field] < 0 || !isHalfUnit(expected[field]),
    );
    if (bucket && bucket.last_ledger_entry_id !== (latestEntry?.id ?? null)) {
      differingFields.push("last_ledger_entry_id");
    }

    return {
      bucket_id: key,
      employee_profile_id:
        bucket?.employee_profile_id ?? entries[0]?.employee_profile_id ?? "",
      leave_year: bucket?.leave_year ?? entries[0]?.leave_year ?? 0,
      workplace_warehouse_id:
        bucket?.workplace_warehouse_id ??
        entries[0]?.workplace_warehouse_id ??
        null,
      status: invalidLedger
        ? "INVALID_LEDGER"
        : !bucket
          ? "MISSING_BUCKET"
          : differingFields.length > 0
            ? "MISMATCH"
            : "MATCHED",
      differing_fields: differingFields,
      expected,
      actual,
      expected_last_ledger_entry_id: latestEntry?.id ?? null,
      actual_last_ledger_entry_id: bucket?.last_ledger_entry_id ?? null,
    };
  });
};
