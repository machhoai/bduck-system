import type {
  ISOTimestamped,
  LocalDate,
  LocalizedText,
  SoftDeletable,
} from "./utility.js";

export const LEAVE_TIMEZONE = "Asia/Ho_Chi_Minh" as const;
export const LEAVE_ACCRUAL_DAY_OF_MONTH = 15 as const;
export const LEAVE_CARRYOVER_EXPIRY_MONTH = 3 as const;
export const LEAVE_CARRYOVER_EXPIRY_DAY = 31 as const;
export const LEAVE_MAX_APPROVAL_LEVELS = 3 as const;
export const LEAVE_MAX_CALENDAR_GAP_DAYS = 2 as const;
export const LEAVE_MAX_GAP_OCCURRENCES = 1 as const;

export enum LeaveRequestType {
  PAID_ANNUAL = "PAID_ANNUAL",
  UNPAID = "UNPAID",
  SICK = "SICK",
  MATERNITY = "MATERNITY",
}

export enum LeaveDayPortion {
  FULL_DAY = "FULL_DAY",
  MORNING = "MORNING",
  AFTERNOON = "AFTERNOON",
}

export enum LeaveRequestStatus {
  DRAFT = "DRAFT",
  PENDING_APPROVAL = "PENDING_APPROVAL",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
  CANCELLED = "CANCELLED",
  APPROVER_UNAVAILABLE = "APPROVER_UNAVAILABLE",
}

export enum LeaveLedgerEntryType {
  MONTHLY_ACCRUAL = "MONTHLY_ACCRUAL",
  PROBATION_ACCRUAL = "PROBATION_ACCRUAL",
  PROBATION_RELEASE = "PROBATION_RELEASE",
  REQUEST_HOLD = "REQUEST_HOLD",
  REQUEST_APPROVED = "REQUEST_APPROVED",
  REQUEST_RELEASED = "REQUEST_RELEASED",
  YEAR_END_EXPIRED = "YEAR_END_EXPIRED",
  HISTORICAL_IMPORT = "HISTORICAL_IMPORT",
  MANUAL_ADJUSTMENT = "MANUAL_ADJUSTMENT",
}

export enum LeaveImportBatchStatus {
  PREVIEWED = "PREVIEWED",
  COMMITTING = "COMMITTING",
  COMMITTED = "COMMITTED",
  FAILED = "FAILED",
  CANCELLED = "CANCELLED",
}

export enum LeaveImportRecordType {
  HISTORICAL_REQUEST = "HISTORICAL_REQUEST",
  ACCRUAL = "ACCRUAL",
  USED = "USED",
  ADJUSTMENT = "ADJUSTMENT",
  EXPIRED = "EXPIRED",
}

export type LeaveApprovalAssignment =
  | {
      mode: "ROLE";
      role_id: string;
      assigned_user_id: null;
    }
  | {
      mode: "USER";
      role_id: null;
      assigned_user_id: string;
    };

export interface LeaveApprovalLevel {
  /** Stable configured position. Active positions run in ascending order. */
  level: 1 | 2 | 3;
  enabled: boolean;
  label: LocalizedText;
  assignment: LeaveApprovalAssignment;
}

export interface LeaveApprovalConfig extends SoftDeletable, ISOTimestamped {
  id: string;
  scope: "COMPANY";
  levels: LeaveApprovalLevel[];
  created_by: string;
  updated_by: string;
}

export interface LeavePolicy extends SoftDeletable, ISOTimestamped {
  id: string;
  scope: "COMPANY";
  timezone: typeof LEAVE_TIMEZONE;
  accrual_day_of_month: typeof LEAVE_ACCRUAL_DAY_OF_MONTH;
  monthly_accrual_units: number;
  annual_cap_units: number;
  carryover_expiry_month: typeof LEAVE_CARRYOVER_EXPIRY_MONTH;
  carryover_expiry_day: typeof LEAVE_CARRYOVER_EXPIRY_DAY;
  probation_accrual_locked: true;
  created_by: string;
  updated_by: string;
}

export interface CompanyHoliday extends SoftDeletable, ISOTimestamped {
  id: string;
  holiday_date: LocalDate;
  name: LocalizedText;
  created_by: string;
  updated_by: string;
}

export interface LeaveRequestDaySelection {
  date: LocalDate;
  portion: LeaveDayPortion;
}

export interface LeaveRequestDay extends LeaveRequestDaySelection {
  units: 0.5 | 1;
}

export interface LeaveBalanceAllocation {
  leave_year: number;
  units: number;
}

export interface LeaveRequest extends SoftDeletable, ISOTimestamped {
  id: string;
  employee_profile_id: string;
  employee_user_id: string;
  workplace_warehouse_id: string;
  request_type: LeaveRequestType;
  status: LeaveRequestStatus;
  days: LeaveRequestDay[];
  total_units: number;
  reason: string;
  balance_allocations: LeaveBalanceAllocation[];
  approval_attempt: number;
  submitted_at: Date | null;
  completed_at: Date | null;
  created_by: string;
  updated_by: string;
  source: "USER_REQUEST" | "HISTORICAL_IMPORT";
  source_reference: string | null;
}

export interface LeaveBalanceBucket extends SoftDeletable, ISOTimestamped {
  id: string;
  employee_profile_id: string;
  leave_year: number;
  available_units: number;
  held_units: number;
  used_units: number;
  pending_probation_units: number;
  expired_units: number;
  last_ledger_entry_id: string | null;
}

export interface LeaveLedgerDelta {
  available_units: number;
  held_units: number;
  used_units: number;
  pending_probation_units: number;
  expired_units: number;
}

export interface LeaveLedgerEntry extends ISOTimestamped {
  id: string;
  employee_profile_id: string;
  leave_year: number;
  entry_type: LeaveLedgerEntryType;
  delta: LeaveLedgerDelta;
  request_id: string | null;
  import_batch_id: string | null;
  source_reference: string | null;
  idempotency_key: string;
  reason: string;
  created_by: string;
  created_at: Date;
}

export interface LeaveDayReservation extends SoftDeletable, ISOTimestamped {
  id: string;
  employee_profile_id: string;
  leave_date: LocalDate;
  morning_request_id: string | null;
  afternoon_request_id: string | null;
}

export interface LeaveImportBatch extends SoftDeletable, ISOTimestamped {
  id: string;
  status: LeaveImportBatchStatus;
  template_version: string;
  source_file_name: string;
  source_file_url: string;
  source_file_checksum: string;
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  committed_rows: number;
  created_by: string;
  committed_at: Date | null;
  failure_message: LocalizedText | null;
}

export interface LeaveImportRow extends SoftDeletable, ISOTimestamped {
  id: string;
  batch_id: string;
  row_number: number;
  record_type: LeaveImportRecordType;
  source_reference: string;
  employee_code: string;
  normalized_payload: Record<string, unknown>;
  is_valid: boolean;
  validation_messages: LocalizedText[];
  committed_at: Date | null;
}
