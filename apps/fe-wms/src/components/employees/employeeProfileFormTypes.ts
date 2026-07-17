import {
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
  notes: "",
});

export const emptyAccountForm = (): EmployeeAccountFormState => ({
  email: "",
  status: UserStatus.ACTIVE,
});

export function profileStatusLabel(status: EmployeeProfileStatus) {
  if (status === EmployeeProfileStatus.ACTIVE) return "Đang làm việc";
  if (status === EmployeeProfileStatus.ON_LEAVE) return "Tạm nghỉ";
  return "Ngừng làm việc";
}
