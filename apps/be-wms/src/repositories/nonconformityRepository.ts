import { db } from "../config/firebase.js";
import type {
  NonconformityReport,
  QuarantineRecord,
} from "@bduck/shared-types";

const REPORTS = "nonconformity_reports";
const QUARANTINES = "quarantine_records";

export interface NonconformityFilters {
  warehouse_id?: string;
  warehouse_location_id?: string;
  product_id?: string;
  source_type?: string;
  issue_type?: string;
  status?: string;
}

export const findReports = async (
  filters: NonconformityFilters,
): Promise<NonconformityReport[]> => {
  let query: FirebaseFirestore.Query = db.collection(REPORTS);

  if (filters.warehouse_id) {
    query = query.where("warehouse_id", "==", filters.warehouse_id);
  }
  if (filters.warehouse_location_id) {
    query = query.where(
      "warehouse_location_id",
      "==",
      filters.warehouse_location_id,
    );
  }
  if (filters.product_id) {
    query = query.where("product_id", "==", filters.product_id);
  }
  if (filters.source_type) {
    query = query.where("source_type", "==", filters.source_type);
  }
  if (filters.issue_type) {
    query = query.where("issue_type", "==", filters.issue_type);
  }
  if (filters.status) {
    query = query.where("status", "==", filters.status);
  }

  const snapshot = await query.get();
  return snapshot.docs
    .map((doc) => doc.data() as NonconformityReport)
    .filter((record) => record.is_deleted !== true);
};

export const findReportById = async (
  id: string,
): Promise<NonconformityReport | null> => {
  const snapshot = await db.collection(REPORTS).doc(id).get();
  if (!snapshot.exists) return null;

  const record = snapshot.data() as NonconformityReport;
  return record.is_deleted ? null : record;
};

export const findQuarantinesByReportId = async (
  reportId: string,
): Promise<QuarantineRecord[]> => {
  const snapshot = await db
    .collection(QUARANTINES)
    .where("nonconformity_report_id", "==", reportId)
    .where("is_deleted", "==", false)
    .get();

  return snapshot.docs.map((doc) => doc.data() as QuarantineRecord);
};

export const reportsCollection = () => db.collection(REPORTS);
export const quarantinesCollection = () => db.collection(QUARANTINES);
