import { readFileSync } from "fs";
import { resolve } from "path";

// Parse .env.local
const envPath = resolve(process.cwd(), "../../.env.local");
const envFile = readFileSync(envPath, "utf-8");

const prodBase64 = envFile.match(
  /PROD_FIREBASE_SERVICE_ACCOUNT_BASE64="?(.*?)"?(\n|$)/,
)?.[1];
if (!prodBase64)
  throw new Error("Could not find PROD_FIREBASE_SERVICE_ACCOUNT_BASE64");

process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 = prodBase64;
process.env.FIREBASE_PROJECT_ID =
  envFile.match(/PROD_FIREBASE_PROJECT_ID="?(.*?)"?(\n|$)/)?.[1] ||
  "jw-system-f2104";

// Now use DYNAMIC import to ensure env variables are set BEFORE imports are evaluated
async function seed() {
  console.log("🚀 Seeding PROD Database...");

  const { createUser } = await import("../services/userService.js");
  const { roleRepository } = await import("../repositories/roleRepository.js");
  const { formatRoleAssignmentDate } =
    await import("../services/roleAssignmentValidity.js");
  const { FACILITY_ACCESS_POLICY_VERSION, UserStatus } =
    await import("@bduck/shared-types");
  const { AuthorizationService, createAccessContext } =
    await import("../services/authorization/index.js");
  const { randomUUID } = await import("crypto");
  const { db } = await import("../config/firebase.js");

  let superAdminRole = await roleRepository.findByName("SUPER_ADMIN");
  if (!superAdminRole) {
    console.log("Creating SUPER_ADMIN role...");
    const roleId = randomUUID();
    superAdminRole = {
      id: roleId,
      name: "SUPER_ADMIN",
      description: "Quản trị viên cấp cao toàn quyền hệ thống",
      color: "#ef4444", // Red
      parent_id: null,
      permissions: { "*": true },
      board_position: null,
      is_deleted: false,
      created_at: new Date(),
      updated_at: new Date(),
    };
    await db.collection("roles").doc(roleId).set(superAdminRole);
  } else {
    console.log("SUPER_ADMIN role already exists.");
  }

  const adminData = {
    username: "admin",
    email: "admin@joyworld.vn",
    full_name: "System Admin",
    employee_id: "EMP-ADMIN-PROD",
    workplace_facility_id: null,
    status: UserStatus.ACTIVE,
    assignments: [
      {
        role_id: superAdminRole.id,
        warehouse_id: null,
        valid_from: formatRoleAssignmentDate(new Date()),
        valid_until: null,
        is_active: true,
      },
    ],
  };

  try {
    console.log(`Creating user ${adminData.email}...`);
    const seedAuthorization = new AuthorizationService(
      createAccessContext({
        actorId: "SYSTEM_SEED",
        workplaceFacilityId: null,
        isSystemAdmin: true,
        systemAdminSources: [
          {
            type: "SYSTEM_GLOBAL",
            role_id: superAdminRole.id,
            assignment_id: "SYSTEM_SEED_ASSIGNMENT",
            office_id: null,
          },
        ],
        policyVersion: FACILITY_ACCESS_POLICY_VERSION,
        computedAt: new Date(),
        grants: [],
      }),
    );
    await createUser(adminData, "SYSTEM_SEED", seedAuthorization, undefined, {
      createEmployeeProfile: false,
    });
    console.log("✅ Admin user created successfully!");
    console.log(`Email: ${adminData.email}`);
    console.log(`Username: ${adminData.username}`);
  } catch (error: any) {
    if (
      error.statusCode === 409 ||
      error.code === "auth/email-already-exists"
    ) {
      console.log(
        "⚠️ Admin user already exists. If you forgot the password, you may need to reset it via Firebase Console or change the script to update the password.",
      );
    } else {
      console.error("❌ Failed to create admin:", error);
    }
  }
}

seed()
  .catch(console.error)
  .finally(() => process.exit(0));
