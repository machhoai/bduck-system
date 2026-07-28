import type {
  AttendanceLateReport,
  AttendanceLog,
  AttendanceWorkArrangement,
  WarehouseAttendanceExemption,
  WarehouseAttendancePolicy,
} from "@bduck/shared-types";
import {
  AttendanceLogStatus,
  AttendanceVerificationStrategy,
  AttendanceWorkArrangementStatus,
} from "@bduck/shared-types";
import { randomUUID } from "crypto";
import { db } from "../config/firebase.js";

const POLICIES_COLLECTION = "warehouse_attendance_policies";
const EXEMPTIONS_COLLECTION = "warehouse_attendance_exemptions";
const LOGS_COLLECTION = "attendance_logs";
const LATE_REPORTS_COLLECTION = "attendance_late_reports";
const WORK_ARRANGEMENTS_COLLECTION = "attendance_work_arrangements";

const normalizePolicy = (
  policy: WarehouseAttendancePolicy,
): WarehouseAttendancePolicy => ({
  ...policy,
  verification_strategy:
    policy.verification_strategy || AttendanceVerificationStrategy.IP_ONLY,
  gps_radius_m: policy.gps_radius_m || 150,
  gps_max_accuracy_m: policy.gps_max_accuracy_m || 100,
  gps_max_age_seconds: policy.gps_max_age_seconds || 120,
  allow_business_trip: policy.allow_business_trip ?? false,
  allow_work_from_home: policy.allow_work_from_home ?? false,
});

export const getActiveAttendancePolicy = async (
  warehouseId: string,
): Promise<WarehouseAttendancePolicy | null> => {
  const snapshot = await db
    .collection(POLICIES_COLLECTION)
    .where("warehouse_id", "==", warehouseId)
    .where("effective_to", "==", null)
    .limit(1)
    .get();

  if (snapshot.empty) return null;
  return normalizePolicy(
    snapshot.docs[0].data() as WarehouseAttendancePolicy,
  );
};

export const listActiveAttendancePolicies = async (
  warehouseIds?: string[],
): Promise<WarehouseAttendancePolicy[]> => {
  if (warehouseIds && warehouseIds.length === 0) return [];
  if (!warehouseIds) {
    const snapshot = await db
      .collection(POLICIES_COLLECTION)
      .where("effective_to", "==", null)
      .get();
    return snapshot.docs.map((doc) =>
      normalizePolicy(doc.data() as WarehouseAttendancePolicy),
    );
  }

  const policies: WarehouseAttendancePolicy[] = [];
  const uniqueIds = Array.from(new Set(warehouseIds));
  for (let index = 0; index < uniqueIds.length; index += 30) {
    const snapshot = await db
      .collection(POLICIES_COLLECTION)
      .where("warehouse_id", "in", uniqueIds.slice(index, index + 30))
      .where("effective_to", "==", null)
      .get();
    policies.push(
      ...snapshot.docs.map((doc) =>
        normalizePolicy(doc.data() as WarehouseAttendancePolicy),
      ),
    );
  }
  return policies;
};

export const replaceActiveAttendancePolicy = async (
  warehouseId: string,
  input: {
    enabled: boolean;
    ip_addresses: string[];
    verification_strategy: AttendanceVerificationStrategy;
    gps_radius_m: number;
    gps_max_accuracy_m: number;
    gps_max_age_seconds: number;
    allow_business_trip: boolean;
    allow_work_from_home: boolean;
    actorId: string;
  },
): Promise<WarehouseAttendancePolicy> => {
  const now = new Date();
  const policy: WarehouseAttendancePolicy = {
    id: randomUUID(),
    warehouse_id: warehouseId,
    enabled: input.enabled,
    ip_addresses: input.ip_addresses,
    verification_strategy: input.verification_strategy,
    gps_radius_m: input.gps_radius_m,
    gps_max_accuracy_m: input.gps_max_accuracy_m,
    gps_max_age_seconds: input.gps_max_age_seconds,
    allow_business_trip: input.allow_business_trip,
    allow_work_from_home: input.allow_work_from_home,
    effective_from: now,
    effective_to: null,
    created_by: input.actorId,
    created_at: now,
  };

  await db.runTransaction(async (transaction) => {
    const activeSnapshot = await transaction.get(
      db
        .collection(POLICIES_COLLECTION)
        .where("warehouse_id", "==", warehouseId)
        .where("effective_to", "==", null),
    );

    activeSnapshot.docs.forEach((doc) => {
      transaction.update(doc.ref, { effective_to: now });
    });

    transaction.set(db.collection(POLICIES_COLLECTION).doc(policy.id), policy);
  });

  return policy;
};

export const getActiveAttendanceWorkArrangement = async (
  userId: string,
  warehouseId: string,
  attendanceDate: string,
): Promise<AttendanceWorkArrangement | null> => {
  const snapshot = await db
    .collection(WORK_ARRANGEMENTS_COLLECTION)
    .where("user_id", "==", userId)
    .where("warehouse_id", "==", warehouseId)
    .where("status", "==", AttendanceWorkArrangementStatus.APPROVED)
    .get();
  const active = snapshot.docs
    .map((doc) => doc.data() as AttendanceWorkArrangement)
    .filter(
      (item) =>
        !item.is_deleted &&
        item.start_date <= attendanceDate &&
        item.end_date >= attendanceDate,
    )
    .sort((a, b) => b.start_date.localeCompare(a.start_date));
  return active[0] || null;
};

export const listAttendanceWorkArrangements = async (
  warehouseId: string,
): Promise<AttendanceWorkArrangement[]> => {
  const snapshot = await db
    .collection(WORK_ARRANGEMENTS_COLLECTION)
    .where("warehouse_id", "==", warehouseId)
    .get();
  return snapshot.docs
    .map((doc) => doc.data() as AttendanceWorkArrangement)
    .filter((item) => !item.is_deleted)
    .sort((a, b) => b.start_date.localeCompare(a.start_date));
};

export const createAttendanceWorkArrangement = async (
  input: Omit<AttendanceWorkArrangement, "id">,
): Promise<AttendanceWorkArrangement> => {
  const arrangement = { ...input, id: randomUUID() };
  await db
    .collection(WORK_ARRANGEMENTS_COLLECTION)
    .doc(arrangement.id)
    .set(arrangement);
  return arrangement;
};

export const cancelAttendanceWorkArrangement = async (
  arrangementId: string,
  actorId: string,
): Promise<AttendanceWorkArrangement | null> => {
  const ref = db.collection(WORK_ARRANGEMENTS_COLLECTION).doc(arrangementId);
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) return null;
    const current = snapshot.data() as AttendanceWorkArrangement;
    const now = new Date();
    const updated: AttendanceWorkArrangement = {
      ...current,
      status: AttendanceWorkArrangementStatus.CANCELLED,
      cancelled_by: actorId,
      cancelled_at: now,
      updated_at: now,
      is_deleted: true,
    };
    transaction.update(ref, {
      status: updated.status,
      cancelled_by: actorId,
      cancelled_at: now,
      updated_at: now,
      is_deleted: true,
    });
    return updated;
  });
};

export const listActiveAttendanceExemptions = async (
  warehouseId: string,
): Promise<WarehouseAttendanceExemption[]> => {
  const snapshot = await db
    .collection(EXEMPTIONS_COLLECTION)
    .where("warehouse_id", "==", warehouseId)
    .where("effective_to", "==", null)
    .get();

  return snapshot.docs.map((doc) => doc.data() as WarehouseAttendanceExemption);
};

export const replaceAttendanceExemptions = async (
  warehouseId: string,
  excludedUserIds: string[],
  actorId: string,
): Promise<WarehouseAttendanceExemption[]> => {
  const now = new Date();
  const uniqueUserIds = Array.from(new Set(excludedUserIds.filter(Boolean)));
  const nextExemptions = uniqueUserIds.map<WarehouseAttendanceExemption>(
    (userId) => ({
      id: randomUUID(),
      warehouse_id: warehouseId,
      user_id: userId,
      attendance_required: false,
      effective_from: now,
      effective_to: null,
      created_by: actorId,
      created_at: now,
    }),
  );

  await db.runTransaction(async (transaction) => {
    const activeSnapshot = await transaction.get(
      db
        .collection(EXEMPTIONS_COLLECTION)
        .where("warehouse_id", "==", warehouseId)
        .where("effective_to", "==", null),
    );

    activeSnapshot.docs.forEach((doc) => {
      transaction.update(doc.ref, { effective_to: now });
    });

    nextExemptions.forEach((exemption) => {
      transaction.set(
        db.collection(EXEMPTIONS_COLLECTION).doc(exemption.id),
        exemption,
      );
    });
  });

  return nextExemptions;
};

export const getTodaySuccessAttendanceLog = async (
  userId: string,
  attendanceDate: string,
): Promise<AttendanceLog | null> => {
  const snapshot = await db
    .collection(LOGS_COLLECTION)
    .where("user_id", "==", userId)
    .where("attendance_date", "==", attendanceDate)
    .where("status", "==", AttendanceLogStatus.SUCCESS)
    .limit(1)
    .get();

  if (snapshot.empty) return null;
  return snapshot.docs[0].data() as AttendanceLog;
};

export const createAttendanceLog = async (
  log: Omit<AttendanceLog, "id">,
): Promise<AttendanceLog> => {
  const attendanceLog = { ...log, id: randomUUID() };
  await db.collection(LOGS_COLLECTION).doc(attendanceLog.id).set(attendanceLog);
  return attendanceLog;
};

export const createAttendanceLateReport = async (
  report: Omit<AttendanceLateReport, "id">,
): Promise<AttendanceLateReport> => {
  const lateReport = { ...report, id: randomUUID() };
  await db
    .collection(LATE_REPORTS_COLLECTION)
    .doc(lateReport.id)
    .set(lateReport);
  return lateReport;
};

export const createSuccessAttendanceLogOnce = async (
  log: Omit<AttendanceLog, "id">,
): Promise<{ log: AttendanceLog; existing: AttendanceLog | null }> => {
  const attendanceLog = { ...log, id: randomUUID() };

  return db.runTransaction(async (transaction) => {
    const existingSnapshot = await transaction.get(
      db
        .collection(LOGS_COLLECTION)
        .where("user_id", "==", log.user_id)
        .where("attendance_date", "==", log.attendance_date)
        .where("status", "==", "SUCCESS")
        .limit(1),
    );

    if (!existingSnapshot.empty) {
      return {
        log: existingSnapshot.docs[0].data() as AttendanceLog,
        existing: existingSnapshot.docs[0].data() as AttendanceLog,
      };
    }

    transaction.set(
      db.collection(LOGS_COLLECTION).doc(attendanceLog.id),
      attendanceLog,
    );
    return { log: attendanceLog, existing: null };
  });
};
