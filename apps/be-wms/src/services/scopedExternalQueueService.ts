import {
  ExternalScanQueueStatus,
  type ExternalScanQueue,
} from "@bduck/shared-types";
import * as externalScanRepo from "../repositories/externalScanRepository.js";
import { findExternalScansByStatusesAndFacilities } from "../repositories/scopedExternalScanRepository.js";
import {
  authorizationError,
  type AuthorizationService,
} from "./authorization/index.js";

const facilityIdsForAny = (
  authorization: AuthorizationService,
  actions: readonly string[],
): string[] =>
  Array.from(
    new Set(actions.flatMap((action) => authorization.facilityIdsFor(action))),
  ).sort();

const assertAny = (
  authorization: AuthorizationService,
  actions: readonly string[],
  facilityId: string,
): void => {
  if (!actions.some((action) => authorization.can(action, facilityId))) {
    throw authorizationError("AUTHORIZATION_DENIED");
  }
};

const assertSingleFacility = (
  records: readonly ExternalScanQueue[],
): string => {
  if (records.length === 0) throw new Error("BATCH_NOT_FOUND");
  const facilityId = records[0].warehouse_id;
  if (records.some((record) => record.warehouse_id !== facilityId)) {
    throw authorizationError("AUTHORIZATION_DENIED");
  }
  return facilityId;
};

export const findPendingQueueRecords = (
  authorization: AuthorizationService,
): Promise<ExternalScanQueue[]> =>
  findExternalScansByStatusesAndFacilities(
    [
      ExternalScanQueueStatus.QUEUED,
      ExternalScanQueueStatus.SUBMITTED,
      ExternalScanQueueStatus.REVISION_REQUIRED,
      ExternalScanQueueStatus.PENDING_EXPORT_APPROVAL,
    ],
    facilityIdsForAny(authorization, [
      "external_scan.view",
      "external_scan.approve",
      "external_scan.manage_queue",
    ]),
  );

export const findQueueHistoryRecords = (
  authorization: AuthorizationService,
  status?: ExternalScanQueueStatus,
  facilityId?: string,
): Promise<ExternalScanQueue[]> => {
  const actions = ["external_scan.view", "external_scan.approve"];
  const facilityIds = facilityId
    ? (assertAny(authorization, actions, facilityId), [facilityId])
    : facilityIdsForAny(authorization, actions);
  return findExternalScansByStatusesAndFacilities(
    status
      ? [status]
      : [
          ExternalScanQueueStatus.APPROVED,
          ExternalScanQueueStatus.EXPORTED,
          ExternalScanQueueStatus.REJECTED,
        ],
    facilityIds,
  );
};

export const assertBatchAction = async (
  batchId: string,
  action: string,
  authorization: AuthorizationService,
): Promise<string> => {
  const facilityId = assertSingleFacility(
    await externalScanRepo.findByBatchId(batchId),
  );
  authorization.assert(action, facilityId);
  return facilityId;
};

export const assertScanActions = async (
  scanId: string,
  actions: readonly string[],
  authorization: AuthorizationService,
): Promise<string> => {
  const scan = await externalScanRepo.findById(scanId);
  if (!scan || scan.is_deleted) throw new Error("SCAN_NOT_FOUND");
  assertAny(authorization, actions, scan.warehouse_id);
  return scan.warehouse_id;
};

export const assertOptionalFacilityAction = (
  facilityId: string | undefined,
  action: string,
  authorization: AuthorizationService,
): void => {
  if (facilityId) authorization.assert(action, facilityId);
  else if (!authorization.context.isSystemAdmin) {
    throw authorizationError("AUTHORIZATION_DENIED");
  }
};
