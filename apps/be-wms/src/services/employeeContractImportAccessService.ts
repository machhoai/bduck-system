import type {
  EmployeeContractImportBatch,
  EmployeeContractImportRow,
  EmployeeContractImportRowView,
  EmployeeProfile,
} from "@bduck/shared-types";

import type { AuthorizationService } from "./authorization/index.js";

export const EMPLOYEE_CONTRACT_IMPORT_PERMISSION =
  "employees.contracts.history.import";

export const assertCanImportEmployeeContracts = (
  authorization: AuthorizationService,
) => {
  if (
    !authorization.context.isSystemAdmin &&
    authorization.facilityIdsFor(EMPLOYEE_CONTRACT_IMPORT_PERMISSION).length ===
      0
  ) {
    throw {
      code: "CONTRACT_IMPORT_FORBIDDEN",
      statusCode: 403,
      messages: {
        vi: "Bạn không có quyền import lịch sử hợp đồng.",
        zh: "您没有导入合同历史的权限。",
      },
    };
  }
};

export const canImportContractsForProfile = (
  authorization: AuthorizationService,
  profile: EmployeeProfile,
): boolean =>
  authorization.context.isSystemAdmin ||
  authorization.can(
    EMPLOYEE_CONTRACT_IMPORT_PERMISSION,
    profile.workplace_warehouse_id,
  );

export const assertEmployeeContractImportBatchAccess = (
  batch: EmployeeContractImportBatch,
  actorId: string,
  authorization: AuthorizationService,
) => {
  assertCanImportEmployeeContracts(authorization);
  const allowed =
    authorization.context.isSystemAdmin ||
    (batch.workplace_warehouse_ids.length > 0 &&
      batch.workplace_warehouse_ids.every((facilityId) =>
        authorization.can(EMPLOYEE_CONTRACT_IMPORT_PERMISSION, facilityId),
      )) ||
    (batch.workplace_warehouse_ids.length === 0 &&
      batch.created_by === actorId);
  if (!allowed) {
    throw {
      code: "CONTRACT_IMPORT_FORBIDDEN",
      statusCode: 403,
      messages: {
        vi: "Bạn không có quyền truy cập batch import này.",
        zh: "您无权访问此导入批次。",
      },
    };
  }
};

export const buildEmployeeContractImportRowViews = (
  rows: EmployeeContractImportRow[],
  profiles: Map<string, EmployeeProfile>,
): EmployeeContractImportRowView[] =>
  rows.map((row) => ({
    ...row,
    employee_name:
      profiles.get(row.employee_code.normalize("NFKC").toUpperCase())
        ?.full_name ?? null,
    is_valid: row.status !== "INVALID" && row.status !== "FAILED",
  }));
