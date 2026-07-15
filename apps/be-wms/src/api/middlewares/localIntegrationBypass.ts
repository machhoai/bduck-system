import type { IntegrationClient } from "@bduck/shared-types";
import { hasNonEmptySecret } from "../../utils/secureSecret.js";

const LOCAL_INTEGRATION_SCOPES = [
  "scan",
  "locations.read",
  "products.read",
  "external_scan.write",
  "external_count.read",
  "external_count.write",
];

export interface LocalIntegrationBypassConfig {
  apiKey: string;
  allowedWarehouseIds: string[];
}

type Environment = Readonly<Record<string, string | undefined>>;

const parseAllowlist = (value: string | undefined): string[] =>
  Array.from(
    new Set(
      (value || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );

export const resolveLocalIntegrationBypass = (
  environment: Environment,
): LocalIntegrationBypassConfig | null => {
  if (
    environment.NODE_ENV !== "development" ||
    environment.ALLOW_LOCAL_INTEGRATION_BYPASS !== "true" ||
    !hasNonEmptySecret(environment.LOCAL_INTEGRATION_API_KEY)
  ) {
    return null;
  }

  const allowedWarehouseIds = parseAllowlist(
    environment.LOCAL_INTEGRATION_ALLOWED_WAREHOUSE_IDS,
  );
  if (allowedWarehouseIds.length === 0) return null;

  return {
    apiKey: environment.LOCAL_INTEGRATION_API_KEY,
    allowedWarehouseIds,
  };
};

export const createLocalIntegrationClient = (
  config: LocalIntegrationBypassConfig,
  now = new Date(),
): IntegrationClient => ({
  id: "LOCAL_INTEGRATION_DEV",
  client_name: "Local integration (development only)",
  api_key: config.apiKey,
  api_secret_hash: "",
  scopes: [...LOCAL_INTEGRATION_SCOPES],
  allowed_warehouse_ids: [...config.allowedWarehouseIds],
  ip_whitelist: [],
  rate_limit_per_minute: 1000,
  is_active: true,
  created_by: "system:local-development",
  created_at: now,
  last_used_at: now,
});

export const hasRequiredIntegrationScopes = (
  clientScopes: readonly string[],
  requiredScopes: readonly string[],
): boolean => requiredScopes.every((scope) => clientScopes.includes(scope));
