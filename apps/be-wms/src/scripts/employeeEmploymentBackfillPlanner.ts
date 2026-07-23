import { EmployeeEmploymentStatus } from "@bduck/shared-types";

export interface LegacyEmployeeProfileRecord {
  id: string;
  employment_status?: EmployeeEmploymentStatus;
  [key: string]: unknown;
}

export interface EmployeeEmploymentBackfillPlanItem {
  id: string;
  employment_status: EmployeeEmploymentStatus.UNSPECIFIED;
}

export const planEmployeeEmploymentStatusBackfill = (
  records: readonly LegacyEmployeeProfileRecord[],
): EmployeeEmploymentBackfillPlanItem[] =>
  records
    .filter((record) => record.employment_status === undefined)
    .map((record) => ({
      id: record.id,
      employment_status: EmployeeEmploymentStatus.UNSPECIFIED,
    }));
