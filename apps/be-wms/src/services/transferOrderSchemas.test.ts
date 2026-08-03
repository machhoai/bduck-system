import assert from "node:assert/strict";
import test from "node:test";

import { TransferType } from "@bduck/shared-types";

import { createTransferOrderSchema } from "./transferOrderSchemas.js";

const validItem = {
  product_id: "00000000-0000-4000-8000-000000000001",
  source_location_id: "00000000-0000-4000-8000-000000000002",
  destination_location_id: "00000000-0000-4000-8000-000000000003",
  quantity: 1,
};

const validTransfer = {
  transfer_type: TransferType.INTER_WAREHOUSE,
  source_warehouse_id: "00000000-0000-4000-8000-000000000004",
  destination_warehouse_id: "00000000-0000-4000-8000-000000000005",
  items: [validItem],
};

test("transfer order schema requires a destination location for every item", () => {
  assert.equal(createTransferOrderSchema.safeParse(validTransfer).success, true);

  const { destination_location_id: _omitted, ...itemWithoutDestination } =
    validItem;
  const parsed = createTransferOrderSchema.safeParse({
    ...validTransfer,
    items: [itemWithoutDestination],
  });

  assert.equal(parsed.success, false);
  if (!parsed.success) {
    assert.deepEqual(parsed.error.issues[0]?.path, [
      "items",
      0,
      "destination_location_id",
    ]);
  }
});
