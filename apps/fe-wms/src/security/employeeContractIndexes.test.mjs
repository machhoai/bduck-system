import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const configuration = JSON.parse(
  await readFile(
    new URL("../../../../firestore.indexes.json", import.meta.url),
    "utf8",
  ),
);

const signature = (collectionGroup, fields) =>
  `${collectionGroup}:${fields
    .map(({ fieldPath, order }) => `${fieldPath}:${order}`)
    .join("|")}`;

const configuredSignatures = new Set(
  configuration.indexes.map((index) =>
    signature(index.collectionGroup, index.fields),
  ),
);

const requiredIndexes = [
  [
    "employee_contracts",
    [
      ["workplace_warehouse_id", "ASCENDING"],
      ["is_deleted", "ASCENDING"],
      ["start_date", "DESCENDING"],
    ],
  ],
  [
    "employee_contracts",
    [
      ["employee_profile_id", "ASCENDING"],
      ["employee_user_id", "ASCENDING"],
      ["workplace_warehouse_id", "ASCENDING"],
      ["is_deleted", "ASCENDING"],
      ["start_date", "DESCENDING"],
    ],
  ],
  [
    "employee_contracts",
    [
      ["employee_profile_id", "ASCENDING"],
      ["workplace_warehouse_id", "ASCENDING"],
      ["is_deleted", "ASCENDING"],
      ["start_date", "DESCENDING"],
    ],
  ],
  [
    "employee_contracts",
    [
      ["employee_user_id", "ASCENDING"],
      ["workplace_warehouse_id", "ASCENDING"],
      ["is_deleted", "ASCENDING"],
      ["start_date", "DESCENDING"],
    ],
  ],
  [
    "employee_contracts",
    [
      ["workplace_warehouse_id", "ASCENDING"],
      ["status", "ASCENDING"],
      ["is_deleted", "ASCENDING"],
      ["end_date", "ASCENDING"],
    ],
  ],
  [
    "employee_contracts",
    [
      ["status", "ASCENDING"],
      ["is_deleted", "ASCENDING"],
      ["end_date", "ASCENDING"],
    ],
  ],
  [
    "employee_contract_documents",
    [
      ["contract_id", "ASCENDING"],
      ["employee_user_id", "ASCENDING"],
      ["workplace_warehouse_id", "ASCENDING"],
      ["is_deleted", "ASCENDING"],
      ["version", "DESCENDING"],
    ],
  ],
  [
    "employee_contract_documents",
    [
      ["contract_id", "ASCENDING"],
      ["workplace_warehouse_id", "ASCENDING"],
      ["is_deleted", "ASCENDING"],
      ["version", "DESCENDING"],
    ],
  ],
  [
    "employee_contract_documents",
    [
      ["employee_user_id", "ASCENDING"],
      ["workplace_warehouse_id", "ASCENDING"],
      ["is_deleted", "ASCENDING"],
      ["version", "DESCENDING"],
    ],
  ],
  [
    "employee_contract_documents",
    [
      ["workplace_warehouse_id", "ASCENDING"],
      ["is_deleted", "ASCENDING"],
      ["updated_at", "DESCENDING"],
    ],
  ],
].map(([collectionGroup, fields]) =>
  signature(
    collectionGroup,
    fields.map(([fieldPath, order]) => ({ fieldPath, order })),
  ),
);

test("declares every employee contract query index", () => {
  for (const required of requiredIndexes) {
    assert.ok(configuredSignatures.has(required), `Missing index: ${required}`);
  }
});

test("contract indexes are collection-scoped and sparse", () => {
  const contractIndexes = configuration.indexes.filter((index) =>
    ["employee_contracts", "employee_contract_documents"].includes(
      index.collectionGroup,
    ),
  );
  assert.equal(contractIndexes.length, requiredIndexes.length);
  for (const index of contractIndexes) {
    assert.equal(index.queryScope, "COLLECTION");
    assert.equal(index.density, "SPARSE_ALL");
  }
});
