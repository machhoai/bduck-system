export const FIRESTORE_IN_MAX_VALUES = 30;

export interface FacilityQueryScopeInput {
  isSystemAdmin: boolean;
  facilityIds: readonly string[] | null | undefined;
}

export type FacilityQueryPlan =
  | { mode: "ALL"; chunks: readonly [] }
  | { mode: "NONE"; chunks: readonly [] }
  | { mode: "SCOPED"; chunks: readonly (readonly string[])[] };

const compareStrings = (left: string, right: string): number => {
  if (left === right) return 0;
  return left < right ? -1 : 1;
};

export const normalizeFacilityIds = (
  facilityIds: readonly string[] | null | undefined,
): string[] => {
  if (!Array.isArray(facilityIds)) return [];

  const normalizedIds = facilityIds.flatMap((facilityId) => {
    if (typeof facilityId !== "string") return [];
    const normalizedId = facilityId.trim();
    return normalizedId.length > 0 ? [normalizedId] : [];
  });

  return [...new Set(normalizedIds)].sort(compareStrings);
};

export const chunkFacilityIds = (
  facilityIds: readonly string[] | null | undefined,
): string[][] => {
  const normalizedIds = normalizeFacilityIds(facilityIds);
  const chunks: string[][] = [];

  for (
    let startIndex = 0;
    startIndex < normalizedIds.length;
    startIndex += FIRESTORE_IN_MAX_VALUES
  ) {
    chunks.push(
      normalizedIds.slice(startIndex, startIndex + FIRESTORE_IN_MAX_VALUES),
    );
  }

  return chunks;
};

/**
 * Builds a fail-closed query plan. Only the literal boolean `true` may produce
 * an unrestricted plan; missing or empty facility scopes produce no queries.
 */
export const buildFacilityQueryPlan = (
  input: FacilityQueryScopeInput,
): FacilityQueryPlan => {
  if (input.isSystemAdmin === true) return { mode: "ALL", chunks: [] };

  const chunks = chunkFacilityIds(input.facilityIds);
  return chunks.length === 0
    ? { mode: "NONE", chunks: [] }
    : { mode: "SCOPED", chunks };
};

export interface FacilityScopedQueryExecutor<
  T,
> extends FacilityQueryScopeInput {
  queryAll: () => Promise<readonly T[]>;
  queryChunk: (facilityIds: readonly string[]) => Promise<readonly T[]>;
}

/**
 * Executes callback-based repository reads without importing Firebase. Domain
 * repositories supply the actual Firestore query and can unit-test it without
 * credentials. Results remain grouped so callers can merge multiple fields.
 */
export const executeFacilityScopedQuery = async <T>(
  input: FacilityScopedQueryExecutor<T>,
): Promise<readonly (readonly T[])[]> => {
  const plan = buildFacilityQueryPlan(input);

  if (plan.mode === "NONE") return [];
  if (plan.mode === "ALL") return [await input.queryAll()];

  return Promise.all(plan.chunks.map((chunk) => input.queryChunk(chunk)));
};

export type StableSortKey = number | string;
export type StableSortDirection = "asc" | "desc";

export interface FacilityQueryCursor<Key extends StableSortKey> {
  sortKey: Key;
  id: string;
}

export interface FacilityQueryPage<T, Key extends StableSortKey> {
  items: T[];
  hasMore: boolean;
  nextCursor: FacilityQueryCursor<Key> | null;
}

export interface MergeFacilityQueryOptions<T, Key extends StableSortKey> {
  direction: StableSortDirection;
  pageSize: number;
  after?: FacilityQueryCursor<Key> | null;
  getSortKey: (record: T) => Key;
}

interface SortableRecord<Key extends StableSortKey> {
  id: string;
  sortKey: Key;
}

interface KeyedRecord<
  T,
  Key extends StableSortKey,
> extends SortableRecord<Key> {
  record: T;
}

const assertValidSortKey = (sortKey: StableSortKey): void => {
  if (typeof sortKey === "number" && !Number.isFinite(sortKey)) {
    throw new TypeError("FACILITY_QUERY_SORT_KEY_INVALID");
  }
};

const compareSortKeys = <Key extends StableSortKey>(
  left: Key,
  right: Key,
): number => {
  if (typeof left !== typeof right) {
    throw new TypeError("FACILITY_QUERY_SORT_KEY_TYPE_MISMATCH");
  }
  if (left === right) return 0;
  return left < right ? -1 : 1;
};

const createRecordComparator = <Key extends StableSortKey>(
  direction: StableSortDirection,
) => {
  return (left: SortableRecord<Key>, right: SortableRecord<Key>): number => {
    const sortComparison = compareSortKeys(left.sortKey, right.sortKey);
    if (sortComparison !== 0) {
      return direction === "asc" ? sortComparison : -sortComparison;
    }
    return compareStrings(left.id, right.id);
  };
};

/**
 * Merges chunked or source/destination query results, keeps the first copy of
 * each document ID, and applies keyset pagination with an ID tie-breaker.
 */
export const mergeFacilityQueryPage = <
  T extends { id: string },
  Key extends StableSortKey,
>(
  queryResults: readonly (readonly T[])[],
  options: MergeFacilityQueryOptions<T, Key>,
): FacilityQueryPage<T, Key> => {
  if (!Number.isInteger(options.pageSize) || options.pageSize <= 0) {
    throw new RangeError("FACILITY_QUERY_PAGE_SIZE_INVALID");
  }

  const uniqueRecords = new Map<string, T>();
  queryResults.forEach((records) => {
    records.forEach((record) => {
      if (record.id.length === 0) {
        throw new TypeError("FACILITY_QUERY_RECORD_ID_REQUIRED");
      }
      if (!uniqueRecords.has(record.id)) uniqueRecords.set(record.id, record);
    });
  });

  const keyedRecords = [...uniqueRecords.values()].map((record) => {
    const sortKey = options.getSortKey(record);
    assertValidSortKey(sortKey);
    return { id: record.id, record, sortKey };
  });
  const compareRecords = createRecordComparator<Key>(options.direction);
  keyedRecords.sort(compareRecords);

  let recordsAfterCursor = keyedRecords;
  if (options.after) {
    if (options.after.id.length === 0) {
      throw new TypeError("FACILITY_QUERY_CURSOR_ID_REQUIRED");
    }
    assertValidSortKey(options.after.sortKey);
    const cursorRecord: SortableRecord<Key> = {
      id: options.after.id,
      sortKey: options.after.sortKey,
    };
    recordsAfterCursor = keyedRecords.filter(
      (record) => compareRecords(record, cursorRecord) > 0,
    );
  }

  const window = recordsAfterCursor.slice(0, options.pageSize + 1);
  const hasMore = window.length > options.pageSize;
  const pageRecords = window.slice(0, options.pageSize);
  const lastRecord = pageRecords.at(-1);

  return {
    items: pageRecords.map(({ record }) => record),
    hasMore,
    nextCursor:
      hasMore && lastRecord
        ? { id: lastRecord.id, sortKey: lastRecord.sortKey }
        : null,
  };
};
