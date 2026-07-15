import assert from "node:assert/strict";
import test from "node:test";
import {
  FIRESTORE_IN_MAX_VALUES,
  buildFacilityQueryPlan,
  chunkFacilityIds,
  executeFacilityScopedQuery,
  mergeFacilityQueryPage,
} from "./facilityScopedQuery.js";

test("missing and empty facility scopes fail closed", async () => {
  let unrestrictedQueryCount = 0;
  let scopedQueryCount = 0;
  const queryAll = async (): Promise<string[]> => {
    unrestrictedQueryCount += 1;
    return ["unrestricted"];
  };
  const queryChunk = async (): Promise<string[]> => {
    scopedQueryCount += 1;
    return ["scoped"];
  };

  for (const facilityIds of [undefined, null, [], ["", "   "]]) {
    const results = await executeFacilityScopedQuery({
      facilityIds,
      isSystemAdmin: false,
      queryAll,
      queryChunk,
    });
    assert.deepEqual(results, []);
  }

  assert.equal(unrestrictedQueryCount, 0);
  assert.equal(scopedQueryCount, 0);
});

test("only an explicit system admin may run an unrestricted query", async () => {
  let unrestrictedQueryCount = 0;
  const queryAll = async (): Promise<string[]> => {
    unrestrictedQueryCount += 1;
    return ["all"];
  };
  const queryChunk = async (): Promise<string[]> => {
    throw new Error("scoped query should not run");
  };

  const implicitAdminPlan = buildFacilityQueryPlan({
    facilityIds: [],
    isSystemAdmin: undefined as unknown as boolean,
  });
  assert.equal(implicitAdminPlan.mode, "NONE");

  const results = await executeFacilityScopedQuery({
    facilityIds: [],
    isSystemAdmin: true,
    queryAll,
    queryChunk,
  });

  assert.deepEqual(results, [["all"]]);
  assert.equal(unrestrictedQueryCount, 1);
});

test("facility IDs are normalized, deduplicated and chunked at 30", () => {
  assert.deepEqual(
    chunkFacilityIds(["facility-b", " facility-a ", "facility-b"]),
    [["facility-a", "facility-b"]],
  );

  const facilityIds = Array.from(
    { length: FIRESTORE_IN_MAX_VALUES * 2 + 5 },
    (_, index) => `facility-${String(index).padStart(3, "0")}`,
  );
  const chunks = chunkFacilityIds([...facilityIds, ...facilityIds.slice(0, 4)]);

  assert.deepEqual(
    chunks.map((chunk) => chunk.length),
    [30, 30, 5],
  );
  assert.deepEqual(chunks.flat(), facilityIds);
  assert.equal(
    chunks.every((chunk) => chunk.length > 0),
    true,
  );
});

test("scoped execution never sends an empty Firestore in-clause", async () => {
  const observedChunks: string[][] = [];
  const facilityIds = Array.from(
    { length: FIRESTORE_IN_MAX_VALUES + 1 },
    (_, index) => `facility-${String(index).padStart(2, "0")}`,
  );

  await executeFacilityScopedQuery({
    facilityIds,
    isSystemAdmin: false,
    queryAll: async () => {
      throw new Error("unrestricted query should not run");
    },
    queryChunk: async (chunk) => {
      observedChunks.push([...chunk]);
      return [];
    },
  });

  assert.deepEqual(
    observedChunks.map((chunk) => chunk.length),
    [30, 1],
  );
  assert.equal(
    observedChunks.every((chunk) => chunk.length > 0),
    true,
  );
});

interface TransferRecord {
  id: string;
  createdAt: number;
}

const transfer = (id: string, createdAt: number): TransferRecord => ({
  id,
  createdAt,
});

test("source and destination results are deduplicated and globally sorted", () => {
  const sharedTransfer = transfer("transfer-shared", 200);
  const page = mergeFacilityQueryPage(
    [
      [transfer("transfer-source", 300), sharedTransfer],
      [sharedTransfer, transfer("transfer-destination", 400)],
    ],
    {
      direction: "desc",
      pageSize: 10,
      getSortKey: (record) => record.createdAt,
    },
  );

  assert.deepEqual(
    page.items.map(({ id }) => id),
    ["transfer-destination", "transfer-source", "transfer-shared"],
  );
  assert.equal(page.hasMore, false);
  assert.equal(page.nextCursor, null);
});

test("keyset pagination is stable when sort values tie", () => {
  const queryResults = [
    [transfer("transfer-c", 100), transfer("transfer-a", 100)],
    [
      transfer("transfer-b", 100),
      transfer("transfer-d", 90),
      transfer("transfer-e", 80),
      transfer("transfer-a", 100),
    ],
  ];
  const baseOptions = {
    direction: "desc" as const,
    pageSize: 2,
    getSortKey: (record: TransferRecord) => record.createdAt,
  };

  const firstPage = mergeFacilityQueryPage(queryResults, baseOptions);
  const secondPage = mergeFacilityQueryPage(queryResults, {
    ...baseOptions,
    after: firstPage.nextCursor,
  });
  const thirdPage = mergeFacilityQueryPage(queryResults, {
    ...baseOptions,
    after: secondPage.nextCursor,
  });

  assert.deepEqual(
    firstPage.items.map(({ id }) => id),
    ["transfer-a", "transfer-b"],
  );
  assert.deepEqual(firstPage.nextCursor, {
    id: "transfer-b",
    sortKey: 100,
  });
  assert.deepEqual(
    secondPage.items.map(({ id }) => id),
    ["transfer-c", "transfer-d"],
  );
  assert.deepEqual(secondPage.nextCursor, {
    id: "transfer-d",
    sortKey: 90,
  });
  assert.deepEqual(
    thirdPage.items.map(({ id }) => id),
    ["transfer-e"],
  );
  assert.equal(thirdPage.hasMore, false);
  assert.equal(thirdPage.nextCursor, null);
});
