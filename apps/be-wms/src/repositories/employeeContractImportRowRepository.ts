import {
  EmployeeContractImportRowStatus,
  type LocalizedText,
} from "@bduck/shared-types";

import { db } from "../config/firebase.js";

import {
  EMPLOYEE_CONTRACT_IMPORT_ROWS_COLLECTION,
  mapEmployeeContractImportRow,
} from "./employeeContractImportRepository.js";

export const markEmployeeContractImportRowFailed = async (
  rowId: string,
  actorId: string,
  actionTime: Date,
  errorCode: string,
  failureMessage: LocalizedText,
) => {
  const ref = db
    .collection(EMPLOYEE_CONTRACT_IMPORT_ROWS_COLLECTION)
    .doc(rowId);
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) return;
    const current = mapEmployeeContractImportRow(snapshot);
    const now = new Date();
    transaction.update(ref, {
      status: EmployeeContractImportRowStatus.FAILED,
      error_code: errorCode,
      validation_messages: [...current.validation_messages, failureMessage],
      updated_at: now,
      action_time: actionTime,
      sync_time: now,
      updated_by: actorId,
    });
  });
};
