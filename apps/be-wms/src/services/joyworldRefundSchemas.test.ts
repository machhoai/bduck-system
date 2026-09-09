import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  joyworldRefundCheckResponseSchema,
  joyworldRefundDetailsQuerySchema,
  joyworldRefundDetailsResponseSchema,
  joyworldRefundSubmitHeadersSchema,
  joyworldRefundSubmitRequestSchema,
  joyworldRefundSubmitResponseSchema,
} from "./joyworldRefundSchemas.js";

function readFixture(name: string): unknown {
  const url = new URL(
    `./__fixtures__/joyworld-refund/${name}`,
    import.meta.url,
  );
  return JSON.parse(readFileSync(fileURLToPath(url), "utf8")) as unknown;
}

test("accepts the captured refund details contract", () => {
  const available = joyworldRefundDetailsResponseSchema.parse(
    readFixture("get-details.success.json"),
  );
  const refunded = joyworldRefundDetailsResponseSchema.parse(
    readFixture("get-details.refunded.json"),
  );

  assert.equal(available.data.totalMoney, 180_000);
  assert.equal(available.data.items[0]?.surplusQty, 1);
  assert.equal(refunded.data.totalMoney, 0);
  assert.equal(refunded.data.items[0]?.surplusQty, 0);
});

test("accepts the captured submit response contract", () => {
  const result = joyworldRefundSubmitResponseSchema.parse(
    readFixture("submit.success.json"),
  );

  assert.match(result.data.orderNumber, /^TD/);
  assert.equal(result.data.tasks[0]?.category, 1000);
});

test("accepts the captured submit request contract", () => {
  const request = joyworldRefundSubmitRequestSchema.parse(
    readFixture("submit.request.json"),
  );

  assert.equal(request.totalMoney, request.originalTotalMoney);
  assert.equal(request.items[0]?.cancelQty, 1);
  assert.equal(request.isForcedRefund, true);
});

test("accepts normalized submit headers without persisting captured secrets", () => {
  const headers = joyworldRefundSubmitHeadersSchema.parse({
    authorization: "Bearer redacted-test-token",
    "content-type": "application/json",
    "jj-language": "vi",
    "jj-bizcode": "abcdefghijklmnopqrstuvwxyzABCDEF",
  });

  assert.equal(headers["jj-language"], "vi");
});

test("accepts the observed already-refunded check response", () => {
  const result = joyworldRefundCheckResponseSchema.parse(
    readFixture("check.refunded.json"),
  );

  assert.equal(result.success, false);
  assert.equal(result.data, null);
});

test("validates the refund details UUID query", () => {
  assert.equal(
    joyworldRefundDetailsQuerySchema.parse({
      orderId: "11111111-1111-4111-8111-111111111111",
    }).orderId,
    "11111111-1111-4111-8111-111111111111",
  );
  assert.throws(() =>
    joyworldRefundDetailsQuerySchema.parse({ orderId: "O123" }),
  );
});

test("rejects incomplete or malformed submit requests", () => {
  const validRequest = joyworldRefundSubmitRequestSchema.parse(
    readFixture("submit.request.json"),
  );

  assert.throws(() => joyworldRefundSubmitRequestSchema.parse({}));
  assert.throws(() =>
    joyworldRefundSubmitRequestSchema.parse({
      ...validRequest,
      totalMoney: 0,
    }),
  );
});
