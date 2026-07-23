import {
  EmployeeEmploymentStatus,
  EmployeeProfileStatus,
  UserStatus,
} from "@bduck/shared-types";

export interface EmployeeProfileFormState {
  user_id: string;
  employee_code: string;
  full_name: string;
  email: string;
  phone: string;
  job_title: string;
  department: string;
  workplace_warehouse_id: string;
  status: EmployeeProfileStatus;
  employment_status: EmployeeEmploymentStatus;
  probation_start_date: string;
  probation_end_date: string;
  official_start_date: string;
  resignation_date: string;
  notes: string;
}

export interface EmployeeAccountFormState {
  email: string;
  status: UserStatus;
}

export const emptyProfileForm = (
  workplaceId = "",
): EmployeeProfileFormState => ({
  user_id: "",
  employee_code: "",
  full_name: "",
  email: "",
  phone: "",
  job_title: "",
  department: "",
  workplace_warehouse_id: workplaceId,
  status: EmployeeProfileStatus.ACTIVE,
  employment_status: EmployeeEmploymentStatus.UNSPECIFIED,
  probation_start_date: "",
  probation_end_date: "",
  official_start_date: "",
  resignation_date: "",
  notes: "",
});

export const emptyAccountForm = (): EmployeeAccountFormState => ({
  email: "",
  status: UserStatus.ACTIVE,
});

export function profileStatusLabel(
  status: EmployeeProfileStatus,
  labels?: Record<string, string>,
) {
  if (labels && labels[status]) {
    return labels[status];
  }
  if (status === EmployeeProfileStatus.ACTIVE) return "Đang làm việc";
  if (status === EmployeeProfileStatus.ON_LEAVE) return "Tạm nghỉ";
  return "Ngừng làm việc";
}

export function employmentStatusLabel(
  status: EmployeeEmploymentStatus,
  labels: Record<string, string>,
) {
  return labels[status] || status;
}
