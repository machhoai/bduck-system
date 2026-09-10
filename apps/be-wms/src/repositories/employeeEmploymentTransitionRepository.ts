import { randomUUID } from "crypto";

import {
  EmployeeEmploymentStatus,
  EmployeeEmploymentTransitionStatus,
  type EmployeeEmploymentTransition,
  type EmployeeProfile,
} from "@bduck/shared-types";

import { db } from "../config/firebase.js";

import {
  applyEmployeeOffboardingWrites,
  loadEmployeeOffboardingState,
} from "./employeeOffboardingRepository.js";

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
  ip_address?: string | null;
  device_id?: string | null;
  session_token?: string | null;
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
  auditsWritten: boolean;
  identitySyncJobId: string | null;
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
    const isOffboarding =
      isImmediate && draft.to_status === EmployeeEmploymentStatus.RESIGNED;
    const offboardingState = isOffboarding
      ? await loadEmployeeOffboardingState(
          transaction,
          previousProfile.user_id,
        )
      : null;
    const transitionRecord: EmployeeEmploymentTransition = {
      id: transitionRef.id,
      employee_profile_id: draft.employee_profile_id,
      employee_user_id: draft.employee_user_id,
      workplace_warehouse_id: draft.workplace_warehouse_id,
      from_status: draft.from_status,
      to_status: draft.to_status,
      effective_date: draft.effective_date,
      probation_end_date: draft.probation_end_date,
      reason: draft.reason,
      requested_by: draft.requested_by,
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

    const identitySyncJobId = isOffboarding
      ? applyEmployeeOffboardingWrites(transaction, {
          transitionBefore: null,
          transitionAfter: transitionRecord,
          profileBefore: previousProfile,
          profileAfter: profile,
          state: offboardingState,
          actorId: draft.requested_by,
          actionTime: draft.action_time ?? now,
          syncTime: now,
          metadata: {
            action_time: draft.action_time,
            ip_address: draft.ip_address,
            device_id: draft.device_id,
            session_token: draft.session_token,
          },
        })
      : null;

    return {
      transition: transitionRecord,
      previousProfile,
      profile,
      auditsWritten: isOffboarding,
      identitySyncJobId,
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
  auditsWritten: boolean;
  identitySyncJobId: string | null;
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
    const isOffboarding =
      transitionBefore.to_status === EmployeeEmploymentStatus.RESIGNED;
    const offboardingState = isOffboarding
      ? await loadEmployeeOffboardingState(
          transaction,
          previousProfile.user_id,
        )
      : null;
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
    const identitySyncJobId = isOffboarding
      ? applyEmployeeOffboardingWrites(transaction, {
          transitionBefore,
          transitionAfter,
          profileBefore: previousProfile,
          profileAfter: profile,
          state: offboardingState,
          actorId: appliedBy,
          actionTime: now,
          syncTime: now,
        })
      : null;
    return {
      transitionBefore,
      transition: transitionAfter,
      previousProfile,
      profile,
      auditsWritten: isOffboarding,
      identitySyncJobId,
    };
  });
