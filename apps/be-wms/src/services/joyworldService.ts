/**
 * JoyWorld API Client — Server-side
 *
 * Wraps the external JoyWorld revenue APIs for use within BE-WMS.
 * Credentials come from environment variables JOYWORLD_USER / JOYWORLD_PASS.
 *
 * @see joyworld.ts (project root) for original API documentation
 */

const BASE_URL = "http://joyworld.jingjianx.vip";

// ─────────────────────────────────────────────
// Token Management (cached, auto-refreshed)
// ─────────────────────────────────────────────

let cachedToken: string | null = null;
let tokenExpiry = 0;
const TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutes

export async function getJoyworldToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;

  const userName = process.env.JOYWORLD_USER;
  const password = process.env.JOYWORLD_PASS;

  if (!userName || !password) {
    throw new Error(
      "[joyworldService] Missing JOYWORLD_USER or JOYWORLD_PASS environment variables.",
    );
  }

  const response = await fetch(`${BASE_URL}/basic/manager/login/account`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userName, password }),
  });

  if (!response.ok) {
    throw new Error(`[joyworldService] Login failed: HTTP ${response.status}`);
  }

  const data = (await response.json()) as Record<string, unknown>;
  const token = (data.token as string) || ((data.data as Record<string, unknown>)?.token as string);

  if (!token) {
    throw new Error("[joyworldService] No token in login response.");
  }

  cachedToken = token;
  tokenExpiry = Date.now() + TOKEN_TTL_MS;
  return token;
}

// ─────────────────────────────────────────────
// Revenue APIs
// ─────────────────────────────────────────────

export interface RevenueOverviewResponse {
  [key: string]: unknown;
}

export interface OrderListParams {
  startTime: string;
  endTime: string;
  statusContent?: string;
  payMethodContent?: string;
  couponIdContent?: string;
  page?: number;
  limit?: number;
}

export interface SetMealCatalogItem {
  setMealId: string;
  setMealName: string;
  typeName: string;
  category: number;
  afterTaxPrice: number;
  isEnabled: boolean;
  isOpenSales: boolean;
}

export interface GiftCatalogItem {
  goodsId: string;
  giftNo: string;
  giftName: string;
  typeName: string;
  price: number;
  afterTaxPrice: number;
  stockAmount: number;
  isEnabled: boolean;
  isOpenSales: boolean;
}

/**
 * Lấy dữ liệu doanh thu theo khoảng ngày
 * startDate / endDate: "YYYY-MM-DD"
 */
export async function getRevenueData(
  token: string,
  startDate: string,
  endDate: string,
): Promise<RevenueOverviewResponse> {
  const url = `${BASE_URL}/finance/manager/revenueoverview/revenue?startDate=${startDate}&endDate=${endDate}&_t=${Date.now()}`;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  if (!response.ok) {
    throw new Error(
      `[joyworldService] getRevenueData failed: HTTP ${response.status}`,
    );
  }
  return (await response.json()) as RevenueOverviewResponse;
}

export async function getSellData(
  token: string,
  startDate: string,
  endDate: string,
): Promise<RevenueOverviewResponse> {
  const url = `${BASE_URL}/finance/manager/revenueoverview/sell?startDate=${startDate}&endDate=${endDate}&_t=${Date.now()}`;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  if (!response.ok) {
    throw new Error(`[joyworldService] getSellData failed: HTTP ${response.status}`);
  }
  return (await response.json()) as RevenueOverviewResponse;
}

/**
 * Lấy tổng quan doanh thu trong ngày (shopRealMoney, refundMoney...)
 * forDate: "YYYY-MM-DD"
 */
export async function getShopSummary(
  token: string,
  forDate: string,
): Promise<RevenueOverviewResponse> {
  const url = `${BASE_URL}/finance/manager/revenuepanel/getshopsummary?forDate=${forDate}&_t=${Date.now()}`;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  if (!response.ok) {
    throw new Error(
      `[joyworldService] getShopSummary failed: HTTP ${response.status}`,
    );
  }
  return (await response.json()) as RevenueOverviewResponse;
}

export async function getPaymentStatistics(
  token: string,
  forDate: string,
): Promise<RevenueOverviewResponse> {
  const url = `${BASE_URL}/finance/manager/revenuepanel/statistics/payment?forDate=${forDate}&_t=${Date.now()}`;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  if (!response.ok) {
    throw new Error(
      `[joyworldService] getPaymentStatistics failed: HTTP ${response.status}`,
    );
  }
  return (await response.json()) as RevenueOverviewResponse;
}

export async function getGoodsTypeStatistics(
  token: string,
  forDate: string,
): Promise<RevenueOverviewResponse> {
  const url = `${BASE_URL}/finance/manager/revenuepanel/statistics/goods/type?forDate=${forDate}&_t=${Date.now()}`;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  if (!response.ok) {
    throw new Error(
      `[joyworldService] getGoodsTypeStatistics failed: HTTP ${response.status}`,
    );
  }
  return (await response.json()) as RevenueOverviewResponse;
}

export async function getStoreBalance(
  token: string,
  startDate: string,
  endDate: string,
): Promise<RevenueOverviewResponse> {
  const url = `${BASE_URL}/member/manager/RevenueOverview/getStoreBalance?startDate=${startDate}&endDate=${endDate}&page=1&limit=100&_t=${Date.now()}`;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  if (!response.ok) {
    throw new Error(`[joyworldService] getStoreBalance failed: HTTP ${response.status}`);
  }
  return (await response.json()) as RevenueOverviewResponse;
}

export async function getOrderList(
  token: string,
  params: OrderListParams,
): Promise<RevenueOverviewResponse> {
  const qs = new URLSearchParams({
    startTime: params.startTime,
    endTime: params.endTime,
    statusContent: params.statusContent ?? "",
    payMethodContent: params.payMethodContent ?? "",
    couponIdContent: params.couponIdContent ?? "",
    page: String(params.page ?? 1),
    limit: String(params.limit ?? 20),
    _t: String(Date.now()),
  });
  const response = await fetch(`${BASE_URL}/order/manager/buy/order/list?${qs}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  if (!response.ok) {
    throw new Error(`[joyworldService] getOrderList failed: HTTP ${response.status}`);
  }
  return (await response.json()) as RevenueOverviewResponse;
}

async function fetchPaginatedSetMeal(
  token: string,
  urlBase: string,
  limit = 100,
): Promise<SetMealCatalogItem[]> {
  const all: SetMealCatalogItem[] = [];
  let page = 1;
  while (true) {
    const response = await fetch(
      `${urlBase}&page=${page}&limit=${limit}&_t=${Date.now()}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      },
    );
    if (!response.ok) break;
    const json = (await response.json()) as Record<string, unknown>;
    const items = Array.isArray(json.data) ? json.data : [];
    all.push(
      ...items.map((item) => {
        const row = asRecord(item);
        return {
          setMealId: String(row.setMealId ?? ""),
          setMealName: String(row.setMealName ?? ""),
          typeName: String(row.typeName ?? ""),
          category: Number(row.category ?? 1),
          afterTaxPrice: Number(row.afterTaxPrice ?? row.price ?? 0),
          isEnabled: Boolean(row.isEnabled),
          isOpenSales: Boolean(row.isOpenSales),
        };
      }),
    );
    if (all.length >= Number(json.totals) || items.length < limit) break;
    page += 1;
  }
  return all;
}

export async function getSetMealCatalog(
  token: string,
): Promise<SetMealCatalogItem[]> {
  const [coins, tickets] = await Promise.all([
    fetchPaginatedSetMeal(token, `${BASE_URL}/setmeal/manager/coin/list?category=1`),
    fetchPaginatedSetMeal(
      token,
      `${BASE_URL}/setmeal/manager/passticket/list?category=4&subCategory=1`,
    ),
  ]);
  return [...coins, ...tickets];
}

export async function getGiftCatalog(token: string): Promise<GiftCatalogItem[]> {
  const limit = 200;
  const all: GiftCatalogItem[] = [];
  let page = 1;
  while (true) {
    const response = await fetch(
      `${BASE_URL}/gift/manager/base/list?page=${page}&limit=${limit}&_t=${Date.now()}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      },
    );
    if (!response.ok) break;
    const json = (await response.json()) as Record<string, unknown>;
    const items = Array.isArray(json.data) ? json.data : [];
    all.push(
      ...items.map((item) => {
        const row = asRecord(item);
        return {
          goodsId: String(row.goodsId ?? row.id ?? ""),
          giftNo: String(row.giftNo ?? ""),
          giftName: String(row.giftName ?? row.goodsName ?? ""),
          typeName: String(row.typeName ?? ""),
          price: Number(row.price ?? 0),
          afterTaxPrice: Number(row.afterTaxPrice ?? row.price ?? 0),
          stockAmount: Number(row.stockAmount ?? 0),
          isEnabled: Boolean(row.isEnabled),
          isOpenSales: Boolean(row.isOpenSales),
        };
      }),
    );
    if (all.length >= Number(json.totals) || items.length < limit) break;
    page += 1;
  }
  return all;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}
