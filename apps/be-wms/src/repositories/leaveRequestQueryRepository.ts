import type {
  LeaveApprovalConfig,
  LeaveRequest,
} from "@bduck/shared-types";
import { db } from "../config/firebase.js";
import { executeFacilityScopedQuery } from "./facilityScopedQuery.js";

const REQUESTS = "leave_requests";
const APPROVAL_CONFIGS = "leave_approval_configs";

const withRequest = (
  document: FirebaseFirestore.DocumentSnapshot,
): LeaveRequest => ({
  id: document.id,
  ...(document.data() as Omit<LeaveRequest, "id">),
});

const timestampMillis = (value: unknown): number => {
  if (value instanceof Date) return value.getTime();
  if (
    value &&
    typeof value === "object" &&
    "toMillis" in value &&
    typeof value.toMillis === "function"
  ) {
    return value.toMillis();
  }
  return 0;
};

export const findCompanyLeaveApprovalConfig =
  async (): Promise<LeaveApprovalConfig | null> => {
    const snapshot = await db.collection(APPROVAL_CONFIGS).doc("company").get();
    if (!snapshot.exists || snapshot.data()?.is_deleted === true) return null;
    return {
      id: snapshot.id,
      ...(snapshot.data() as Omit<LeaveApprovalConfig, "id">),
    };
  };

export const findLeaveRequestById = async (
  requestId: string,
): Promise<LeaveRequest | null> => {
  const snapshot = await db.collection(REQUESTS).doc(requestId).get();
  return snapshot.exists ? withRequest(snapshot) : null;
};

export const findLeaveRequestsByProfile = async (
  profileId: string,
): Promise<LeaveRequest[]> => {
  const snapshot = await db
    .collection(REQUESTS)
    .where("employee_profile_id", "==", profileId)
    .get();
  return snapshot.docs
    .map(withRequest)
    .filter((request) => !request.is_deleted)
    .sort(
      (left, right) =>
        timestampMillis(right.created_at) - timestampMillis(left.created_at),
    );
};

export const findLeaveRequestsScoped = async (scope: {
  isSystemAdmin: boolean;
  facilityIds: readonly string[];
}): Promise<LeaveRequest[]> => {
  const queryAll = async () => {
    const snapshot = await db
      .collection(REQUESTS)
      .where("is_deleted", "==", false)
      .get();
    return snapshot.docs.map(withRequest);
  };
  const queryChunk = async (facilityIds: readonly string[]) => {
    const snapshot = await db
      .collection(REQUESTS)
      .where("is_deleted", "==", false)
      .where("workplace_warehouse_id", "in", facilityIds)
      .get();
    return snapshot.docs.map(withRequest);
  };
  const groups = await executeFacilityScopedQuery({
    ...scope,
    queryAll,
    queryChunk,
  });
  return groups
    .flat()
    .sort(
      (left, right) =>
        timestampMillis(right.created_at) - timestampMillis(left.created_at),
    );
};

export const createDraftLeaveRequest = async (
  request: LeaveRequest,
): Promise<void> => {
  await db.collection(REQUESTS).doc(request.id).create(request);
};
