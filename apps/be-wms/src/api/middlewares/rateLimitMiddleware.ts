import type { Request } from "express";
import { ipKeyGenerator, rateLimit } from "express-rate-limit";

const parsePositiveInteger = (
  value: string | undefined,
  fallback: number,
): number => {
  if (!value || !/^\d+$/.test(value)) return fallback;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
};

export const resolveTrustProxySetting = (
  value = process.env.BE_WMS_TRUST_PROXY_HOPS,
  nodeEnv = process.env.NODE_ENV,
): false | number => {
  if (value === undefined || value === "") {
    return nodeEnv === "production" ? 1 : false;
  }
  if (value === "0" || value === "false") return false;
  if (!/^\d+$/.test(value)) return false;
  const hops = Number(value);
  return hops > 0 && hops <= 10 ? hops : false;
};

const localizedRateLimitResponse = {
  success: false,
  data: null,
  messages: {
    vi: "Quá nhiều yêu cầu. Vui lòng thử lại sau ít phút.",
    zh: "请求过于频繁，请稍后再试。",
  },
};

const createRateLimiter = (
  windowMs: number,
  limit: number,
  keyGenerator?: (request: Request) => string,
  skip?: (request: Request) => boolean,
) =>
  rateLimit({
    windowMs,
    limit,
    keyGenerator,
    skip,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (_request, response) =>
      response.status(429).json(localizedRateLimitResponse),
  });

const POS_DEVICE_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const resolvePosDeviceSessionRateLimitKey = (
  request: Pick<Request, "body" | "ip">,
): string => {
  const deviceId =
    typeof request.body?.device_id === "string"
      ? request.body.device_id.trim().toLowerCase()
      : "";
  const ipKey = ipKeyGenerator(request.ip ?? "unknown");
  return POS_DEVICE_ID_PATTERN.test(deviceId)
    ? `pos-device-session:${deviceId}:${ipKey}`
    : `pos-device-session:${ipKey}`;
};

export const resolvePosDeviceWatchRateLimitKey = (
  request: Pick<Request, "body" | "ip">,
): string => {
  const deviceId =
    typeof request.body?.device_id === "string"
      ? request.body.device_id.trim().toLowerCase()
      : "";
  const ipKey = ipKeyGenerator(request.ip ?? "unknown");
  return POS_DEVICE_ID_PATTERN.test(deviceId)
    ? `pos-device-watch:${deviceId}:${ipKey}`
    : `pos-device-watch:${ipKey}`;
};

const POS_DEVICE_WATCH_PATH_PATTERN =
  /^\/api\/pos\/devices\/(receipt-settings|ticket-settings|customer-display-settings)\/watch$/;

export const isPosDeviceWatchRequest = (
  request: Pick<Request, "method" | "originalUrl">,
): boolean =>
  request.method === "POST" &&
  POS_DEVICE_WATCH_PATH_PATTERN.test(request.originalUrl.split("?", 1)[0] ?? "");

export const apiRateLimiter = createRateLimiter(
  parsePositiveInteger(process.env.BE_WMS_RATE_LIMIT_WINDOW_MS, 60_000),
  parsePositiveInteger(process.env.BE_WMS_RATE_LIMIT_MAX_REQUESTS, 300),
  undefined,
  isPosDeviceWatchRequest,
);

export const authRateLimiter = createRateLimiter(
  parsePositiveInteger(process.env.BE_WMS_AUTH_RATE_LIMIT_WINDOW_MS, 900_000),
  parsePositiveInteger(process.env.BE_WMS_AUTH_RATE_LIMIT_MAX_REQUESTS, 30),
);

export const authSessionRateLimiter = createRateLimiter(
  parsePositiveInteger(
    process.env.BE_WMS_AUTH_SESSION_RATE_LIMIT_WINDOW_MS,
    900_000,
  ),
  parsePositiveInteger(
    process.env.BE_WMS_AUTH_SESSION_RATE_LIMIT_MAX_REQUESTS,
    120,
  ),
);

export const posDeviceSessionRateLimiter = createRateLimiter(
  parsePositiveInteger(
    process.env.BE_WMS_POS_DEVICE_SESSION_RATE_LIMIT_WINDOW_MS,
    900_000,
  ),
  parsePositiveInteger(
    process.env.BE_WMS_POS_DEVICE_SESSION_RATE_LIMIT_MAX_REQUESTS,
    60,
  ),
  resolvePosDeviceSessionRateLimitKey,
);

export const posDeviceWatchRateLimiter = createRateLimiter(
  parsePositiveInteger(
    process.env.BE_WMS_POS_DEVICE_WATCH_RATE_LIMIT_WINDOW_MS,
    60_000,
  ),
  parsePositiveInteger(
    process.env.BE_WMS_POS_DEVICE_WATCH_RATE_LIMIT_MAX_REQUESTS,
    30,
  ),
  resolvePosDeviceWatchRateLimitKey,
);

export const publicInvoiceReadRateLimiter = createRateLimiter(
  parsePositiveInteger(
    process.env.BE_WMS_PUBLIC_INVOICE_READ_WINDOW_MS,
    60_000,
  ),
  parsePositiveInteger(
    process.env.BE_WMS_PUBLIC_INVOICE_READ_MAX_REQUESTS,
    60,
  ),
);

export const publicInvoiceSubmitRateLimiter = createRateLimiter(
  parsePositiveInteger(
    process.env.BE_WMS_PUBLIC_INVOICE_SUBMIT_WINDOW_MS,
    15 * 60_000,
  ),
  parsePositiveInteger(
    process.env.BE_WMS_PUBLIC_INVOICE_SUBMIT_MAX_REQUESTS,
    10,
  ),
);

export const marketingVoucherMutationRateLimiter = createRateLimiter(
  parsePositiveInteger(
    process.env.BE_WMS_MARKETING_VOUCHER_MUTATION_WINDOW_MS,
    60_000,
  ),
  parsePositiveInteger(
    process.env.BE_WMS_MARKETING_VOUCHER_MUTATION_MAX_REQUESTS,
    30,
  ),
);

export const resolvePosSettingsMutationRateLimitKey = (
  request: Pick<Request, "headers" | "ip" | "params"> & {
    user?: { id?: string };
  },
): string => {
  const deviceId =
    typeof request.headers["x-pos-device-id"] === "string"
      ? request.headers["x-pos-device-id"].trim().toLowerCase()
      : "";
  const actorId = request.user?.id?.trim().toLowerCase() || "anonymous";
  const warehouseParam = request.params?.warehouseId;
  const warehouseId = typeof warehouseParam === "string"
    ? warehouseParam.trim().toLowerCase()
    : "device";
  const principal = POS_DEVICE_ID_PATTERN.test(deviceId) ? deviceId : actorId;
  return `pos-settings-mutation:${principal}:${warehouseId}:${ipKeyGenerator(request.ip ?? "unknown")}`;
};

export const posSettingsMutationRateLimiter = createRateLimiter(
  parsePositiveInteger(
    process.env.BE_WMS_POS_SETTINGS_MUTATION_WINDOW_MS,
    60_000,
  ),
  parsePositiveInteger(
    process.env.BE_WMS_POS_SETTINGS_MUTATION_MAX_REQUESTS,
    30,
  ),
  resolvePosSettingsMutationRateLimitKey,
);
