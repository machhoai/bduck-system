import { rateLimit } from "express-rate-limit";

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

const createRateLimiter = (windowMs: number, limit: number) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (_request, response) =>
      response.status(429).json(localizedRateLimitResponse),
  });

export const apiRateLimiter = createRateLimiter(
  parsePositiveInteger(process.env.BE_WMS_RATE_LIMIT_WINDOW_MS, 60_000),
  parsePositiveInteger(process.env.BE_WMS_RATE_LIMIT_MAX_REQUESTS, 300),
);

export const authRateLimiter = createRateLimiter(
  parsePositiveInteger(process.env.BE_WMS_AUTH_RATE_LIMIT_WINDOW_MS, 900_000),
  parsePositiveInteger(process.env.BE_WMS_AUTH_RATE_LIMIT_MAX_REQUESTS, 30),
);
