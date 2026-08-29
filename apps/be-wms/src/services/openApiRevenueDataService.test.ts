import assert from "node:assert/strict";
import test from "node:test";

import { allocateOpenApiPaymentChannels } from "./openApiPaymentAllocation.js";

test("OpenAPI payment allocation reconciles details to received revenue", () => {
  const channels = allocateOpenApiPaymentChannels(
    {
      realMoney: 13_563.61,
      cashRealMoney: 687,
      onlineMoney: 0.01,
      customMoney: 10_501,
      writeoffMoney: 2_442.6,
      onlines: [{ channelNo: "wechat", channelName: "WeChat", money: 0.01 }],
      customs: [{ customNo: "debit", customName: "Debit card", money: 10_501 }],
      writeoffs: [{ channelNo: "meituan", channelName: "Meituan", money: 2_442.6 }],
    },
    {},
    13_563.61,
  );

  assert.equal(channels.reduce((sum, item) => sum + item.amount, 0), 13_563.61);
  assert.equal(
    channels.filter((item) => item.category === "cash").reduce((sum, item) => sum + item.amount, 0),
    687,
  );
  assert.equal(
    channels.filter((item) => item.category === "transfer").reduce((sum, item) => sum + item.amount, 0),
    10_501,
  );
  const otherAmount = channels
    .filter((item) => item.category === "other")
    .reduce((sum, item) => sum + item.amount, 0);
  assert.ok(Math.abs(otherAmount - 2_375.61) < 0.001);
});

test("OpenAPI payment mapping overrides custom channels and fills scalar-only data", () => {
  const channels = allocateOpenApiPaymentChannels(
    {
      cashRealMoney: 100,
      onlineMoney: 200,
      customMoney: 300,
      customs: [{ customNo: "voucher", customName: "Voucher", money: 200 }],
    },
    { voucher: "other" },
    650,
  );

  assert.deepEqual(channels, [
    { method: "cash", category: "cash", amount: 100 },
    { method: "online", category: "other", amount: 200 },
    { method: "Voucher", category: "other", amount: 200 },
    { method: "custom", category: "other", amount: 100 },
    { method: "other", category: "other", amount: 50 },
  ]);
});
