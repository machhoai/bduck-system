import assert from "node:assert/strict";
import test from "node:test";
import {
  isWmsCacheName,
  isWmsServiceWorkerUrl,
  shouldEnableWmsServiceWorker,
} from "./pwaServiceWorkerPolicy.js";

test("service worker is enabled only in production", () => {
  assert.equal(shouldEnableWmsServiceWorker("production"), true);
  assert.equal(shouldEnableWmsServiceWorker("development"), false);
  assert.equal(shouldEnableWmsServiceWorker("test"), false);
  assert.equal(shouldEnableWmsServiceWorker(undefined), false);
});

test("development cleanup targets only the WMS worker and caches", () => {
  assert.equal(
    isWmsServiceWorkerUrl(
      "https://erp.example.com/firebase-messaging-sw.js?build=123",
    ),
    true,
  );
  assert.equal(
    isWmsServiceWorkerUrl("https://erp.example.com/other-sw.js"),
    false,
  );
  assert.equal(isWmsServiceWorkerUrl("not-a-url"), false);
  assert.equal(isWmsCacheName("wms-static-123"), true);
  assert.equal(isWmsCacheName("unrelated-cache"), false);
});
