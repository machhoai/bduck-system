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
  LOCATION_REQUIRED = "LOCATION_REQUIRED",
  GPS_ACCURACY_LOW = "GPS_ACCURACY_LOW",
  GPS_STALE = "GPS_STALE",
  OUTSIDE_GEOFENCE = "OUTSIDE_GEOFENCE",
  REMOTE_ARRANGEMENT_REQUIRED = "REMOTE_ARRANGEMENT_REQUIRED",
  WORKPLACE_COORDINATE_MISSING = "WORKPLACE_COORDINATE_MISSING",
}

export enum AttendanceVerificationStrategy {
  IP_ONLY = "IP_ONLY",
  GPS_ONLY = "GPS_ONLY",
  IP_OR_GPS = "IP_OR_GPS",
  IP_AND_GPS = "IP_AND_GPS",
}

export enum AttendanceCheckInMethod {
  IP = "IP",
  GPS = "GPS",
  IP_GPS = "IP_GPS",
}

export enum AttendanceWorkMode {
  ONSITE = "ONSITE",
  BUSINESS_TRIP = "BUSINESS_TRIP",
  WORK_FROM_HOME = "WORK_FROM_HOME",
}

export enum AttendanceWorkArrangementType {
  BUSINESS_TRIP = "BUSINESS_TRIP",
  WORK_FROM_HOME = "WORK_FROM_HOME",
}

export enum AttendanceWorkArrangementStatus {
  APPROVED = "APPROVED",
  CANCELLED = "CANCELLED",
}

export enum AttendanceLocationRule {
  CAPTURE_ONLY = "CAPTURE_ONLY",
  GEOFENCE = "GEOFENCE",
}

export interface AttendanceCoordinate {
  latitude: number;
  longitude: number;
}

export interface AttendanceLocationInput extends AttendanceCoordinate {
  accuracy_m: number;
  captured_at: string;
}

export enum AttendanceLateReportStatus {
  SUBMITTED = "SUBMITTED",
  ACKNOWLEDGED = "ACKNOWLEDGED",
  REJECTED = "REJECTED",
}

export interface WarehouseAttendancePolicy {
  id: string;
  warehouse_id: string;
  enabled: boolean;
  ip_addresses: string[];
  verification_strategy: AttendanceVerificationStrategy;
  gps_radius_m: number;
  gps_max_accuracy_m: number;
  gps_max_age_seconds: number;
  allow_business_trip: boolean;
  allow_work_from_home: boolean;
  effective_from: Date;
  effective_to: Date | null;
  created_by: string;
  created_at: Date;
}

export interface AttendanceWorkArrangement {
  id: string;
  warehouse_id: string;
  user_id: string;
  employee_profile_id: string;
  employee_id: string;
  employee_name: string;
  type: AttendanceWorkArrangementType;
  start_date: string;
  end_date: string;
  location_rule: AttendanceLocationRule;
  destination_name: string | null;
  destination_coordinate: AttendanceCoordinate | null;
  radius_m: number | null;
  reason: string;
  source_leave_request_id?: string | null;
  status: AttendanceWorkArrangementStatus;
  requested_by: string;
  approved_by: string;
  approved_at: Date;
  cancelled_by: string | null;
  cancelled_at: Date | null;
  created_at: Date;
  updated_at: Date;
  is_deleted: boolean;
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
  employee_profile_id: string | null;
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
  check_in_method: AttendanceCheckInMethod | null;
  work_mode: AttendanceWorkMode | null;
  location: AttendanceLocationInput | null;
  distance_from_target_m: number | null;
  work_arrangement_id: string | null;
  status: AttendanceLogStatus;
  rejected_reason: AttendanceRejectedReason | null;
}

export interface AttendanceLateReport {
  id: string;
  user_id: string;
  employee_profile_id: string | null;
  employee_id: string;
  employee_name: string;
  warehouse_id: string;
  attendance_date: string;
  timezone: "Asia/Ho_Chi_Minh";
  expected_arrival_time: string | null;
  estimated_arrival_time: string | null;
  reason: string;
  attendance_log_id: string | null;
  status: AttendanceLateReportStatus;
  action_time: Date;
  sync_time: Date;
  created_at: Date;
  updated_at: Date;
  created_by: string;
  reviewed_by: string | null;
  reviewed_at: Date | null;
  review_notes: string | null;
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
  current_ip_address: string | null;
  is_company_network: boolean | null;
  verification_strategy: AttendanceVerificationStrategy;
  location_required: boolean;
  active_work_arrangement: AttendanceWorkArrangement | null;
  messages?: {
    vi: string;
    zh: string;
  };
}
