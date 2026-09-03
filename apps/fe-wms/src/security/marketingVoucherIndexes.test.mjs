import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

const config = JSON.parse(
  await readFile(
    new URL("../../../../firestore.indexes.json", import.meta.url),
    "utf8",
  ),
);

const signature = (index) =>
  `${index.collectionGroup}:${index.fields
    .map((field) => `${field.fieldPath}:${field.order ?? field.arrayConfig}`)
    .join(",")}`;

describe("marketing voucher Firestore indexes", () => {
  it("declares every cursor-based campaign, code and job query", () => {
    const actual = new Set(config.indexes.map(signature));
    const expected = [
      "marketing_voucher_campaigns:is_deleted:ASCENDING,updated_at:DESCENDING",
      "marketing_voucher_campaigns:status:ASCENDING,is_deleted:ASCENDING,updated_at:DESCENDING",
      "marketing_voucher_campaigns:purpose:ASCENDING,is_deleted:ASCENDING,updated_at:DESCENDING",
      "marketing_voucher_campaigns:status:ASCENDING,purpose:ASCENDING,is_deleted:ASCENDING,updated_at:DESCENDING",
      "marketing_voucher_codes:is_deleted:ASCENDING,created_at:DESCENDING",
      "marketing_voucher_codes:campaign_id:ASCENDING,is_deleted:ASCENDING,created_at:DESCENDING",
      "marketing_voucher_codes:campaign_id:ASCENDING,status:ASCENDING,is_deleted:ASCENDING,created_at:DESCENDING",
      "marketing_voucher_codes:status:ASCENDING,is_deleted:ASCENDING,created_at:DESCENDING",
      "marketing_voucher_codes:reward_type:ASCENDING,is_deleted:ASCENDING,created_at:DESCENDING",
      "marketing_voucher_codes:campaign_id:ASCENDING,reward_type:ASCENDING,is_deleted:ASCENDING,created_at:DESCENDING",
      "marketing_voucher_codes:status:ASCENDING,reward_type:ASCENDING,is_deleted:ASCENDING,created_at:DESCENDING",
      "marketing_voucher_codes:campaign_id:ASCENDING,status:ASCENDING,reward_type:ASCENDING,is_deleted:ASCENDING,created_at:DESCENDING",
      "marketing_voucher_jobs:status:ASCENDING,is_deleted:ASCENDING,created_at:DESCENDING",
      "marketing_voucher_jobs:is_deleted:ASCENDING,created_at:DESCENDING",
      "marketing_voucher_jobs:campaign_id:ASCENDING,is_deleted:ASCENDING,created_at:DESCENDING",
      "marketing_voucher_jobs:type:ASCENDING,is_deleted:ASCENDING,created_at:DESCENDING",
      "marketing_voucher_codes:campaign_id:ASCENDING,status:ASCENDING,is_deleted:ASCENDING,__name__:ASCENDING",
      "marketing_voucher_codes:campaign_id:ASCENDING,is_deleted:ASCENDING,__name__:ASCENDING",
      "marketing_voucher_jobs:campaign_id:ASCENDING,status:ASCENDING,is_deleted:ASCENDING,created_at:DESCENDING",
      "marketing_voucher_jobs:campaign_id:ASCENDING,type:ASCENDING,is_deleted:ASCENDING,created_at:DESCENDING",
      "marketing_voucher_jobs:status:ASCENDING,type:ASCENDING,is_deleted:ASCENDING,created_at:DESCENDING",
      "marketing_voucher_jobs:campaign_id:ASCENDING,status:ASCENDING,type:ASCENDING,is_deleted:ASCENDING,created_at:DESCENDING",
    ];
    expected.forEach((required) => assert.ok(actual.has(required), required));
  });

  it("does not index migrated recipient PII or reconciliation hashes", () => {
    const disabled = new Set(
      config.fieldOverrides
        .filter(
          (override) =>
            override.collectionGroup === "marketing_voucher_codes" &&
            override.indexes.length === 0,
        )
        .map((override) => override.fieldPath),
    );
    assert.deepEqual([...disabled].sort(), [
      "distributed_to_phone",
      "emailed_to",
      "source_hash",
    ]);
  });
});
