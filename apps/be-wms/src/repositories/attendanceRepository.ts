import type {
  AttendanceLateReport,
  AttendanceLog,
  WarehouseAttendanceExemption,
  WarehouseAttendancePolicy,
} from "@bduck/shared-types";
import { AttendanceLogStatus } from "@bduck/shared-types";
import { randomUUID } from "crypto";
import { db } from "../config/firebase.js";

const POLICIES_COLLECTION = "warehouse_attendance_policies";
const EXEMPTIONS_COLLECTION = "warehouse_attendance_exemptions";
const LOGS_COLLECTION = "attendance_logs";
const LATE_REPORTS_COLLECTION = "attendance_late_reports";

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
  return snapshot.docs[0].data() as WarehouseAttendancePolicy;
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
    return snapshot.docs.map((doc) => doc.data() as WarehouseAttendancePolicy);
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
      ...snapshot.docs.map((doc) => doc.data() as WarehouseAttendancePolicy),
    );
  }
  return policies;
};

export const replaceActiveAttendancePolicy = async (
  warehouseId: string,
  input: { enabled: boolean; ip_addresses: string[]; actorId: string },
): Promise<WarehouseAttendancePolicy> => {
  const now = new Date();
  const policy: WarehouseAttendancePolicy = {
    id: randomUUID(),
    warehouse_id: warehouseId,
    enabled: input.enabled,
    ip_addresses: input.ip_addresses,
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
