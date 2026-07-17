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
  if ("notes" in input) payload.notes = cleanNullable(input.notes);
  return payload;
};
