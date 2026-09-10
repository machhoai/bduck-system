import assert from "node:assert/strict";
import test from "node:test";

import {
  isPosDeviceWatchRequest,
  resolvePosDeviceWatchRateLimitKey,
  resolvePosDeviceSessionRateLimitKey,
  resolvePosSettingsMutationRateLimitKey,
  resolveTrustProxySetting,
} from "./rateLimitMiddleware.js";

test("uses one trusted proxy hop only in production by default", () => {
  assert.equal(resolveTrustProxySetting(undefined, "production"), 1);
  assert.equal(resolveTrustProxySetting(undefined, "development"), false);
});

test("accepts a bounded explicit proxy hop count", () => {
  assert.equal(resolveTrustProxySetting("2", "production"), 2);
  assert.equal(resolveTrustProxySetting("10", "production"), 10);
});

test("fails closed for unsafe or malformed proxy settings", () => {
  assert.equal(resolveTrustProxySetting("true", "production"), false);
  assert.equal(resolveTrustProxySetting("11", "production"), false);
  assert.equal(resolveTrustProxySetting("-1", "production"), false);
  assert.equal(resolveTrustProxySetting("0", "production"), false);
});

test("isolates POS session limits by device and client IP", () => {
  const firstDevice = resolvePosDeviceSessionRateLimitKey({
    body: { device_id: "a642997b-e955-4af7-9b68-275982398c46" },
    ip: "203.0.113.10",
  });
  const secondDevice = resolvePosDeviceSessionRateLimitKey({
    body: { device_id: "b642997b-e955-4af7-9b68-275982398c46" },
    ip: "203.0.113.10",
  });
  const firstDeviceFromAnotherIp = resolvePosDeviceSessionRateLimitKey({
    body: { device_id: "a642997b-e955-4af7-9b68-275982398c46" },
    ip: "203.0.113.11",
  });

  assert.notEqual(firstDevice, secondDevice);
  assert.notEqual(firstDevice, firstDeviceFromAnotherIp);
});

test("falls back to an IP limit when the POS device id is invalid", () => {
  const missingDevice = resolvePosDeviceSessionRateLimitKey({
    body: {},
    ip: "2001:db8:1234:5678::1",
  });
  const malformedDevice = resolvePosDeviceSessionRateLimitKey({
    body: { device_id: "not-a-device-id" },
    ip: "2001:db8:1234:5678::2",
  });

  assert.equal(missingDevice, malformedDevice);
});

test("isolates POS watch limits by device behind the same public IP", () => {
  const firstDevice = resolvePosDeviceWatchRateLimitKey({
    body: { device_id: "a642997b-e955-4af7-9b68-275982398c46" },
    ip: "203.0.113.10",
  });
  const secondDevice = resolvePosDeviceWatchRateLimitKey({
    body: { device_id: "b642997b-e955-4af7-9b68-275982398c46" },
    ip: "203.0.113.10",
  });

  assert.notEqual(firstDevice, secondDevice);
});

test("isolates POS settings mutations by device behind shared store NAT", () => {
  const request = {
    ip: "203.0.113.10",
    params: {},
    user: { id: "cashier" },
  };
  const first = resolvePosSettingsMutationRateLimitKey({
    ...request,
    headers: { "x-pos-device-id": "a642997b-e955-4af7-9b68-275982398c46" },
  });
  const second = resolvePosSettingsMutationRateLimitKey({
    ...request,
    headers: { "x-pos-device-id": "b642997b-e955-4af7-9b68-275982398c46" },
  });
  assert.notEqual(first, second);
});

test("exempts only POST POS device watch endpoints from the global IP limit", () => {
  assert.equal(
    isPosDeviceWatchRequest({
      method: "POST",
      originalUrl: "/api/pos/devices/customer-display-settings/watch?source=jpos",
    }),
    true,
  );
  assert.equal(
    isPosDeviceWatchRequest({
      method: "GET",
      originalUrl: "/api/pos/devices/customer-display-settings/watch",
    }),
    false,
  );
  assert.equal(
    isPosDeviceWatchRequest({
      method: "POST",
      originalUrl: "/api/pos/devices/session",
    }),
    false,
  );
});
