import assert from "node:assert/strict";
import test from "node:test";

test(
  "global HK account and order identity rejects a second warehouse source",
  { skip: !process.env.FIRESTORE_EMULATOR_HOST },
  async () => {
    const [{ db }, repositoryModule] = await Promise.all([
      import("../config/firebase.js"),
      import("./invoiceOrderRepository.js"),
    ]);
    const { invoiceOrderRepository, invoiceSourceOrderDocumentId } =
      repositoryModule;
    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const accountKey = `hk-account-${suffix}`;
    const orderNumber = `HK-${suffix}`;
    const firstWarehouse = `lm81-${suffix}`;
    const secondWarehouse = `aeon-${suffix}`;
    const write = (warehouseId: string) => ({
      source_order_id: orderNumber,
      source_payload_hash: "a".repeat(64),
      raw_payload: { orderNumber },
      projection: {
        warehouse_id: warehouseId,
        source_system: "JOYWORLD",
        external_source_account_key: accountKey,
        external_order_number: orderNumber,
      },
    });

    await invoiceOrderRepository.upsertOrders(
      firstWarehouse,
      `run-first-${suffix}`,
      [write(firstWarehouse)],
      new Date(),
    );
    await assert.rejects(
      invoiceOrderRepository.upsertOrders(
        secondWarehouse,
        `run-second-${suffix}`,
        [write(secondWarehouse)],
        new Date(),
      ),
      /DUPLICATE_GLOBAL_SOURCE_ORDER/,
    );

    const [first, second] = await Promise.all([
      db.collection("invoice_source_orders")
        .doc(invoiceSourceOrderDocumentId(firstWarehouse, orderNumber))
        .get(),
      db.collection("invoice_source_orders")
        .doc(invoiceSourceOrderDocumentId(secondWarehouse, orderNumber))
        .get(),
    ]);
    assert.equal(first.exists, true);
    assert.equal(second.exists, false);
  },
);
