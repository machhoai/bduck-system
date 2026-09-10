import assert from "node:assert/strict";
import test from "node:test";

import {
  assertJoyworldRefundMatchesLocal,
  createJoyworldBizCode,
  joyworldRefundClient,
} from "./joyworldRefundClient.js";

test("creates a secure-compatible 32-character JoyWorld business code", () => {
  const values = new Set(Array.from({ length: 20 }, createJoyworldBizCode));
  assert.equal(values.size, 20);
  values.forEach((value) => assert.match(value, /^[A-Za-z0-9]{32}$/));
});

test("enables remote refund for every warehouse without a canary list", async () => {
  const previous = {
    enabled: process.env.JOYWORLD_REFUND_ENABLED,
    baseUrl: process.env.JOYWORLD_MANAGER_BASE_URL,
    insecureHttp: process.env.JOYWORLD_REFUND_ALLOW_INSECURE_HTTP,
    legacyCanary: process.env.JOYWORLD_REFUND_CANARY_WAREHOUSE_IDS,
  };
  process.env.JOYWORLD_REFUND_ENABLED = "true";
  process.env.JOYWORLD_MANAGER_BASE_URL = "http://joyworld.example.test";
  process.env.JOYWORLD_REFUND_ALLOW_INSECURE_HTTP = "true";
  process.env.JOYWORLD_REFUND_CANARY_WAREHOUSE_IDS = "different-warehouse";

  try {
    const remoteOrderId = await joyworldRefundClient.resolveRemoteOrderId({
      warehouseId: "any-warehouse",
      remoteOrderId: "remote-order-id",
      hkOrderNumber: "O-1",
      paidAt: "2026-09-09T00:00:00.000Z",
      totalAmount: 180000,
    });
    assert.equal(remoteOrderId, "remote-order-id");
  } finally {
    for (const [key, value] of [
      ["JOYWORLD_REFUND_ENABLED", previous.enabled],
      ["JOYWORLD_MANAGER_BASE_URL", previous.baseUrl],
      ["JOYWORLD_REFUND_ALLOW_INSECURE_HTTP", previous.insecureHttp],
      ["JOYWORLD_REFUND_CANARY_WAREHOUSE_IDS", previous.legacyCanary],
    ] as const) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("accepts an exact full-refund reconciliation", () => {
  assert.doesNotThrow(() =>
    assertJoyworldRefundMatchesLocal({
      localOrderNumber: "O-1",
      totalAmount: 180000,
      paymentMethod: "CASH",
      items: [
        { goodsId: "g1", goodsName: "Vé lượt", quantity: 1, price: 180000 },
      ],
      remote: {
        orderId: "00000000-0000-4000-8000-000000000001",
        orderNumber: "O-1",
        buyTime: "2026-09-08 10:00:00",
        totalNumber: 1,
        totalMoney: 180000,
        payMethodNames: "Tiền mặt",
        refundMode: "Toàn bộ",
        items: [
          {
            goodsId: "g1",
            goodsName: "Vé lượt",
            category: 1,
            goodsCategoryName: "Hàng hóa ảo",
            price: 180000,
            qty: 1,
            surplusQty: 1,
            returnQty: 1,
            businessType: 0,
          },
        ],
        payModeInfo: [
          {
            payOrderNumber: "P-1",
            payMethodId: "00000000-0000-4000-8000-000000000002",
            payMethodCode: "CashPaymentExecutor",
            payMethodName: "Tiền mặt",
            money: 180000,
            payStatus: 2,
            payStatusName: "Thành công",
            payTime: "2026-09-08 10:00:00",
            outTradeNO: "",
            thirdPartyTerminalId: null,
            paymentMode: 1,
          },
        ],
        invoiceNumber: "",
        invoiceSystemType: 0,
        isInterFactuSpainInvoice: false,
      },
    }),
  );
});
