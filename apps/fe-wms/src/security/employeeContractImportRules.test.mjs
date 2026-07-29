import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const rulesUrl = new URL("../../../../firestore.rules", import.meta.url);

test("contract import collections are backend-only", async () => {
  const rules = await readFile(rulesUrl, "utf8");
  for (const collection of [
    "employee_contract_import_batches",
    "employee_contract_import_rows",
  ]) {
    const pattern = new RegExp(
      `match /${collection}/\\{docId\\} \\{\\s*allow read, write: if false;`,
      "u",
    );
    assert.match(rules, pattern);
  }
});
