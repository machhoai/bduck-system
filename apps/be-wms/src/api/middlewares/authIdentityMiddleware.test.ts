import assert from "node:assert/strict";
import test from "node:test";
import type { NextFunction, Request, Response } from "express";
import { UserStatus, type User } from "@bduck/shared-types";
import { createRequireIdentityAuth } from "./identityAuthMiddleware.js";

const activeUser = (overrides: Partial<User> = {}): User => ({
  id: "user-a",
  username: "user.a",
  email: "user.a@example.com",
  password_hash: "must-not-be-attached",
  full_name: "User A",
  employee_id: "EMP-A",
  status: UserStatus.ACTIVE,
  is_deleted: false,
  created_at: new Date("2026-07-01T00:00:00.000Z"),
  updated_at: new Date("2026-07-17T00:00:00.000Z"),
  workplace_facility_id: null,
  mfa_enabled: true,
  ...overrides,
});

const responseRecorder = () => {
  const result: { statusCode: number; body: unknown } = {
    statusCode: 200,
    body: null,
  };
  const response = {
    status(statusCode: number) {
      result.statusCode = statusCode;
      return this;
    },
    json(body: unknown) {
      result.body = body;
      return this;
    },
  } as unknown as Response;
  return { response, result };
};

test("identity-only authentication allows MFA without materialized facility access", async () => {
  const req = {} as Request;
  const { response, result } = responseRecorder();
  let nextCalls = 0;
  const middleware = createRequireIdentityAuth({
    verifyClaims: async () => ({ uid: "user-a" }),
    loadUser: async () => activeUser(),
  });

  await middleware(req, response, (() => {
    nextCalls += 1;
  }) as NextFunction);

  assert.equal(nextCalls, 1);
  assert.equal(result.statusCode, 200);
  assert.equal(req.user?.id, "user-a");
  assert.equal(req.user?.email, "user.a@example.com");
  assert.deepEqual(req.user?.roleIds, []);
  assert.equal(req.accessContext, undefined);
  assert.equal(Object.hasOwn(req.user ?? {}, "password_hash"), false);
});

test("identity-only authentication still rejects missing and inactive identities", async () => {
  const missingClaims = responseRecorder();
  let loadCalls = 0;
  const noSession = createRequireIdentityAuth({
    verifyClaims: async () => null,
    loadUser: async () => {
      loadCalls += 1;
      return activeUser();
    },
  });
  await noSession(
    {} as Request,
    missingClaims.response,
    (() => undefined) as NextFunction,
  );
  assert.equal(missingClaims.result.statusCode, 401);
  assert.equal(loadCalls, 0);

  const inactiveIdentity = responseRecorder();
  let nextCalls = 0;
  const inactiveSession = createRequireIdentityAuth({
    verifyClaims: async () => ({ uid: "user-a" }),
    loadUser: async () => activeUser({ status: UserStatus.INACTIVE }),
  });
  await inactiveSession({} as Request, inactiveIdentity.response, (() => {
    nextCalls += 1;
  }) as NextFunction);
  assert.equal(inactiveIdentity.result.statusCode, 403);
  assert.equal(nextCalls, 0);
});
