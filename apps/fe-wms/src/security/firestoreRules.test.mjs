import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import { readFile } from "node:fs/promises";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  collection,
  doc,
  documentId,
  getDoc,
  getDocs,
  query,
  updateDoc,
  where,
} from "firebase/firestore";

const projectId = "bduck-rules-test";
const rules = await readFile(
  new URL("../../../../firestore.rules", import.meta.url),
  "utf8",
);
let environment;

const metadata = (userId, versionId, isSystemAdmin = false) => ({
  id: userId,
  user_id: userId,
  active_version_id: versionId,
  access_version: 1,
  is_global_admin: isSystemAdmin,
  is_deleted: false,
});

async function seedAccess(userId, grants, isSystemAdmin = false) {
  await environment.withSecurityRulesDisabled(async (context) => {
    const firestore = context.firestore();
    const versionId = "access-v1";
    await context
      .firestore()
      .doc(`user_access/${userId}`)
      .set(metadata(userId, versionId, isSystemAdmin));
    await firestore.doc(`user_access/${userId}/versions/${versionId}`).set({
      id: versionId,
      user_id: userId,
      version_number: 1,
      status: "ACTIVE",
      is_deleted: false,
    });
    for (const [facilityId, permissions] of Object.entries(grants)) {
      await firestore
        .doc(
          `user_access/${userId}/versions/${versionId}/facilities/${facilityId}`,
        )
        .set({
          id: facilityId,
          user_id: userId,
          facility_id: facilityId,
          access_version_id: versionId,
          access_version: 1,
          permissions,
          is_deleted: false,
        });
    }
  });
}

async function seedDocuments() {
  await environment.withSecurityRulesDisabled(async (context) => {
    const firestore = context.firestore();
    const writes = [
      ["products/product-1", { name: "Global product" }],
      ["roles/role-1", { name: "Administrator" }],
      ["warehouses/warehouse-c", { name: "Warehouse C", is_deleted: false }],
      ["warehouses/store-d", { name: "Store D", is_deleted: false }],
      ["warehouses/warehouse-e", { name: "Warehouse E", is_deleted: false }],
      ["warehouses/store-f", { name: "Store F", is_deleted: false }],
      ["warehouses/future-store", { name: "Future Store", is_deleted: false }],
      ["warehouses/office-a", { name: "Office A", is_deleted: false }],
      ["warehouses/office-b", { name: "Office B", is_deleted: false }],
      [
        "office_scope_configs/office-a",
        { office_id: "office-a", scope_mode: "SELECTED", is_deleted: false },
      ],
      [
        "office_scope_configs/office-b",
        { office_id: "office-b", scope_mode: "SELECTED", is_deleted: false },
      ],
      [
        "office_scope_ceilings/office-a",
        { office_id: "office-a", scope_mode: "SELECTED", is_deleted: false },
      ],
      [
        "office_scope_ceilings/office-b",
        { office_id: "office-b", scope_mode: "SELECTED", is_deleted: false },
      ],
      [
        "office_scope_materializations/office-a_scope_revision_2",
        {
          office_id: "office-a",
          scope_revision: 2,
          status: "FAILED",
          requested_count: 2,
          completed_count: 1,
          failed_count: 1,
        },
      ],
      [
        "office_scope_materializations/office-b_scope_revision_2",
        {
          office_id: "office-b",
          scope_revision: 2,
          status: "COMPLETED",
          requested_count: 1,
          completed_count: 1,
          failed_count: 0,
        },
      ],
      [
        "office_scope_materialization_jobs/office-a_scope_revision_2",
        {
          office_id: "office-a",
          failed_user_ids: ["user-a"],
        },
      ],
      [
        "office_scope_edges/office-a-store-d",
        {
          office_id: "office-a",
          target_facility_id: "store-d",
          is_deleted: false,
        },
      ],
      [
        "office_scope_edges/office-b-warehouse-c",
        {
          office_id: "office-b",
          target_facility_id: "warehouse-c",
          is_deleted: false,
        },
      ],
      [
        "inventory/inventory-c",
        { warehouse_id: "warehouse-c", is_deleted: false },
      ],
      ["inventory/inventory-d", { warehouse_id: "store-d", is_deleted: false }],
      [
        "inventory/inventory-e",
        { warehouse_id: "warehouse-e", is_deleted: false },
      ],
      ["inventory/inventory-f", { warehouse_id: "store-f", is_deleted: false }],
      [
        "inventory/inventory-future-store",
        { warehouse_id: "future-store", is_deleted: false },
      ],
      [
        "users/user-a",
        { workplace_facility_id: "warehouse-c", is_deleted: false },
      ],
      ["users/user-b", { workplace_facility_id: "store-d", is_deleted: false }],
      [
        "employee_profiles/profile-a",
        {
          user_id: "user-a",
          workplace_warehouse_id: "warehouse-c",
          is_deleted: false,
        },
      ],
      [
        "employee_profiles/profile-b",
        {
          user_id: "user-b",
          workplace_warehouse_id: "store-d",
          is_deleted: false,
        },
      ],
      [
        "import_vouchers/import-c",
        { warehouse_id: "warehouse-c", is_deleted: false },
      ],
      [
        "import_vouchers/import-c/items/item-1",
        { product_id: "product-1", is_deleted: false },
      ],
      [
        "transfer_orders/transfer-cd",
        {
          source_warehouse_id: "warehouse-c",
          destination_warehouse_id: "store-d",
          is_deleted: false,
        },
      ],
      [
        "transfer_orders/transfer-cd/items/item-1",
        { product_id: "product-1", is_deleted: false },
      ],
      [
        "attendance_logs/attendance-c",
        {
          user_id: "user-a",
          warehouse_id: "warehouse-c",
          attendance_date: "2026-07-15",
        },
      ],
      [
        "attendance_logs/attendance-d",
        {
          user_id: "user-b",
          warehouse_id: "store-d",
          attendance_date: "2026-07-15",
        },
      ],
      [
        "expenses/expense-c",
        { warehouse_id: "warehouse-c", period: "2026-07" },
      ],
      [
        "revenue_sync/store-d_2026-07",
        { warehouse_id: "store-d", period: "2026-07" },
      ],
      ["counters/internal-counter", { value: 1 }],
      [
        "in_app_notifications/notification-a",
        { target_user_id: "user-a", is_read: false, is_deleted: false },
      ],
      [
        "in_app_notifications/notification-b",
        { target_user_id: "user-b", is_read: false, is_deleted: false },
      ],
    ];
    await Promise.all(
      writes.map(([path, data]) => firestore.doc(path).set(data)),
    );
  });
}

before(async () => {
  environment = await initializeTestEnvironment({
    projectId,
    firestore: { rules },
  });
});

beforeEach(async () => {
  await environment.clearFirestore();
  await seedAccess("user-a", {
    "office-a": {
      "office_scopes.read": true,
      "warehouses.read": true,
    },
    "warehouse-c": {
      "inventory.read": true,
      "vouchers.read": true,
      "transfers.read": true,
      "warehouses.read": true,
      "attendance.view": true,
      "expenses.read": true,
    },
  });
  await seedAccess("user-b", {
    "store-d": {
      "inventory.read": true,
      "vouchers.read": true,
      "transfers.read": true,
      "warehouses.read": true,
      "revenue.read": true,
    },
  });
  await seedAccess("system-admin", {}, true);
  await seedAccess("office-a-manager", {
    "office-a": { "warehouses.read": true },
    "warehouse-c": { "inventory.read": true },
    "store-d": { "inventory.read": true },
    "warehouse-e": { "inventory.read": true },
    "store-f": { "inventory.read": true },
    "future-store": { "inventory.read": true },
  });
  await seedAccess("office-b-manager", {
    "office-b": { "warehouses.read": true },
    "warehouse-c": { "inventory.read": true },
    "store-d": { "inventory.read": true },
  });
  await seedDocuments();
});

after(async () => {
  await environment.cleanup();
});

describe("grant-aware Firestore rules", () => {
  it("limits office scope listeners to the granted office", async () => {
    const user = environment.authenticatedContext("user-a").firestore();
    await assertSucceeds(getDoc(doc(user, "office_scope_configs", "office-a")));
    await assertFails(getDoc(doc(user, "office_scope_configs", "office-b")));
    await assertSucceeds(
      getDoc(doc(user, "office_scope_ceilings", "office-a")),
    );
    await assertFails(getDoc(doc(user, "office_scope_ceilings", "office-b")));
    await assertSucceeds(
      getDocs(
        query(
          collection(user, "office_scope_edges"),
          where("office_id", "==", "office-a"),
        ),
      ),
    );
    await assertFails(
      getDocs(
        query(
          collection(user, "office_scope_edges"),
          where("office_id", "==", "office-b"),
        ),
      ),
    );
    await assertSucceeds(
      getDocs(
        query(
          collection(user, "office_scope_materializations"),
          where("office_id", "==", "office-a"),
        ),
      ),
    );
    await assertFails(
      getDocs(
        query(
          collection(user, "office_scope_materializations"),
          where("office_id", "==", "office-b"),
        ),
      ),
    );
    await assertFails(
      getDoc(
        doc(
          user,
          "office_scope_materialization_jobs",
          "office-a_scope_revision_2",
        ),
      ),
    );
  });

  it("keeps global master data authenticated and global config admin-only", async () => {
    const anonymous = environment.unauthenticatedContext().firestore();
    const user = environment.authenticatedContext("user-a").firestore();
    const admin = environment.authenticatedContext("system-admin").firestore();
    await assertFails(getDoc(doc(anonymous, "products", "product-1")));
    await assertSucceeds(getDoc(doc(user, "products", "product-1")));
    await assertFails(getDoc(doc(user, "roles", "role-1")));
    await assertSucceeds(getDoc(doc(admin, "roles", "role-1")));
  });

  it("allows only facility-constrained inventory queries", async () => {
    const user = environment.authenticatedContext("user-a").firestore();
    await assertSucceeds(
      getDocs(
        query(
          collection(user, "inventory"),
          where("warehouse_id", "==", "warehouse-c"),
        ),
      ),
    );
    await assertFails(getDoc(doc(user, "inventory", "inventory-d")));
    await assertFails(getDocs(collection(user, "inventory")));
  });

  it("enforces ALL and SELECTED materialized partitions on multi-facility queries", async () => {
    const officeA = environment
      .authenticatedContext("office-a-manager")
      .firestore();
    const officeB = environment
      .authenticatedContext("office-b-manager")
      .firestore();

    const allSnapshot = await assertSucceeds(
      getDocs(
        query(
          collection(officeA, "inventory"),
          where("warehouse_id", "in", [
            "warehouse-c",
            "store-d",
            "warehouse-e",
            "store-f",
            "future-store",
          ]),
        ),
      ),
    );
    assert.equal(allSnapshot.size, 5);

    const selectedSnapshot = await assertSucceeds(
      getDocs(
        query(
          collection(officeB, "inventory"),
          where("warehouse_id", "in", ["warehouse-c", "store-d"]),
        ),
      ),
    );
    assert.equal(selectedSnapshot.size, 2);
    await assertFails(
      getDocs(
        query(
          collection(officeB, "inventory"),
          where("warehouse_id", "in", ["warehouse-c", "warehouse-e"]),
        ),
      ),
    );
  });

  it("revokes an active facility grant without relying on token refresh", async () => {
    const manager = environment
      .authenticatedContext("office-b-manager")
      .firestore();
    await assertSucceeds(getDoc(doc(manager, "inventory", "inventory-d")));

    await environment.withSecurityRulesDisabled(async (context) => {
      const firestore = context.firestore();
      await firestore.doc("user_access/office-b-manager").update({
        active_version_id: "access-v2",
        access_version: 2,
        facility_grant_count: 1,
      });
      await firestore
        .doc("user_access/office-b-manager/versions/access-v2")
        .set({
          id: "access-v2",
          user_id: "office-b-manager",
          version_number: 2,
          status: "ACTIVE",
          is_deleted: false,
        });
      await firestore
        .doc(
          "user_access/office-b-manager/versions/access-v2/facilities/warehouse-c",
        )
        .set({
          id: "warehouse-c",
          user_id: "office-b-manager",
          facility_id: "warehouse-c",
          access_version_id: "access-v2",
          access_version: 2,
          permissions: { "inventory.read": true },
          is_deleted: false,
        });
    });

    await assertSucceeds(getDoc(doc(manager, "inventory", "inventory-c")));
    await assertFails(getDoc(doc(manager, "inventory", "inventory-d")));
  });

  it("limits facility directory, users and profiles to effective scope", async () => {
    const user = environment.authenticatedContext("user-a").firestore();
    await assertSucceeds(
      getDocs(
        query(
          collection(user, "warehouses"),
          where(documentId(), "in", ["warehouse-c"]),
        ),
      ),
    );
    await assertFails(getDoc(doc(user, "warehouses", "store-d")));
    await assertSucceeds(getDoc(doc(user, "users", "user-a")));
    await assertFails(getDoc(doc(user, "users", "user-b")));
    await assertSucceeds(getDoc(doc(user, "employee_profiles", "profile-a")));
    await assertFails(getDoc(doc(user, "employee_profiles", "profile-b")));
  });

  it("inherits voucher and transfer scope into child documents", async () => {
    const sourceUser = environment.authenticatedContext("user-a").firestore();
    const destinationUser = environment
      .authenticatedContext("user-b")
      .firestore();
    await assertSucceeds(
      getDoc(doc(sourceUser, "import_vouchers/import-c/items/item-1")),
    );
    await assertFails(
      getDoc(doc(destinationUser, "import_vouchers/import-c/items/item-1")),
    );
    await assertSucceeds(
      getDoc(doc(sourceUser, "transfer_orders/transfer-cd/items/item-1")),
    );
    await assertSucceeds(
      getDoc(doc(destinationUser, "transfer_orders/transfer-cd/items/item-1")),
    );
  });

  it("keeps notifications recipient-private and updates narrowly", async () => {
    const user = environment.authenticatedContext("user-a").firestore();
    const own = doc(user, "in_app_notifications", "notification-a");
    await assertSucceeds(getDoc(own));
    await assertFails(
      getDoc(doc(user, "in_app_notifications", "notification-b")),
    );
    await assertSucceeds(updateDoc(own, { is_read: true }));
    await assertFails(updateDoc(own, { target_user_id: "user-b" }));
  });

  it("scopes attendance, expenses and store revenue by action and facility", async () => {
    const warehouseUser = environment
      .authenticatedContext("user-a")
      .firestore();
    const storeUser = environment.authenticatedContext("user-b").firestore();
    await assertSucceeds(
      getDocs(
        query(
          collection(warehouseUser, "attendance_logs"),
          where("warehouse_id", "==", "warehouse-c"),
        ),
      ),
    );
    await assertFails(
      getDoc(doc(warehouseUser, "attendance_logs", "attendance-d")),
    );
    await assertSucceeds(getDoc(doc(warehouseUser, "expenses", "expense-c")));
    await assertFails(
      getDoc(doc(warehouseUser, "revenue_sync", "store-d_2026-07")),
    );
    await assertSucceeds(
      getDoc(doc(storeUser, "revenue_sync", "store-d_2026-07")),
    );
  });

  it("keeps access snapshots owner-private and internal collections backend-only", async () => {
    const user = environment.authenticatedContext("user-a").firestore();
    const otherUser = environment.authenticatedContext("user-b").firestore();
    const admin = environment.authenticatedContext("system-admin").firestore();
    await assertSucceeds(getDoc(doc(user, "user_access", "user-a")));
    await assertFails(getDoc(doc(otherUser, "user_access", "user-a")));
    await assertFails(getDoc(doc(user, "counters", "internal-counter")));
    await assertFails(getDoc(doc(admin, "counters", "internal-counter")));
  });

  it("fails closed when the active version pointer no longer matches", async () => {
    await environment.withSecurityRulesDisabled(async (context) => {
      await context.firestore().doc("user_access/user-a").update({
        active_version_id: "access-v2",
        access_version: 2,
      });
    });
    const user = environment.authenticatedContext("user-a").firestore();
    await assertFails(getDoc(doc(user, "inventory", "inventory-c")));
  });

  it("allows a materialized system admin to read facility-scoped data globally", async () => {
    const admin = environment.authenticatedContext("system-admin").firestore();
    const snapshot = await assertSucceeds(
      getDocs(collection(admin, "inventory")),
    );
    assert.equal(snapshot.size, 5);
  });
});
