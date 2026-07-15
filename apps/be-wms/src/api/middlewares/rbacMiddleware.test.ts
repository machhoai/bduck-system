import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { NextFunction, Request, Response } from "express";
import {
  FACILITY_ACCESS_POLICY_VERSION,
  WarehouseType,
  type FacilityAccessGrantSource,
} from "@bduck/shared-types";
import { createAccessContext } from "../../services/authorization/index.js";
import { attachRequestAccess } from "./requestAccessContext.js";
import {
  requireAnyScopedPermission,
  requirePermission,
} from "./rbacMiddleware.js";

type Middleware = (req: Request, res: Response, next: NextFunction) => unknown;

interface ResponseState {
  statusCode: number | null;
  body: unknown;
  nextCalls: number;
}

const directSource = (id: string): FacilityAccessGrantSource => ({
  type: "DIRECT",
  role_id: `role-${id}`,
  assignment_id: `assignment-${id}`,
  office_id: null,
});

const adminSource: FacilityAccessGrantSource = {
  type: "SYSTEM_GLOBAL",
  role_id: "role-admin",
  assignment_id: "assignment-admin",
  office_id: null,
};

const userContext = createAccessContext({
  actorId: "user-1",
  workplaceFacilityId: "store-d",
  isSystemAdmin: false,
  policyVersion: FACILITY_ACCESS_POLICY_VERSION,
  computedAt: new Date("2026-07-15T00:00:00.000Z"),
  grants: [
    {
      facilityId: "store-d",
      facilityType: WarehouseType.STORE,
      permissions: {
        "inventory.read": true,
        "transfers.read": true,
      },
      sources: [directSource("store-d")],
    },
  ],
});

const adminContext = createAccessContext({
  actorId: "admin-1",
  workplaceFacilityId: null,
  isSystemAdmin: true,
  systemAdminSources: [adminSource],
  policyVersion: FACILITY_ACCESS_POLICY_VERSION,
  computedAt: new Date("2026-07-15T00:00:00.000Z"),
  grants: [],
});

const createRequest = (
  context: typeof userContext | typeof adminContext | null,
): Request => {
  const req = { params: {}, query: {}, body: {} } as unknown as Request;
  if (context) attachRequestAccess(req, context);
  return req;
};

const execute = (middleware: Middleware, req: Request): ResponseState => {
  const state: ResponseState = {
    statusCode: null,
    body: null,
    nextCalls: 0,
  };
  let response: Response;
  response = {
    status: (code: number) => {
      state.statusCode = code;
      return response;
    },
    json: (body: unknown) => {
      state.body = body;
      return response;
    },
  } as unknown as Response;
  const next = (() => {
    state.nextCalls += 1;
  }) as NextFunction;
  middleware(req, response, next);
  return state;
};

describe("rbacMiddleware", () => {
  it("authorizes only the concrete facility returned by the extractor", () => {
    const allowed = execute(
      requirePermission("inventory.read", () => "store-d"),
      createRequest(userContext),
    );
    assert.equal(allowed.nextCalls, 1);

    const denied = execute(
      requirePermission("inventory.read", () => "store-x"),
      createRequest(userContext),
    );
    assert.equal(denied.nextCalls, 0);
    assert.equal(denied.statusCode, 403);
  });

  it("reserves permission checks without an extractor for system admin", () => {
    const user = execute(
      requirePermission("inventory.read"),
      createRequest(userContext),
    );
    const admin = execute(
      requirePermission("system.config"),
      createRequest(adminContext),
    );

    assert.equal(user.statusCode, 403);
    assert.equal(user.nextCalls, 0);
    assert.equal(admin.nextCalls, 1);
  });

  it("denies empty, malformed, or throwing facility extractors", () => {
    const extractors = [
      () => "",
      () => "   ",
      () => null,
      () => undefined,
      () => 123 as never,
      () => {
        throw new Error("extractor failed");
      },
    ];

    extractors.forEach((extractor) => {
      const result = execute(
        requirePermission("inventory.read", extractor),
        createRequest(userContext),
      );
      assert.equal(result.nextCalls, 0);
      assert.equal(result.statusCode, 403);
    });
  });

  it("uses AccessContext for coarse gates and ignores legacy permissions", () => {
    const allowed = execute(
      requireAnyScopedPermission(["inventory.write", "inventory.read"]),
      createRequest(userContext),
    );
    assert.equal(allowed.nextCalls, 1);

    const missingContext = createRequest(null);
    Object.defineProperty(missingContext, "user", {
      value: { permissions: { global: { "*": true } } },
    });
    const denied = execute(
      requireAnyScopedPermission("inventory.read"),
      missingContext,
    );
    assert.equal(denied.statusCode, 403);
    assert.equal(denied.nextCalls, 0);

    const admin = execute(
      requireAnyScopedPermission("system.config"),
      createRequest(adminContext),
    );
    assert.equal(admin.nextCalls, 1);
  });

  it("rejects unissued contexts and returns bilingual errors", () => {
    const req = createRequest(null);
    Object.defineProperty(req, "accessContext", {
      value: Object.freeze({ isSystemAdmin: true, grants: {} }),
    });
    const result = execute(requireAnyScopedPermission("inventory.read"), req);
    const body = result.body as {
      messages?: { vi?: string; zh?: string };
    };

    assert.equal(result.statusCode, 403);
    assert.ok((body.messages?.vi?.length ?? 0) > 0);
    assert.ok((body.messages?.zh?.length ?? 0) > 0);
  });
});
