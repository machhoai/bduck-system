import { EmployeeEmploymentStatus } from "@bduck/shared-types";

export interface LegacyEmployeeProfileRecord {
  id: string;
  employment_status?: EmployeeEmploymentStatus;
  probation_start_date?: string | null;
  probation_end_date?: string | null;
  official_start_date?: string | null;
  resignation_date?: string | null;
  [key: string]: unknown;
}

export interface EmployeeEmploymentBackfillPlanItem {
  id: string;
  patch: {
    employment_status?: EmployeeEmploymentStatus.UNSPECIFIED;
    probation_start_date?: null;
    probation_end_date?: null;
    official_start_date?: null;
    resignation_date?: null;
  };
}

export const planEmployeeEmploymentStatusBackfill = (
  records: readonly LegacyEmployeeProfileRecord[],
): EmployeeEmploymentBackfillPlanItem[] =>
  records
    .map((record) => {
      const patch: EmployeeEmploymentBackfillPlanItem["patch"] = {};
      if (record.employment_status === undefined) {
        patch.employment_status = EmployeeEmploymentStatus.UNSPECIFIED;
      }
      if (record.probation_start_date === undefined) {
        patch.probation_start_date = null;
      }
      if (record.probation_end_date === undefined) {
        patch.probation_end_date = null;
      }
      if (record.official_start_date === undefined) {
        patch.official_start_date = null;
      }
      if (record.resignation_date === undefined) {
        patch.resignation_date = null;
      }
      return { id: record.id, patch };
    })
    .filter((item) => Object.keys(item.patch).length > 0);
