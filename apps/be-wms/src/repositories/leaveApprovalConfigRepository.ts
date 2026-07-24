import type {
  LeaveApprovalConfig,
  Role,
  User,
} from "@bduck/shared-types";
import { db } from "../config/firebase.js";

const CONFIGS = "leave_approval_configs";

export const getCompanyLeaveApprovalConfig =
  async (): Promise<LeaveApprovalConfig | null> => {
    const snapshot = await db.collection(CONFIGS).doc("company").get();
    if (!snapshot.exists || snapshot.data()?.is_deleted === true) return null;
    return {
      id: snapshot.id,
      ...(snapshot.data() as Omit<LeaveApprovalConfig, "id">),
    };
  };

export const saveCompanyLeaveApprovalConfig = async (
  config: LeaveApprovalConfig,
): Promise<void> => {
  await db.collection(CONFIGS).doc(config.id).set(config);
};

export const findLeaveApprovalRoles = async (): Promise<Role[]> => {
  const snapshot = await db
    .collection("roles")
    .where("is_deleted", "==", false)
    .get();
  return snapshot.docs
    .map((document) => ({ id: document.id, ...document.data() }) as Role)
    .filter(
      (role) =>
        role.permissions["*"] === true ||
        role.permissions["leave.approve"] === true,
    )
    .sort((left, right) => left.name.localeCompare(right.name));
};

export const findActiveLeaveApprovalUsers = async (): Promise<User[]> => {
  const snapshot = await db
    .collection("users")
    .where("is_deleted", "==", false)
    .where("status", "==", "ACTIVE")
    .get();
  return snapshot.docs
    .map((document) => ({ id: document.id, ...document.data() }) as User)
    .sort((left, right) => left.full_name.localeCompare(right.full_name));
};
