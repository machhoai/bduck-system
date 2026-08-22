import assert from "node:assert/strict";
import test from "node:test";

import {
  buildHistoricalPosOrder,
  mapJoyworldPaymentMethod,
  parseJoyworldLocalDateToIso,
} from "./posOrderHistoricalBackfill.js";

test("JoyWorld local timestamps are converted from Vietnam time", () => {
  assert.equal(
    parseJoyworldLocalDateToIso("2025-12-10 08:30:00"),
    "2025-12-10T01:30:00.000Z",
  );
});

test("historical payment methods map to JPOS values", () => {
  assert.deepEqual(mapJoyworldPaymentMethod("Thanh toán bằng tiền mặt"), {
    id: "CASH",
    name: "Tiền mặt",
  });
  assert.deepEqual(mapJoyworldPaymentMethod("Chuyển khoản"), {
    id: "QR_CODE",
    name: "Chuyển khoản",
  });
});

test("completed JoyWorld orders become paid JPOS orders", () => {
  const result = buildHistoricalPosOrder({
    order: {
      orderId: "source-1",
      orderNumber: "BD-1",
      status: 3,
      createTime: "2025-12-10 08:30:00",
      updateTime: "2025-12-10 08:31:00",
      realMoney: 110_000,
      discountMoney: 5_000,
      payModeNames: "Chuyển khoản",
      employeeName: "Thu ngân",
    },
    goods: [
      {
        id: "line-1",
        goodsId: "goods-1",
        goodsName: "Vé chơi",
        qty: 1,
        price: 100_000,
        realMoney: 110_000,
        taxMoney: 10_000,
        taxRate: 10,
      },
    ],
    warehouseId: "warehouse-1",
    shopId: 20692,
    importedAt: "2026-08-13T00:00:00.000Z",
    rangeStart: "2025-12-10",
    rangeEnd: "2026-08-13",
  });

  assert.equal(result?.id, "JW-source-1");
  assert.equal(result?.value.status, "SYNC_SUCCESS");
  assert.equal(result?.value.totalAmount, 110_000);
  assert.equal(result?.value.paymentMethodName, "Chuyển khoản");
  assert.equal(result?.value.paidAt, "2025-12-10T01:30:00.000Z");
});

test("non-completed source orders are excluded from paid JPOS history", () => {
  assert.equal(
    buildHistoricalPosOrder({
      order: {
        orderId: "cancelled",
        status: 4,
        createTime: "2025-12-10 08:30:00",
      },
      goods: [],
      warehouseId: "warehouse-1",
      shopId: 20692,
      importedAt: "2026-08-13T00:00:00.000Z",
      rangeStart: "2025-12-10",
      rangeEnd: "2026-08-13",
    }),
    null,
  );
});
