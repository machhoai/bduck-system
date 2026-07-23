import type { EmployeeProfile } from "@bduck/shared-types";

type EmployeeProfileInput = Partial<
  Pick<
    EmployeeProfile,
    | "user_id"
    | "employee_code"
    | "full_name"
    | "email"
    | "phone"
    | "job_title"
    | "department"
    | "workplace_warehouse_id"
    | "status"
    | "employment_status"
    | "probation_start_date"
    | "probation_end_date"
    | "official_start_date"
    | "resignation_date"
    | "notes"
  >
>;

const cleanNullable = (value: string | null | undefined) =>
  value?.trim() ? value.trim() : null;

export const buildEmployeeProfilePayload = (
  input: EmployeeProfileInput,
): EmployeeProfileInput => {
  const payload: EmployeeProfileInput = {};
  if ("user_id" in input) payload.user_id = input.user_id ?? null;
  if ("employee_code" in input) payload.employee_code = input.employee_code;
  if ("full_name" in input) payload.full_name = input.full_name;
  if ("email" in input) payload.email = cleanNullable(input.email);
  if ("phone" in input) payload.phone = cleanNullable(input.phone);
  if ("job_title" in input) payload.job_title = cleanNullable(input.job_title);
  if ("department" in input)
    payload.department = cleanNullable(input.department);
  if ("workplace_warehouse_id" in input) {
    payload.workplace_warehouse_id = input.workplace_warehouse_id;
  }
  if ("status" in input) payload.status = input.status;
  if ("employment_status" in input) {
    payload.employment_status = input.employment_status;
  }
  if ("probation_start_date" in input) {
    payload.probation_start_date = input.probation_start_date ?? null;
  }
  if ("probation_end_date" in input) {
    payload.probation_end_date = input.probation_end_date ?? null;
  }
  if ("official_start_date" in input) {
    payload.official_start_date = input.official_start_date ?? null;
  }
  if ("resignation_date" in input) {
    payload.resignation_date = input.resignation_date ?? null;
  }
  if ("notes" in input) payload.notes = cleanNullable(input.notes);
  return payload;
};
