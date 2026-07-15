import { createHash } from "node:crypto";
import { resolveLocalIntegrationBypass } from "../api/middlewares/localIntegrationBypass.js";
import { hasNonEmptySecret } from "../utils/secureSecret.js";

async function seed() {
  const bypassConfig = resolveLocalIntegrationBypass(process.env);
  const apiSecret = process.env.LOCAL_INTEGRATION_API_SECRET;
  if (!bypassConfig || !hasNonEmptySecret(apiSecret)) {
    throw new Error(
      "LOCAL_INTEGRATION_SEED_CONFIG_REQUIRED: enable the development bypass and configure key, secret, and warehouse allowlist",
    );
  }

  const { db } = await import("../config/firebase.js");
  const now = new Date();
  const apiSecretHash = createHash("sha256").update(apiSecret).digest("hex");

  await db
    .collection("integration_clients")
    .doc("ECOM_POS_001")
    .set(
      {
        id: "ECOM_POS_001",
        client_name: "E-Commerce System (local development)",
        api_key: bypassConfig.apiKey,
        api_secret: apiSecret,
        api_secret_hash: apiSecretHash,
        scopes: [
          "scan",
          "locations.read",
          "products.read",
          "external_scan.write",
          "external_count.read",
          "external_count.write",
        ],
        allowed_warehouse_ids: bypassConfig.allowedWarehouseIds,
        ip_whitelist: ["127.0.0.1", "::1"],
        rate_limit_per_minute: 1000,
        is_active: true,
        created_by: "system:local-development-seed",
        created_at: now,
        last_used_at: null,
      },
      { merge: true },
    );

  console.log(
    "Seeded ECOM_POS_001 with explicit warehouse allowlist:",
    bypassConfig.allowedWarehouseIds,
  );
}

seed()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => process.exit());
