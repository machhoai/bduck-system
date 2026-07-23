import {
  EmployeeEmploymentStatus,
  EmployeeEmploymentTransitionStatus,
  type EmployeeEmploymentTransition,
  type EmployeeProfile,
} from "@bduck/shared-types";
import { randomUUID } from "crypto";
import { db } from "../config/firebase.js";

const TRANSITIONS_COLLECTION = "employee_employment_transitions";
const TRANSITION_LOCKS_COLLECTION = "employee_employment_transition_locks";
const PROFILES_COLLECTION = "employee_profiles";

const withId = (
  snapshot: FirebaseFirestore.DocumentSnapshot,
): EmployeeEmploymentTransition => ({
  id: snapshot.id,
  ...(snapshot.data() as Omit<EmployeeEmploymentTransition, "id">),
});

const transitionError = (vi: string, zh: string, statusCode = 409) => ({
  statusCode,
  messages: { vi, zh },
});

export interface EmploymentTransitionDraft {
  employee_profile_id: string;
  employee_user_id: string | null;
  workplace_warehouse_id: string;
  from_status: EmployeeEmploymentStatus;
  to_status: EmployeeEmploymentStatus;
  effective_date: string;
  probation_end_date: string | null;
  reason: string;
  requested_by: string;
  action_time?: Date;
}

type EmploymentProfilePatch = Partial<
  Pick<
    EmployeeProfile,
    | "employment_status"
    | "probation_start_date"
    | "probation_end_date"
    | "official_start_date"
    | "resignation_date"
    | "status"
  >
>;

export const createEmployeeEmploymentTransitionRecord = async (
  draft: EmploymentTransitionDraft,
  profilePatch: EmploymentProfilePatch | null,
): Promise<{
  transition: EmployeeEmploymentTransition;
  previousProfile: EmployeeProfile;
  profile: EmployeeProfile;
}> =>
  db.runTransaction(async (transaction) => {
    const transitionRef = db
      .collection(TRANSITIONS_COLLECTION)
      .doc(randomUUID());
    const profileRef = db
      .collection(PROFILES_COLLECTION)
      .doc(draft.employee_profile_id);
    const lockRef = db
      .collection(TRANSITION_LOCKS_COLLECTION)
      .doc(draft.employee_profile_id);
    const [profileSnapshot, lockSnapshot] = await Promise.all([
      transaction.get(profileRef),
      transaction.get(lockRef),
    ]);
    if (
      !profileSnapshot.exists ||
      profileSnapshot.data()?.is_deleted === true
    ) {
      throw transitionError(
        "Hồ sơ nhân viên không tồn tại hoặc đã bị xóa.",
        "员工档案不存在或已被删除。",
        404,
      );
    }
    const previousProfile = {
      id: profileSnapshot.id,
      ...(profileSnapshot.data() as Omit<EmployeeProfile, "id">),
    };
    const currentStatus =
      previousProfile.employment_status ?? EmployeeEmploymentStatus.UNSPECIFIED;
    if (currentStatus !== draft.from_status) {
      throw transitionError(
        "Trạng thái lao động đã thay đổi. Vui lòng tải lại hồ sơ.",
        "劳动状态已变更，请重新加载档案。",
      );
    }
    if (lockSnapshot.exists && lockSnapshot.data()?.is_active === true) {
      throw transitionError(
        "Nhân viên đã có một lệnh chuyển trạng thái đang chờ hiệu lực.",
        "该员工已有待生效的状态转换。",
      );
    }

    const now = new Date();
    const isImmediate = profilePatch !== null;
    const transitionRecord: EmployeeEmploymentTransition = {
      id: transitionRef.id,
      ...draft,
      status: isImmediate
        ? EmployeeEmploymentTransitionStatus.APPLIED
        : EmployeeEmploymentTransitionStatus.SCHEDULED,
      applied_by: isImmediate ? draft.requested_by : null,
      applied_at: isImmediate ? now : null,
      cancelled_by: null,
      cancelled_at: null,
      cancellation_reason: null,
      is_deleted: false,
      created_at: now,
      updated_at: now,
      action_time: draft.action_time ?? now,
      sync_time: now,
    };
    transaction.set(transitionRef, transitionRecord);

    let profile = previousProfile;
    if (isImmediate) {
      profile = { ...previousProfile, ...profilePatch, updated_at: now };
      transaction.update(profileRef, { ...profilePatch, updated_at: now });
    } else {
      transaction.set(
        lockRef,
        {
          employee_profile_id: draft.employee_profile_id,
          transition_id: transitionRef.id,
          is_active: true,
          created_at: now,
          updated_at: now,
        },
        { merge: true },
      );
    }

    return {
      transition: transitionRecord,
      previousProfile,
      profile,
    };
  });

export const applyScheduledEmployeeEmploymentTransition = async (
  transitionId: string,
  profilePatch: EmploymentProfilePatch,
  appliedBy: string,
): Promise<{
  transitionBefore: EmployeeEmploymentTransition;
  transition: EmployeeEmploymentTransition;
  previousProfile: EmployeeProfile;
  profile: EmployeeProfile;
} | null> =>
  db.runTransaction(async (transaction) => {
    const transitionRef = db
      .collection(TRANSITIONS_COLLECTION)
      .doc(transitionId);
    const transitionSnapshot = await transaction.get(transitionRef);
    if (!transitionSnapshot.exists) return null;
    const transitionBefore = withId(transitionSnapshot);
    if (
      transitionBefore.is_deleted ||
      transitionBefore.status !== EmployeeEmploymentTransitionStatus.SCHEDULED
    ) {
      return null;
    }

    const profileRef = db
      .collection(PROFILES_COLLECTION)
      .doc(transitionBefore.employee_profile_id);
    const lockRef = db
      .collection(TRANSITION_LOCKS_COLLECTION)
      .doc(transitionBefore.employee_profile_id);
    const [profileSnapshot, lockSnapshot] = await Promise.all([
      transaction.get(profileRef),
      transaction.get(lockRef),
    ]);
    if (
      !profileSnapshot.exists ||
      profileSnapshot.data()?.is_deleted === true
    ) {
      throw transitionError(
        "Hồ sơ nhân viên không tồn tại hoặc đã bị xóa.",
        "员工档案不存在或已被删除。",
        404,
      );
    }
    const previousProfile = {
      id: profileSnapshot.id,
      ...(profileSnapshot.data() as Omit<EmployeeProfile, "id">),
    };
    const currentStatus =
      previousProfile.employment_status ?? EmployeeEmploymentStatus.UNSPECIFIED;
    if (currentStatus !== transitionBefore.from_status) {
      throw transitionError(
        "Không thể áp dụng vì trạng thái hiện tại không còn khớp với lệnh.",
        "当前状态与转换记录不一致，无法应用。",
      );
    }

    const now = new Date();
    const transitionAfter: EmployeeEmploymentTransition = {
      ...transitionBefore,
      status: EmployeeEmploymentTransitionStatus.APPLIED,
      applied_by: appliedBy,
      applied_at: now,
      updated_at: now,
      sync_time: now,
    };
    const profile = { ...previousProfile, ...profilePatch, updated_at: now };
    transaction.update(transitionRef, {
      status: transitionAfter.status,
      applied_by: transitionAfter.applied_by,
      applied_at: transitionAfter.applied_at,
      updated_at: now,
      sync_time: now,
    });
    transaction.update(profileRef, { ...profilePatch, updated_at: now });
    if (
      lockSnapshot.exists &&
      lockSnapshot.data()?.transition_id === transitionId
    ) {
      transaction.set(
        lockRef,
        { is_active: false, updated_at: now },
        { merge: true },
      );
    }
    return {
      transitionBefore,
      transition: transitionAfter,
      previousProfile,
      profile,
    };
  });
