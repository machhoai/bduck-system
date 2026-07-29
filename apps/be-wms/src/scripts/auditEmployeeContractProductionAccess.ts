import { db } from "../config/firebase.js";

const CONTRACT_PERMISSION_PREFIX = "employees.contracts.";

const main = async () => {
  const [rolesSnapshot, assignmentsSnapshot] = await Promise.all([
    db.collection("roles").where("is_deleted", "==", false).get(),
    db
      .collection("user_warehouse_roles")
      .where("is_deleted", "==", false)
      .get(),
  ]);
  const assignmentCountByRole = new Map<string, number>();
  for (const document of assignmentsSnapshot.docs) {
    const roleId = document.data().role_id;
    if (typeof roleId !== "string") continue;
    assignmentCountByRole.set(
      roleId,
      (assignmentCountByRole.get(roleId) ?? 0) + 1,
    );
  }
  const roles = rolesSnapshot.docs.map((document) => {
    const data = document.data();
    const permissions =
      data.permissions && typeof data.permissions === "object"
        ? (data.permissions as Record<string, unknown>)
        : {};
    return {
      id: document.id,
      name: typeof data.name === "string" ? data.name : "",
      assignments: assignmentCountByRole.get(document.id) ?? 0,
      employee_permissions: Object.keys(permissions)
        .filter(
          (permission) =>
            permission.startsWith("employees.") &&
            permissions[permission] === true,
        )
        .sort(),
      contract_permissions: Object.keys(permissions)
        .filter(
          (permission) =>
            permission.startsWith(CONTRACT_PERMISSION_PREFIX) &&
            permissions[permission] === true,
        )
        .sort(),
    };
  });
  console.log(JSON.stringify({ roles }, null, 2));
};

main().catch((error) => {
  console.error(
    "[auditEmployeeContractProductionAccess]",
    error instanceof Error ? error.message : error,
  );
  process.exitCode = 1;
});
