import assert from "node:assert/strict";
import test from "node:test";

import {
  requestJposProductSync,
  signJposProductSyncRequest,
} from "./jposProductSyncClient.js";

test("JPULSE and JPOS use a stable HMAC request contract", () => {
  assert.equal(
    signJposProductSyncRequest(
      "secret",
      "1725760800000",
      "request-1",
      '{"actor_id":"admin"}',
    ),
    "4d2895184894149aa6a85a3c898258c90516c35abf97db75f9f3328a2f48feb2",
  );
});

test("product sync client sends server-only signed metadata", async () => {
  const previousUrl = process.env.JPOS_PRODUCT_SYNC_URL;
  const previousSecret = process.env.JPOS_PRODUCT_SYNC_SECRET;
  const previousFetch = globalThis.fetch;
  process.env.JPOS_PRODUCT_SYNC_URL = "https://jpos.example/sync";
  process.env.JPOS_PRODUCT_SYNC_SECRET = "secret";
  globalThis.fetch = async (input, init) => {
    if (String(input).startsWith("http://metadata.google.internal/")) {
      const metadataHeaders = new Headers(init?.headers);
      assert.equal(metadataHeaders.get("Metadata-Flavor"), "Google");
      assert.match(String(input), /audience=https%3A%2F%2Fjpos\.example/);
      return new Response("identity-token");
    }
    const headers = new Headers(init?.headers);
    const body = String(init?.body);
    const timestamp = headers.get("X-Jpulse-Timestamp") || "";
    const requestId = headers.get("X-Jpulse-Request-Id") || "";
    assert.equal(headers.get("Authorization"), "Bearer identity-token");
    assert.equal(
      headers.get("X-Jpulse-Signature"),
      signJposProductSyncRequest("secret", timestamp, requestId, body),
    );
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          success: true,
          productCount: 2,
          souvenirProductCount: 0,
          disabledProductCount: 0,
          removedProductCount: 0,
          removedSouvenirCount: 0,
          newProductCount: 1,
          newProductIds: ["new-product"],
          hiddenWarehouseCount: 1,
          syncedAt: "2026-09-08T03:00:00.000Z",
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  };

  try {
    const result = await requestJposProductSync({
      actorId: "user-1",
      warehouseId: "24065d70-e6b1-4b4a-b5d6-e8b69149afe4",
      requestId: "0d90a1ce-2965-43cb-9daa-f8c1b31b7308",
      actionTime: "2026-09-08T10:00:00+07:00",
    });
    assert.deepEqual(result.newProductIds, ["new-product"]);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousUrl === undefined) delete process.env.JPOS_PRODUCT_SYNC_URL;
    else process.env.JPOS_PRODUCT_SYNC_URL = previousUrl;
    if (previousSecret === undefined)
      delete process.env.JPOS_PRODUCT_SYNC_SECRET;
    else process.env.JPOS_PRODUCT_SYNC_SECRET = previousSecret;
  }
});
