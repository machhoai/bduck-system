import assert from "node:assert/strict";
import test from "node:test";
import {
  UserStatus,
  type Role,
  type User,
  type UserWarehouseRole,
} from "@bduck/shared-types";
import {
  createSessionLoginWithDependencies,
  type AuthSessionDependencies,
} from "./authSessionFlow.js";

const activeUser = (overrides: Partial<User> = {}): User => ({
  id: "user-a",
  username: "user.a",
  email: "user.a@example.com",
  password_hash: "",
  full_name: "User A",
  employee_id: "employee-a",
  status: UserStatus.ACTIVE,
  is_deleted: false,
  created_at: new Date("2026-07-01T00:00:00.000Z"),
  updated_at: new Date("2026-07-01T00:00:00.000Z"),
  ...overrides,
});

const activeAssignment = (
  overrides: Partial<UserWarehouseRole> = {},
): UserWarehouseRole => ({
  id: "assignment-a",
  user_id: "user-a",
  warehouse_id: "warehouse-a",
  role_id: "role-admin",
  assigned_by: "system",
  valid_from: "2026-07-01",
  valid_until: null,
  is_active: true,
  is_deleted: false,
  created_at: new Date("2026-07-01T00:00:00.000Z"),
  ...overrides,
});

const adminRole: Role = {
  id: "role-admin",
  name: "ADMIN",
  description: null,
  color: "#000000",
  parent_id: null,
  permissions: { "users.read": true },
  board_position: null,
  is_deleted: false,
  created_at: new Date("2026-07-01T00:00:00.000Z"),
  updated_at: new Date("2026-07-01T00:00:00.000Z"),
};

const dependenciesFor = (
  user: User | null,
  events: string[],
): AuthSessionDependencies => ({
  verifyIdToken: async () => {
    events.push("verify-token");
    return { uid: "user-a" };
  },
  getUserById: async () => {
    events.push("get-user");
    return user;
  },
  getUserWarehouseRoles: async () => {
    events.push("get-roles");
    return [
      activeAssignment(),
      activeAssignment({ id: "deleted-assignment", is_deleted: true }),
      activeAssignment({ id: "empty-scope", warehouse_id: "" }),
    ];
  },
  getRoleById: async () => {
    events.push("get-role-definition");
    return adminRole;
  },
  createSessionCookie: async () => {
    events.push("create-cookie");
    return "session-cookie";
  },
});

test("creates a cookie only after validating user and active role state", async () => {
  const events: string[] = [];
  const result = await createSessionLoginWithDependencies(
    "id-token",
    dependenciesFor(activeUser(), events),
    new Date("2026-07-15T03:00:00.000Z"),
  );

  assert.deepEqual(events, [
    "verify-token",
    "get-user",
    "get-roles",
    "get-role-definition",
    "create-cookie",
  ]);
  assert.deepEqual(
    result.roles.map(({ id }) => id),
    ["assignment-a"],
  );
  assert.equal("global" in result.permissions, false);
  assert.deepEqual(result.permissions, {
    "warehouse-a": { "users.read": true },
  });
  assert.equal(
    (result.permissions["warehouse-a"] as Record<string, unknown>)["*"],
    undefined,
  );
});

test("never creates a cookie for missing, inactive, suspended or deleted users", async () => {
  const cases: Array<[string, User | null, string]> = [
    ["missing", null, "USER_NOT_FOUND"],
    [
      "inactive",
      activeUser({ status: UserStatus.INACTIVE }),
      "USER_ACCOUNT_NOT_ACTIVE",
    ],
    [
      "suspended",
      activeUser({ status: UserStatus.SUSPENDED }),
      "USER_ACCOUNT_NOT_ACTIVE",
    ],
    ["deleted", activeUser({ is_deleted: true }), "USER_ACCOUNT_NOT_ACTIVE"],
  ];

  for (const [label, user, expectedError] of cases) {
    const events: string[] = [];
    await assert.rejects(
      createSessionLoginWithDependencies(
        "id-token",
        dependenciesFor(user, events),
      ),
      new RegExp(expectedError),
      label,
    );
    assert.equal(events.includes("create-cookie"), false, label);
    assert.equal(events.includes("get-roles"), false, label);
  }
});

test("fails closed when the persisted deletion flag is missing", async () => {
  const events: string[] = [];
  const malformedUser = {
    ...activeUser(),
    is_deleted: undefined,
  } as unknown as User;

  await assert.rejects(
    createSessionLoginWithDependencies(
      "id-token",
      dependenciesFor(malformedUser, events),
    ),
    /USER_ACCOUNT_NOT_ACTIVE/,
  );
  assert.equal(events.includes("create-cookie"), false);
});
