import type { EmployeeContractImportBatchView } from "@bduck/shared-types";

import {
  findEmployeeContractImportBatch,
  findEmployeeContractImportRows,
} from "../repositories/employeeContractImportRepository.js";
import { findEmployeeProfiles } from "../repositories/employeeProfileRepository.js";
import {
  assertEmployeeContractImportBatchAccess,
  buildEmployeeContractImportRowViews,
} from "./employeeContractImportAccessService.js";
import type { AuthorizationService } from "./authorization/index.js";

export const getEmployeeContractImport = async (
  batchId: string,
  actorId: string,
  authorization: AuthorizationService,
): Promise<EmployeeContractImportBatchView> => {
  const batch = await findEmployeeContractImportBatch(batchId);
  if (!batch) {
    throw {
      statusCode: 404,
      messages: { vi: "Không tìm thấy batch import.", zh: "找不到导入批次。" },
    };
  }
  assertEmployeeContractImportBatchAccess(batch, actorId, authorization);
  const [rows, profiles] = await Promise.all([
    findEmployeeContractImportRows(batchId),
    findEmployeeProfiles(),
  ]);
  return {
    batch,
    rows: buildEmployeeContractImportRowViews(
      rows,
      new Map(
        profiles.map((profile) => [
          profile.employee_code.normalize("NFKC").toUpperCase(),
          profile,
        ]),
      ),
    ),
  };
};
