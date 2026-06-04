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
