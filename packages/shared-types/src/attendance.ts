export enum AttendanceLogStatus {
  SUCCESS = "SUCCESS",
  REJECTED = "REJECTED",
}

export enum AttendanceRejectedReason {
  INVALID_IP = "INVALID_IP",
  POLICY_DISABLED = "POLICY_DISABLED",
  NOT_REQUIRED = "NOT_REQUIRED",
  ALREADY_CHECKED_IN = "ALREADY_CHECKED_IN",
  NO_WORKPLACE = "NO_WORKPLACE",
}

export interface WarehouseAttendancePolicy {
  id: string;
  warehouse_id: string;
  enabled: boolean;
  ip_addresses: string[];
  effective_from: Date;
  effective_to: Date | null;
  created_by: string;
  created_at: Date;
}

export interface WarehouseAttendanceExemption {
  id: string;
  warehouse_id: string;
  user_id: string;
  attendance_required: boolean;
  effective_from: Date;
  effective_to: Date | null;
  created_by: string;
  created_at: Date;
}

export interface AttendanceLog {
  id: string;
  user_id: string;
  employee_id: string;
  employee_name: string;
  warehouse_id: string;
  policy_id: string | null;
  attendance_date: string;
  timezone: "Asia/Ho_Chi_Minh";
  check_in_at: Date;
  action_time: Date;
  sync_time: Date;
  ip_address: string | null;
  status: AttendanceLogStatus;
  rejected_reason: AttendanceRejectedReason | null;
}

export interface AttendanceCheckInContext {
  can_access_page: boolean;
  can_check_in: boolean;
  can_view_attendance: boolean;
  can_configure_attendance: boolean;
  can_export_attendance: boolean;
  warehouse_id: string | null;
  policy: WarehouseAttendancePolicy | null;
  today_success_log: AttendanceLog | null;
  messages?: {
    vi: string;
    zh: string;
  };
}
