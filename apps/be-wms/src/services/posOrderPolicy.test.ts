import assert from "node:assert/strict";
import test from "node:test";

import {
  decidePosOrderCancellation,
  derivePosOrderPaymentStatus,
  derivePosOrderSyncStatus,
  normalizePosOrderPhone,
} from "./posOrderPolicy.js";

test("derives independent lifecycle axes from every legacy status", () => {
  assert.deepEqual(
    ["DRAFT", "LOCAL_PAID", "SYNCING", "SYNC_FAILED", "SYNC_SUCCESS"].map(
      (status) => [
        derivePosOrderPaymentStatus({ status }),
        derivePosOrderSyncStatus({ status }),
      ],
    ),
    [
      ["DRAFT", "NOT_SYNCED"],
      ["PAID", "PENDING"],
      ["PAID", "SYNCING"],
      ["PAID", "SYNC_FAILED"],
      ["PAID", "SYNC_SUCCESS"],
    ],
  );
});

test("implements the approved cancellation matrix", () => {
  assert.equal(
    decidePosOrderCancellation({ status: "DRAFT" }).mode,
    "LOCAL_ONLY",
  );
  assert.equal(
    decidePosOrderCancellation({ status: "LOCAL_PAID" }).mode,
    "LOCAL_ONLY",
  );
  assert.equal(
    decidePosOrderCancellation({ status: "SYNC_FAILED", hkOrderNumber: null })
      .mode,
    "LOCAL_ONLY",
  );
  assert.equal(
    decidePosOrderCancellation({
      status: "SYNC_FAILED",
      hkOrderNumber: "O-1",
    }).mode,
    "REMOTE_REFUND",
  );
  assert.equal(
    decidePosOrderCancellation({ status: "SYNC_SUCCESS" }).mode,
    "REMOTE_REFUND",
  );
  assert.equal(
    decidePosOrderCancellation({ status: "SYNCING" }).code,
    "ORDER_SYNCING",
  );
  assert.equal(
    decidePosOrderCancellation({ status: "SYNC_SUCCESS" }, ["ISSUED"]).code,
    "INVOICE_LOCKED",
  );
  assert.equal(
    decidePosOrderCancellation({
      status: "SYNC_SUCCESS",
      source: "JOYWORLD_IMPORT",
    }).code,
    "IMPORTED_READ_ONLY",
  );
});

test("treats a terminal cancellation as idempotent", () => {
  const decision = decidePosOrderCancellation({
    status: "SYNC_SUCCESS",
    paymentStatus: "REFUNDED",
    syncStatus: "CANCELLED",
  });
  assert.equal(decision.allowed, true);
  assert.equal(decision.idempotent, true);
});

test("normalizes Vietnamese phone numbers for exact filtering", () => {
  assert.equal(normalizePosOrderPhone("+84 908 350 370"), "0908350370");
  assert.equal(normalizePosOrderPhone("0908-350-370"), "0908350370");
  assert.equal(normalizePosOrderPhone(""), null);
});
