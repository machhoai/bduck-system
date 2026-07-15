import assert from "node:assert/strict";
import test from "node:test";
import type { TransferOrderItem } from "@bduck/shared-types";
import type { CompleteReceivingInput } from "./transferOrderReceivingService.js";
import { buildReceivingItems } from "./transferReceivingItemPolicy.js";

const input: CompleteReceivingInput = {
  items: [
    {
      item_id: "item-a",
      destination_location_id: "location-destination",
      received_quantity: 4,
    },
  ],
};

const itemDocument = (
  overrides: Partial<TransferOrderItem> = {},
): FirebaseFirestore.QueryDocumentSnapshot =>
  ({
    id: "item-a",
    ref: { path: "transfer_orders/order-a/items/item-a" },
    data: () => ({
      id: "item-a",
      transfer_order_id: "order-a",
      product_id: "product-a",
      source_location_id: "location-source",
      destination_location_id: null,
      quantity: 4,
      received_quantity: null,
      status: "PENDING",
      is_deleted: false,
      ...overrides,
    }),
  }) as unknown as FirebaseFirestore.QueryDocumentSnapshot;

const locationDocument = (
  overrides: Record<string, unknown> = {},
): FirebaseFirestore.DocumentSnapshot =>
  ({
    exists: true,
    data: () => ({
      id: "location-destination",
      warehouse_id: "facility-destination",
      status: "ACTIVE",
      is_deleted: false,
      ...overrides,
    }),
  }) as unknown as FirebaseFirestore.DocumentSnapshot;

test("accepts only complete receiving items owned by the transfer", () => {
  const records = buildReceivingItems(
    "order-a",
    "facility-destination",
    input,
    [itemDocument()],
    [locationDocument()],
  );

  assert.equal(records.length, 1);
  assert.equal(records[0].transferItem.transfer_order_id, "order-a");
});

test("rejects partial, cross-transfer, and cross-facility receiving data", () => {
  assert.throws(() =>
    buildReceivingItems(
      "order-a",
      "facility-destination",
      input,
      [],
      [locationDocument()],
    ),
  );
  assert.throws(() =>
    buildReceivingItems(
      "order-a",
      "facility-destination",
      input,
      [itemDocument({ transfer_order_id: "order-b" })],
      [locationDocument()],
    ),
  );
  assert.throws(() =>
    buildReceivingItems(
      "order-a",
      "facility-destination",
      input,
      [itemDocument()],
      [locationDocument({ warehouse_id: "facility-other" })],
    ),
  );
});
