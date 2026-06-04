// lib/joyworld.ts

const BASE_URL = 'http://joyworld.jingjianx.vip';

/**
 * Đăng nhập và lấy Token
 */
export async function getJoyworldToken() {
    const response = await fetch(`${BASE_URL}/basic/manager/login/account`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({
            userName: process.env.JOYWORLD_USER,
            password: process.env.JOYWORLD_PASS,
        }),
    });

    if (!response.ok) throw new Error('Đăng nhập thất bại');
    const data = await response.json();
    return data.token || data.data?.token;
}

/**
 * Lấy dữ liệu doanh thu theo khoảng ngày (Revenue overview)
 */
export async function getRevenueData(token: string, startDate: string, endDate: string) {
    const url = `${BASE_URL}/finance/manager/revenueoverview/revenue?startDate=${startDate}&endDate=${endDate}&_t=${Date.now()}`;
    const response = await fetch(url, {
        method: 'GET',
        cache: 'no-store',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
    });
    if (!response.ok) throw new Error('Lấy dữ liệu doanh thu thất bại');
    return response.json();
}

/**
 * Lấy dữ liệu sản phẩm bán theo khoảng ngày (Sell overview)
 */
export async function getSellData(token: string, startDate: string, endDate: string) {
    const url = `${BASE_URL}/finance/manager/revenueoverview/sell?startDate=${startDate}&endDate=${endDate}&_t=${Date.now()}`;
    const response = await fetch(url, {
        method: 'GET',
        cache: 'no-store',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
    });
    if (!response.ok) throw new Error('Lấy dữ liệu sản phẩm bán thất bại');
    return response.json();
}

// ─────────────────────────── DAILY PANEL APIs ───────────────────────────────

/**
 * Lấy tổng quan doanh thu trong ngày (shopRealMoney, refundMoney...)
 * GET /finance/manager/revenuepanel/getshopsummary?forDate=YYYY-MM-DD
 */
export async function getShopSummary(token: string, forDate: string) {
    const url = `${BASE_URL}/finance/manager/revenuepanel/getshopsummary?forDate=${forDate}&_t=${Date.now()}`;
    const response = await fetch(url, {
        method: 'GET',
        cache: 'no-store',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
    });
    if (!response.ok) throw new Error('Lấy shop summary thất bại');
    return response.json();
}

/**
 * Lấy thống kê theo phương thức thanh toán trong ngày
 * GET /finance/manager/revenuepanel/statistics/payment?forDate=YYYY-MM-DD
 */
export async function getPaymentStatistics(token: string, forDate: string) {
    const url = `${BASE_URL}/finance/manager/revenuepanel/statistics/payment?forDate=${forDate}&_t=${Date.now()}`;
    const response = await fetch(url, {
        method: 'GET',
        cache: 'no-store',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
    });
    if (!response.ok) throw new Error('Lấy thống kê thanh toán thất bại');
    return response.json();
}

/**
 * Lấy thống kê hàng hóa bán theo nhóm trong ngày
 * GET /finance/manager/revenuepanel/statistics/goods/type?forDate=YYYY-MM-DD
 */
export async function getGoodsTypeStatistics(token: string, forDate: string) {
    const url = `${BASE_URL}/finance/manager/revenuepanel/statistics/goods/type?forDate=${forDate}&_t=${Date.now()}`;
    const response = await fetch(url, {
        method: 'GET',
        cache: 'no-store',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
    });
    if (!response.ok) throw new Error('Lấy thống kê hàng hóa thất bại');
    return response.json();
}

// ─────────────────────────── MEMBER APIs ────────────────────────────────────

/**
 * Lấy thống kê số dư thành viên theo khoảng ngày
 * GET /member/manager/RevenueOverview/getStoreBalance?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&page=1&limit=100
 *
 * Response.footData chứa tổng hợp cả khoảng:
 *  - memberTotal      : Tổng số thành viên hiện có
 *  - newMemberAmount  : Thành viên mới trong kỳ
 *  - goShopMemberAmount: Lượt khách đến cửa hàng
 *  - currency         : Tổng số dư (xu hệ thống)
 *  - localCurrency    : Tổng VND nạp
 *  - giftCoins        : Xu tặng
 *  - lotteryTicket    : Điểm tích lũy
 */
export async function getStoreBalance(token: string, startDate: string, endDate: string) {
    const url = `${BASE_URL}/member/manager/RevenueOverview/getStoreBalance?startDate=${startDate}&endDate=${endDate}&page=1&limit=100&_t=${Date.now()}`;
    const response = await fetch(url, {
        method: 'GET',
        cache: 'no-store',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
    });
    if (!response.ok) throw new Error('Lấy dữ liệu thành viên thất bại');
    return response.json();
}

// ─────────────────────────── ORDER APIs ─────────────────────────────────────

export interface OrderListParams {
    startTime: string;  // 'YYYY-MM-DD HH:mm:ss'
    endTime: string;
    statusContent?: string;
    payMethodContent?: string;
    couponIdContent?: string;
    page?: number;
    limit?: number;
}

/**
 * Lấy danh sách đơn hàng có lọc và phân trang
 * GET /order/manager/buy/order/list
 */
export async function getOrderList(token: string, params: OrderListParams) {
    const qs = new URLSearchParams({
        startTime: params.startTime,
        endTime: params.endTime,
        statusContent: params.statusContent ?? '',
        payMethodContent: params.payMethodContent ?? '',
        couponIdContent: params.couponIdContent ?? '',
        page: String(params.page ?? 1),
        limit: String(params.limit ?? 20),
        _t: String(Date.now()),
    });
    const url = `${BASE_URL}/order/manager/buy/order/list?${qs}`;
    const res = await fetch(url, {
        method: 'GET',
        cache: 'no-store',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error('Lấy danh sách đơn hàng thất bại');
    return res.json();
}

/**
 * Lấy chi tiết một đơn hàng
 * GET /order/manager/buy/getorderdetails?orderId=xxx
 */
export async function getOrderDetail(token: string, orderId: string) {
    const url = `${BASE_URL}/order/manager/buy/getorderdetails?orderId=${orderId}&_t=${Date.now()}`;
    const res = await fetch(url, {
        method: 'GET',
        cache: 'no-store',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error('Lấy chi tiết đơn hàng thất bại');
    return res.json();
}

// ─────────────────────────── PRODUCT CATALOG APIs ───────────────────────────

export interface SetMealCatalogItem {
    setMealId: string;
    setMealName: string;
    typeName: string;
    /** 1 = gói thẻ/coin, 4 = vé */
    category: number;
    afterTaxPrice: number;
    isEnabled: boolean;
    isOpenSales: boolean;
}

/**
 * Fetch tất cả trang của một endpoint setmeal (auto-paginate)
 */
async function fetchPaginatedSetMeal(
    token: string,
    urlBase: string,
    limit = 100,
): Promise<SetMealCatalogItem[]> {
    const all: SetMealCatalogItem[] = [];
    let page = 1;
    while (true) {
        const url = `${urlBase}&page=${page}&limit=${limit}&_t=${Date.now()}`;
        const res = await fetch(url, {
            method: 'GET',
            cache: 'no-store',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        });
        if (!res.ok) break;
        const json = await res.json();
        const items: Record<string, unknown>[] = Array.isArray(json.data) ? json.data : [];
        all.push(...items.map(i => ({
            setMealId: String(i.setMealId ?? ''),
            setMealName: String(i.setMealName ?? ''),
            typeName: String(i.typeName ?? ''),
            category: Number(i.category ?? 1),
            afterTaxPrice: Number(i.afterTaxPrice ?? i.price ?? 0),
            isEnabled: Boolean(i.isEnabled),
            isOpenSales: Boolean(i.isOpenSales),
        })));
        if (all.length >= Number(json.totals) || items.length < limit) break;
        page++;
    }
    return all;
}

/**
 * Lấy toàn bộ danh sách sản phẩm (gói thẻ + vé) từ JoyWorld
 * - Coin packages : /setmeal/manager/coin/list?category=1
 * - Pass tickets  : /setmeal/manager/passticket/list?category=4&subCategory=1
 */
export async function getSetMealCatalog(token: string): Promise<SetMealCatalogItem[]> {
    const BASE = 'http://joyworld.jingjianx.vip';
    const [coins, tickets] = await Promise.all([
        fetchPaginatedSetMeal(token, `${BASE}/setmeal/manager/coin/list?category=1`),
        fetchPaginatedSetMeal(token, `${BASE}/setmeal/manager/passticket/list?category=4&subCategory=1`),
    ]);
    return [...coins, ...tickets];
}

// ─────────────────────────── GIFT / SOUVENIR CATALOG ────────────────────────

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
 * Lấy toàn bộ danh sách hàng hóa lưu niệm từ JoyWorld
 * GET /gift/manager/base/list?page=1&limit=1000
 * Auto-paginate nếu totals > limit
 */
export async function getGiftCatalog(token: string): Promise<GiftCatalogItem[]> {
    const BASE = 'http://joyworld.jingjianx.vip';
    const limit = 200;
    const all: GiftCatalogItem[] = [];
    let page = 1;
    while (true) {
        const url = `${BASE}/gift/manager/base/list?page=${page}&limit=${limit}&_t=${Date.now()}`;
        const res = await fetch(url, {
            method: 'GET',
            cache: 'no-store',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        });
        if (!res.ok) break;
        const json = await res.json();
        const items: Record<string, unknown>[] = Array.isArray(json.data) ? json.data : [];
        all.push(...items.map(i => ({
            goodsId:     String(i.goodsId ?? i.id ?? ''),
            giftNo:      String(i.giftNo ?? ''),
            giftName:    String(i.giftName ?? i.goodsName ?? ''),
            typeName:    String(i.typeName ?? ''),
            price:       Number(i.price ?? 0),
            afterTaxPrice: Number(i.afterTaxPrice ?? i.price ?? 0),
            stockAmount: Number(i.stockAmount ?? 0),
            isEnabled:   Boolean(i.isEnabled),
            isOpenSales: Boolean(i.isOpenSales),
        })));
        if (all.length >= Number(json.totals) || items.length < limit) break;
        page++;
    }
    return all;
}
