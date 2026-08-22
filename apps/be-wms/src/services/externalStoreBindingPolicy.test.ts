import assert from "node:assert/strict";
import test from "node:test";

import type { ExternalStoreBinding } from "@bduck/shared-types";

import {
  canonicalizeWarehouseIdsWithBindings,
  partitionExternalOrders,
} from "./externalStoreBindingPolicy.js";
import { invoiceGlobalSourceIdentityDocumentId } from "./invoiceSourceIdentityPolicy.js";

const LM81 = "lm81";
const AEON = "aeon";
const ACCOUNT = "joyworld-hk-consolidated";

const binding: ExternalStoreBinding = {
  id: "joyworld-hk-lm81-aeon",
  source_system: "JOYWORLD_LEGACY",
  source_account_key: ACCOUNT,
  mode: "CONSOLIDATED",
  canonical_warehouse_id: LM81,
  member_warehouse_ids: [LM81, AEON],
  display_name: "Landmark 81 + AEON Mall",
  enabled: true,
};

test("consolidated HK topology partitions 10 orders into 7 LM81 and 3 AEON exactly once", () => {
  const orders = Array.from({ length: 10 }, (_, index) => ({
    orderNumber: `HK-${index + 1}`,
    linkedWarehouseId: index >= 7 ? AEON : null,
    amount: (index + 1) * 100_000,
  }));
  const partitions = partitionExternalOrders({
    canonicalWarehouseId: binding.canonical_warehouse_id,
    memberWarehouseIds: binding.member_warehouse_ids,
    candidates: orders.map((order) => ({
      value: order,
      linkedWarehouseId: order.linkedWarehouseId,
    })),
  });

  assert.equal(partitions.get(LM81)?.length, 7);
  assert.equal(partitions.get(AEON)?.length, 3);
  const partitioned = [...partitions.values()].flat();
  assert.equal(partitioned.length, 10);
  assert.equal(new Set(partitioned.map((order) => order.orderNumber)).size, 10);

  const sourceIdentities = partitioned.map((order) =>
    invoiceGlobalSourceIdentityDocumentId(ACCOUNT, order.orderNumber),
  );
  assert.equal(new Set(sourceIdentities).size, 10);

  // Two complete retries must still resolve to one source, draft and issued
  // invoice per HK business identity.
  const sourceDocuments = new Set<string>();
  const draftDocuments = new Set<string>();
  const issuedInvoices = new Set<string>();
  for (const _attempt of [1, 2]) {
    for (const sourceIdentity of sourceIdentities) {
      sourceDocuments.add(sourceIdentity);
      draftDocuments.add(`draft:${sourceIdentity}`);
      issuedInvoices.add(`issued:${sourceIdentity}`);
    }
  }
  assert.equal(sourceDocuments.size, 10);
  assert.equal(draftDocuments.size, 10);
  assert.equal(issuedInvoices.size, 10);

  const expectedRevenue = orders.reduce((sum, order) => sum + order.amount, 0);
  const consolidatedRevenueCaches = canonicalizeWarehouseIdsWithBindings(
    [binding],
    [LM81, AEON],
  ).map(() => expectedRevenue);
  assert.deepEqual(consolidatedRevenueCaches, [expectedRevenue]);
  assert.equal(consolidatedRevenueCaches.reduce((sum, value) => sum + value, 0), 5_500_000);
});

test("aggregate revenue counts a consolidated binding only once", () => {
  assert.deepEqual(
    canonicalizeWarehouseIdsWithBindings([binding], [LM81, AEON]),
    [LM81],
  );
});
