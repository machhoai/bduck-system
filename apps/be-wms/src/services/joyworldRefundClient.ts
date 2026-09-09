import { randomInt } from "node:crypto";

import type { PosOrderListItem } from "@bduck/shared-types";

import {
  joyworldRefundCheckResponseSchema,
  joyworldRefundDetailsResponseSchema,
  joyworldRefundSubmitRequestSchema,
  joyworldRefundSubmitResponseSchema,
  type JoyworldRefundDetailsResponse,
} from "./joyworldRefundSchemas.js";
import {
  getJoyworldManagerBaseUrl,
  getJoyworldToken,
  getOrderList,
} from "./joyworldService.js";

const BIZ_CODE_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const REQUEST_TIMEOUT_MS = 20_000;

export class JoyworldRefundError extends Error {
  constructor(
    readonly code: string,
    readonly uncertain = false,
  ) {
    super(code);
  }
}

export const createJoyworldBizCode = (): string =>
  Array.from(
    { length: 32 },
    () => BIZ_CODE_ALPHABET[randomInt(BIZ_CODE_ALPHABET.length)],
  ).join("");

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {};
const text = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;
const amountMatches = (left: number, right: number): boolean =>
  Math.abs(left - right) < 0.01;

export const assertJoyworldRefundMatchesLocal = (input: {
  localOrderNumber: string;
  totalAmount: number;
  paymentMethod: string;
  items: PosOrderListItem[];
  remote: JoyworldRefundDetailsResponse["data"];
}): void => {
  if (input.remote.orderNumber !== input.localOrderNumber) {
    throw new JoyworldRefundError("REMOTE_ORDER_NUMBER_MISMATCH");
  }
  if (!amountMatches(input.remote.totalMoney, input.totalAmount)) {
    throw new JoyworldRefundError("REMOTE_ORDER_AMOUNT_MISMATCH");
  }
  const localQuantities = new Map<string, number>();
  input.items.forEach((item) =>
    localQuantities.set(
      item.goodsId,
      (localQuantities.get(item.goodsId) ?? 0) + item.quantity,
    ),
  );
  for (const [goodsId, quantity] of localQuantities) {
    const remote = input.remote.items.find((item) => item.goodsId === goodsId);
    if (
      !remote ||
      remote.surplusQty < quantity ||
      remote.returnQty < quantity
    ) {
      throw new JoyworldRefundError("REMOTE_ORDER_ITEMS_MISMATCH");
    }
  }
  const codes = input.remote.payModeInfo.map((item) => item.payMethodCode);
  if (
    (input.paymentMethod === "CASH" &&
      !codes.some((code) => code === "CashPaymentExecutor")) ||
    (input.paymentMethod === "QR_CODE" &&
      codes.some((code) => code === "CashPaymentExecutor"))
  ) {
    throw new JoyworldRefundError("REMOTE_PAYMENT_METHOD_MISMATCH");
  }
};

const assertRefundFeature = (warehouseId: string): void => {
  if (process.env.JOYWORLD_REFUND_ENABLED !== "true") {
    throw new JoyworldRefundError("REMOTE_REFUND_DISABLED");
  }
  const allowedWarehouses = (
    process.env.JOYWORLD_REFUND_CANARY_WAREHOUSE_IDS ?? ""
  )
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  if (
    allowedWarehouses.length > 0 &&
    !allowedWarehouses.includes(warehouseId)
  ) {
    throw new JoyworldRefundError("REMOTE_REFUND_NOT_ENABLED_FOR_STORE");
  }
  const baseUrl = new URL(getJoyworldManagerBaseUrl());
  if (
    baseUrl.protocol !== "https:" &&
    process.env.JOYWORLD_REFUND_ALLOW_INSECURE_HTTP !== "true"
  ) {
    throw new JoyworldRefundError("REMOTE_REFUND_SECURE_TRANSPORT_REQUIRED");
  }
};

const managerRequest = async (
  path: string,
  init: RequestInit = {},
  uncertainOnFailure = false,
): Promise<unknown> => {
  const token = await getJoyworldToken();
  let response: Response;
  try {
    response = await fetch(`${getJoyworldManagerBaseUrl()}${path}`, {
      ...init,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: {
        Accept: "application/json, text/plain, */*",
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "JJ-LANGUAGE": "vi",
        ...init.headers,
      },
    });
  } catch {
    throw new JoyworldRefundError(
      uncertainOnFailure
        ? "JOYWORLD_NETWORK_UNCERTAIN"
        : "JOYWORLD_NETWORK_ERROR",
      uncertainOnFailure,
    );
  }
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new JoyworldRefundError(
      response.ok ? "JOYWORLD_RESPONSE_INVALID" : "JOYWORLD_HTTP_UNCERTAIN",
      uncertainOnFailure,
    );
  }
  if (!response.ok) {
    throw new JoyworldRefundError(
      `JOYWORLD_HTTP_${response.status}`,
      uncertainOnFailure,
    );
  }
  return payload;
};

const listRows = (response: unknown): Record<string, unknown>[] => {
  const root = asRecord(response);
  const data = root.data;
  if (Array.isArray(data)) return data.map(asRecord);
  const nested = asRecord(data);
  for (const key of ["list", "listData", "rows", "items"]) {
    if (Array.isArray(nested[key]))
      return (nested[key] as unknown[]).map(asRecord);
  }
  return [];
};

const dateWindow = (iso: string): { startTime: string; endTime: string } => {
  const current = new Date(iso);
  if (Number.isNaN(current.getTime()))
    throw new JoyworldRefundError("ORDER_DATE_INVALID");
  const start = new Date(current.getTime() - 24 * 60 * 60 * 1_000);
  const end = new Date(current.getTime() + 24 * 60 * 60 * 1_000);
  const format = (value: Date) => value.toISOString().slice(0, 10);
  return {
    startTime: `${format(start)} 00:00:00`,
    endTime: `${format(end)} 23:59:59`,
  };
};

export class JoyworldRefundClient {
  async resolveRemoteOrderId(input: {
    warehouseId: string;
    remoteOrderId: string | null;
    hkOrderNumber: string;
    paidAt: string;
    totalAmount: number;
  }): Promise<string> {
    assertRefundFeature(input.warehouseId);
    if (input.remoteOrderId) return input.remoteOrderId;
    const token = await getJoyworldToken();
    const window = dateWindow(input.paidAt);
    const response = await getOrderList(token, {
      ...window,
      page: 1,
      limit: 100,
    });
    const exact = listRows(response).filter(
      (row) =>
        text(row.orderNumber) === input.hkOrderNumber &&
        amountMatches(
          Number(row.realMoney ?? row.totalMoney ?? row.sysMoney ?? 0),
          input.totalAmount,
        ),
    );
    if (exact.length !== 1) {
      throw new JoyworldRefundError(
        exact.length === 0
          ? "REMOTE_ORDER_NOT_FOUND"
          : "REMOTE_ORDER_AMBIGUOUS",
      );
    }
    const id = text(exact[0]?.orderId) ?? text(exact[0]?.id);
    if (!id) throw new JoyworldRefundError("REMOTE_ORDER_ID_MISSING");
    return id;
  }

  async getDetails(
    warehouseId: string,
    remoteOrderId: string,
  ): Promise<JoyworldRefundDetailsResponse["data"]> {
    assertRefundFeature(warehouseId);
    const payload = await managerRequest(
      `/order/manager/orderrefund/getdetails?orderId=${encodeURIComponent(remoteOrderId)}`,
    );
    const parsed = joyworldRefundDetailsResponseSchema.parse(payload);
    if (!parsed.success)
      throw new JoyworldRefundError("REMOTE_REFUND_DETAILS_REJECTED");
    return parsed.data;
  }

  async check(warehouseId: string, remoteOrderId: string): Promise<void> {
    assertRefundFeature(warehouseId);
    const payload = await managerRequest("/order/manager/orderrefund/check", {
      method: "POST",
      body: JSON.stringify({ orderId: remoteOrderId }),
    });
    const parsed = joyworldRefundCheckResponseSchema.parse(payload);
    if (!parsed.success)
      throw new JoyworldRefundError("REMOTE_REFUND_NOT_ALLOWED");
  }

  async submit(input: {
    warehouseId: string;
    bizCode: string;
    remoteOrderId: string;
    reason: string;
    details: JoyworldRefundDetailsResponse["data"];
  }): Promise<string> {
    assertRefundFeature(input.warehouseId);
    const request = joyworldRefundSubmitRequestSchema.parse({
      orderId: input.remoteOrderId,
      totalMoney: input.details.totalMoney,
      originalTotalMoney: input.details.totalMoney,
      remark: input.reason,
      isForcedRefund: true,
      items: input.details.items
        .filter((item) => item.returnQty > 0)
        .map((item) => ({
          goodsId: item.goodsId,
          cancelQty: item.returnQty,
          businessType: item.businessType,
        })),
    });
    const payload = await managerRequest(
      "/order/manager/orderrefund/submit",
      {
        method: "POST",
        headers: { "JJ-BizCode": input.bizCode },
        body: JSON.stringify(request),
      },
      true,
    );
    const parsed = joyworldRefundSubmitResponseSchema.safeParse(payload);
    if (!parsed.success) {
      throw new JoyworldRefundError("JOYWORLD_RESPONSE_INVALID", true);
    }
    if (!parsed.data.success) {
      throw new JoyworldRefundError("REMOTE_REFUND_REJECTED");
    }
    return parsed.data.data.orderNumber;
  }
}

export const joyworldRefundClient = new JoyworldRefundClient();
