import type { NonconformityReport } from "@bduck/shared-types";
import {
  findReportById,
  findReports,
  type NonconformityFilters,
} from "../repositories/nonconformityRepository.js";
import type { AuditMetadata } from "./auditService.js";
import type { AuthorizationService } from "./authorization/index.js";
import {
  fetchNonconformityDetail as fetchLegacyDetail,
  resolveNonconformity as resolveLegacy,
  type ResolveNonconformityInput,
} from "./nonconformityService.js";

const notFoundError = {
  statusCode: 404,
  messages: { vi: "Không tìm thấy báo cáo ngoại lệ.", zh: "未找到异常报告。" },
};

const time = (value: unknown): number => {
  if (value instanceof Date) return value.getTime();
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof value.toDate === "function"
  ) {
    return (value.toDate as () => Date)().getTime();
  }
  return 0;
};

const readFacilityIds = (authorization: AuthorizationService): string[] =>
  Array.from(
    new Set([
      ...authorization.facilityIdsFor("inventory.read"),
      ...authorization.facilityIdsFor("inventory.write"),
    ]),
  ).sort();

const assertRead = (
  authorization: AuthorizationService,
  warehouseId: string,
): void => {
  if (
    !authorization.can("inventory.read", warehouseId) &&
    !authorization.can("inventory.write", warehouseId)
  ) {
    authorization.assert("inventory.read", warehouseId);
  }
};

const legacyPermissions = (warehouseId: string) => ({
  [warehouseId]: { "inventory.read": true, "inventory.write": true },
});

const loadReport = async (id: string): Promise<NonconformityReport> => {
  const report = await findReportById(id);
  if (!report) throw notFoundError;
  return report;
};

export const fetchNonconformities = async (
  filters: NonconformityFilters,
  authorization: AuthorizationService,
): Promise<NonconformityReport[]> => {
  if (filters.warehouse_id) {
    assertRead(authorization, filters.warehouse_id);
    return findReports(filters);
  }
  const groups = await Promise.all(
    readFacilityIds(authorization).map((warehouseId) =>
      findReports({ ...filters, warehouse_id: warehouseId }),
    ),
  );
  return groups
    .flat()
    .sort((left, right) => time(right.created_at) - time(left.created_at));
};

export const fetchNonconformityDetail = async (
  id: string,
  authorization: AuthorizationService,
) => {
  const report = await loadReport(id);
  assertRead(authorization, report.warehouse_id);
  return fetchLegacyDetail(id, legacyPermissions(report.warehouse_id));
};

export const resolveNonconformity = async (
  id: string,
  input: ResolveNonconformityInput,
  userId: string,
  auditMetadata: AuditMetadata | undefined,
  authorization: AuthorizationService,
): Promise<void> => {
  const report = await loadReport(id);
  authorization.assert("inventory.write", report.warehouse_id);
  await resolveLegacy(
    id,
    input,
    userId,
    auditMetadata,
    legacyPermissions(report.warehouse_id),
  );
};
