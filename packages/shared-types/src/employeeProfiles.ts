export enum EmployeeProfileStatus {
  ACTIVE = "ACTIVE",
  INACTIVE = "INACTIVE",
  ON_LEAVE = "ON_LEAVE",
}

export interface EmployeeProfile {
  id: string;
  user_id: string | null;
  employee_code: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  job_title: string | null;
  department: string | null;
  workplace_warehouse_id: string;
  status: EmployeeProfileStatus;
  notes: string | null;
  is_deleted: boolean;
  created_at: Date;
  updated_at: Date;
}
