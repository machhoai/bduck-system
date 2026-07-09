import { createHash } from "crypto";
import { resolveOpenApiConfig } from "./openApiConfigService.js";

export interface OpenApiActionResponse {
  success?: boolean;
  code?: number;
  msg?: string;
  desc?: string;
  data?: unknown;
  [key: string]: unknown;
}

const buildActionUrl = (baseUrl: string) => {
  const trimmed = baseUrl.replace(/\/+$/, "");
  return trimmed.endsWith("/openapi/action")
    ? trimmed
    : `${trimmed}/openapi/action`;
};

const signOpenApiPayload = (params: {
  appId: string;
  action: string;
  version: string;
  timestamp: string;
  body: string;
  secretKey: string;
}) =>
  createHash("md5")
    .update(
      `${params.appId}${params.action}${params.version}${params.timestamp}${params.body}${params.secretKey}`,
    )
    .digest("hex")
    .toUpperCase();

const getActionVersion = (
  config: Awaited<ReturnType<typeof resolveOpenApiConfig>>,
  action: string,
) => config.action_versions?.[action] || config.api_version;

export const callOpenApiAction = async (
  warehouseId: string,
  action: string,
  body: Record<string, unknown> = {},
): Promise<OpenApiActionResponse> => {
  const config = await resolveOpenApiConfig(warehouseId);
  const version = getActionVersion(config, action);
  const timestamp = String(Date.now());
  const bodyText = JSON.stringify(body);
  const payload = {
    appId: config.app_id,
    action,
    version,
    timestamp,
    sign: signOpenApiPayload({
      appId: config.app_id,
      action,
      version,
      timestamp,
      body: bodyText,
      secretKey: config.secret_key,
    }),
    body: bodyText,
  };

  const response = await fetch(buildActionUrl(config.base_url), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = (await response.json().catch(() => null)) as
    | OpenApiActionResponse
    | null;

  if (!response.ok || !json) {
    throw new Error(`[openApiService] ${action} failed: HTTP ${response.status}`);
  }
  if (json.success === false) {
    throw new Error(
      `[openApiService] ${action} failed: ${json.msg || json.desc || "unknown error"}`,
    );
  }
  return json;
};

export const testOpenApiConnection = async (warehouseId: string) => {
  const today = new Date();
  const day = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  return callOpenApiAction(warehouseId, "report_revenue_summary", {
    startDate: day,
    endDate: day,
  });
};
