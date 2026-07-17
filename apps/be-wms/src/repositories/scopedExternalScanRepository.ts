import {
  type ExternalScanQueue,
  ExternalScanQueueStatus,
} from "@bduck/shared-types";
import { db } from "../config/firebase.js";

const COLLECTION = "external_scan_queue";

export const findExternalScansByStatusesAndFacilities = async (
  statuses: readonly ExternalScanQueueStatus[],
  facilityIds: readonly string[],
): Promise<ExternalScanQueue[]> => {
  const ids = Array.from(new Set(facilityIds));
  if (ids.length === 0 || statuses.length === 0) return [];
  const records = new Map<string, ExternalScanQueue>();
  for (const status of statuses) {
    for (let index = 0; index < ids.length; index += 10) {
      const snapshot = await db
        .collection(COLLECTION)
        .where("status", "==", status)
        .where("warehouse_id", "in", ids.slice(index, index + 10))
        .get();
      snapshot.docs.forEach((document) => {
        const record = document.data() as ExternalScanQueue;
        if (record.is_deleted === false) records.set(document.id, record);
      });
    }
  }
  return Array.from(records.values());
};
