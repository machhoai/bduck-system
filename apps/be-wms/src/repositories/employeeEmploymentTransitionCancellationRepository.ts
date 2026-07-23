import {
  EmployeeEmploymentTransitionStatus,
  type EmployeeEmploymentTransition,
} from "@bduck/shared-types";
import { db } from "../config/firebase.js";

const TRANSITIONS_COLLECTION = "employee_employment_transitions";
const TRANSITION_LOCKS_COLLECTION = "employee_employment_transition_locks";

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

export const cancelScheduledEmployeeEmploymentTransition = async (
  transitionId: string,
  actorId: string,
  reason: string,
): Promise<{
  previous: EmployeeEmploymentTransition;
  transition: EmployeeEmploymentTransition;
}> =>
  db.runTransaction(async (transaction) => {
    const transitionRef = db
      .collection(TRANSITIONS_COLLECTION)
      .doc(transitionId);
    const snapshot = await transaction.get(transitionRef);
    if (!snapshot.exists) {
      throw transitionError(
        "Lệnh chuyển trạng thái không tồn tại.",
        "状态转换记录不存在。",
        404,
      );
    }
    const previous = withId(snapshot);
    if (
      previous.is_deleted ||
      previous.status !== EmployeeEmploymentTransitionStatus.SCHEDULED
    ) {
      throw transitionError(
        "Chỉ có thể hủy lệnh đang chờ hiệu lực.",
        "只能取消待生效的状态转换。",
      );
    }
    const lockRef = db
      .collection(TRANSITION_LOCKS_COLLECTION)
      .doc(previous.employee_profile_id);
    const lockSnapshot = await transaction.get(lockRef);
    const now = new Date();
    const transition: EmployeeEmploymentTransition = {
      ...previous,
      status: EmployeeEmploymentTransitionStatus.CANCELLED,
      cancelled_by: actorId,
      cancelled_at: now,
      cancellation_reason: reason,
      updated_at: now,
      sync_time: now,
    };
    transaction.update(transitionRef, {
      status: transition.status,
      cancelled_by: actorId,
      cancelled_at: now,
      cancellation_reason: reason,
      updated_at: now,
      sync_time: now,
    });
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
    return { previous, transition };
  });
