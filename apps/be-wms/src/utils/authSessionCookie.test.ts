import assert from "node:assert/strict";
import test from "node:test";
import { buildAuthSessionCookieOptions } from "./authSessionCookie.js";

test("uses HttpOnly, Secure and SameSite Strict in production", () => {
  assert.deepEqual(buildAuthSessionCookieOptions(1_000, "production"), {
    maxAge: 1_000,
    httpOnly: true,
    secure: true,
    sameSite: "strict",
  });
});

test("keeps SameSite Strict locally while allowing development HTTP", () => {
  assert.deepEqual(buildAuthSessionCookieOptions(1_000, "development"), {
    maxAge: 1_000,
    httpOnly: true,
    secure: false,
    sameSite: "strict",
  });
});
