import assert from "node:assert/strict";
import test from "node:test";
import {
  createLocalIntegrationClient,
  hasRequiredIntegrationScopes,
  resolveLocalIntegrationBypass,
} from "./localIntegrationBypass.js";

const enabledEnvironment = {
  NODE_ENV: "development",
  ALLOW_LOCAL_INTEGRATION_BYPASS: "true",
  LOCAL_INTEGRATION_API_KEY: "local-secret-from-env",
  LOCAL_INTEGRATION_ALLOWED_WAREHOUSE_IDS: "store-a, warehouse-b",
};

test("enables local bypass only with every explicit development guard", () => {
  assert.deepEqual(resolveLocalIntegrationBypass(enabledEnvironment), {
    apiKey: "local-secret-from-env",
    allowedWarehouseIds: ["store-a", "warehouse-b"],
  });

  for (const override of [
    { NODE_ENV: "production" },
    { ALLOW_LOCAL_INTEGRATION_BYPASS: "false" },
    { LOCAL_INTEGRATION_API_KEY: "" },
    { LOCAL_INTEGRATION_ALLOWED_WAREHOUSE_IDS: "" },
  ]) {
    assert.equal(
      resolveLocalIntegrationBypass({ ...enabledEnvironment, ...override }),
      null,
    );
  }
});

test("uses only the configured facility allowlist and never discovers all", () => {
  const config = resolveLocalIntegrationBypass({
    ...enabledEnvironment,
    LOCAL_INTEGRATION_ALLOWED_WAREHOUSE_IDS: "store-a,store-a, warehouse-b,  ",
  });
  assert.ok(config);

  const client = createLocalIntegrationClient(
    config,
    new Date("2026-07-15T00:00:00.000Z"),
  );
  assert.deepEqual(client.allowed_warehouse_ids, ["store-a", "warehouse-b"]);
  assert.equal(client.is_active, true);
});

test("local bypass cannot exceed its explicit integration scopes", () => {
  const config = resolveLocalIntegrationBypass(enabledEnvironment);
  assert.ok(config);
  const client = createLocalIntegrationClient(config);

  assert.equal(
    hasRequiredIntegrationScopes(client.scopes, ["scan", "products.read"]),
    true,
  );
  assert.equal(
    hasRequiredIntegrationScopes(client.scopes, ["external_scan.manage_queue"]),
    false,
  );
});
