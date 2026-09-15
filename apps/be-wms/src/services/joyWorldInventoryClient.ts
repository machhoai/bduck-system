import type {
  PartnerGiftTypeOption,
  PartnerInventoryCapability,
  PartnerWarehouseOption,
} from "@bduck/shared-types";

import {
  joyWorldEnvelopeSchema,
  joyWorldGiftDetailsSchema,
  joyWorldKeyValueSchema,
  joyWorldStockRowSchema,
  type JoyWorldStockRow,
} from "./partnerInventorySchemas.js";

interface ManagerConfig {
  baseUrl: string;
  userName: string;
  password: string;
  connectionId: string;
  connectionName: string;
  shopId: string | null;
  writeEnabled: boolean;
  timeoutMs: number;
}

interface TokenCache {
  cacheKey: string;
  token: string;
}

let tokenCache: TokenCache | null = null;

const parseBoolean = (value: string | undefined): boolean => value === "true";

const loadConfig = (): ManagerConfig => {
  const baseUrl = (process.env.JOYWORLD_MANAGER_BASE_URL || "").replace(/\/$/, "");
  const userName = process.env.JOYWORLD_USER || "";
  const password = process.env.JOYWORLD_PASS || "";
  if (!baseUrl || !userName || !password) {
    throw new Error("JOYWORLD_MANAGER_NOT_CONFIGURED");
  }

  const parsedUrl = new URL(baseUrl);
  if (
    parsedUrl.protocol !== "https:" &&
    !parseBoolean(process.env.JOYWORLD_MANAGER_ALLOW_INSECURE_HTTP)
  ) {
    throw new Error("JOYWORLD_MANAGER_INSECURE_HTTP_BLOCKED");
  }

  return {
    baseUrl,
    userName,
    password,
    connectionId:
      process.env.JOYWORLD_MANAGER_CONNECTION_ID || "joyworld-manager",
    connectionName:
      process.env.JOYWORLD_MANAGER_CONNECTION_NAME || "JoyWorld Manager",
    shopId: process.env.JOYWORLD_MANAGER_SHOP_ID || null,
    writeEnabled: parseBoolean(
      process.env.JOYWORLD_INVENTORY_SYNC_WRITE_ENABLED,
    ),
    timeoutMs: Math.max(
      3_000,
      Number(process.env.JOYWORLD_MANAGER_REQUEST_TIMEOUT_MS || 15_000),
    ),
  };
};

const requestJson = async (
  config: ManagerConfig,
  path: string,
  init: RequestInit,
) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);
  try {
    const response = await fetch(`${config.baseUrl}${path}`, {
      ...init,
      signal: controller.signal,
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new Error(`JOYWORLD_HTTP_${response.status}`);
    return joyWorldEnvelopeSchema.parse(body);
  } finally {
    clearTimeout(timer);
  }
};

const login = async (config: ManagerConfig): Promise<string> => {
  const cacheKey = `${config.baseUrl}\n${config.userName}`;
  if (tokenCache?.cacheKey === cacheKey) return tokenCache.token;

  const response = await requestJson(config, "/basic/manager/login/account", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userName: config.userName,
      password: config.password,
    }),
  });
  if (!response.success) throw new Error(response.msg || response.desc);
  const data = response.data as { token?: unknown } | undefined;
  if (typeof data?.token !== "string" || !data.token) {
    throw new Error("JOYWORLD_LOGIN_NO_TOKEN");
  }
  tokenCache = { cacheKey, token: data.token };
  return data.token;
};

const managerRequest = async <T>(
  path: string,
  init: RequestInit = {},
): Promise<T> => {
  const response = await authenticatedEnvelope(path, init);
  return response.data as T;
};

const authenticatedEnvelope = async (
  path: string,
  init: RequestInit = {},
) => {
  const config = loadConfig();
  const execute = async (forceLogin: boolean) => {
    if (forceLogin) tokenCache = null;
    const token = await login(config);
    const response = await requestJson(config, path, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...init.headers,
      },
    });
    if (!response.success) throw new Error(response.msg || response.desc);
    return response;
  };

  try {
    return await execute(false);
  } catch (error) {
    if (error instanceof Error && error.message === "JOYWORLD_HTTP_401") {
      return execute(true);
    }
    throw error;
  }
};

export const getPartnerInventoryCapability = (): PartnerInventoryCapability => {
  const config = loadConfig();
  return {
    connection_id: config.connectionId,
    connection_name: config.connectionName,
    shop_id: config.shopId,
    read_enabled: true,
    write_enabled: config.writeEnabled,
  };
};

export const fetchJoyWorldWarehouses = async (): Promise<
  PartnerWarehouseOption[]
> => {
  const data = await managerRequest<unknown>("/gift/manager/stockbase/getlist");
  return joyWorldKeyValueSchema.array().parse(data).map((item) => ({
    stock_id: item.key,
    stock_name: item.value,
  }));
};

export const fetchJoyWorldGiftTypes = async (): Promise<
  PartnerGiftTypeOption[]
> => {
  const data = await managerRequest<unknown>("/gift/manager/type/getlist");
  return joyWorldKeyValueSchema.array().parse(data).map((item) => ({
    type_id: item.key,
    type_name: item.value,
  }));
};

export const fetchJoyWorldStock = async (
  stockId: string,
): Promise<JoyWorldStockRow[]> => {
  const limit = 500;
  let page = 1;
  let totals = Number.POSITIVE_INFINITY;
  const rows: JoyWorldStockRow[] = [];

  while (rows.length < totals) {
    const query = new URLSearchParams({
      stockId,
      isFilterZero: "false",
      page: String(page),
      limit: String(limit),
    });
    const envelope = await authenticatedEnvelope(
      `/gift/manager/stockvalue/list?${query.toString()}`,
    );
    const pageRows = joyWorldStockRowSchema.array().parse(envelope.data);
    rows.push(...pageRows.filter((item) => item.stockId === stockId));
    totals = envelope.totals ?? pageRows.length;
    if (pageRows.length === 0 || pageRows.length < limit) break;
    page += 1;
  }
  return rows;
};

export const fetchJoyWorldGiftDetails = async (giftId: string) => {
  const query = new URLSearchParams({ id: giftId });
  const data = await managerRequest<unknown>(
    `/gift/manager/base/details?${query.toString()}`,
  );
  return joyWorldGiftDetailsSchema.parse(data);
};

interface StockMutationItem {
  stockId: string;
  giftId: string;
  giftNo: string;
  giftName: string;
  amount: number;
  giftPrice: number;
  money: string;
  remark: string;
  stockValue?: number;
  isOpenExpire?: boolean;
  giftDate?: string | null;
}

const mutateStock = async (
  direction: "add" | "out",
  input: {
    stockId: string;
    stockName: string;
    remark: string;
    orderItems: StockMutationItem[];
  },
) => {
  const config = loadConfig();
  if (!config.writeEnabled) throw new Error("JOYWORLD_INVENTORY_WRITE_DISABLED");
  await managerRequest<unknown>(
    `/gift/manager/stockvalue/batch/gift/${direction}`,
    { method: "POST", body: JSON.stringify(input) },
  );
};

export const increaseJoyWorldStock = (input: Parameters<typeof mutateStock>[1]) =>
  mutateStock("add", input);

export const decreaseJoyWorldStock = (input: Parameters<typeof mutateStock>[1]) =>
  mutateStock("out", input);
