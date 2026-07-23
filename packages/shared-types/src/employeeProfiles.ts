import type { ISOTimestamped, LocalDate, SoftDeletable } from "./utility.js";

export enum EmployeeProfileStatus {
  ACTIVE = "ACTIVE",
  INACTIVE = "INACTIVE",
  ON_LEAVE = "ON_LEAVE",
}

/**
 * Employment lifecycle is intentionally separate from profile/account status.
 * UNSPECIFIED supports legacy profiles until the HR migration is completed.
 */
export enum EmployeeEmploymentStatus {
  UNSPECIFIED = "UNSPECIFIED",
  PROBATION = "PROBATION",
  OFFICIAL = "OFFICIAL",
  RESIGNED = "RESIGNED",
}

export enum EmployeeEmploymentTransitionStatus {
  SCHEDULED = "SCHEDULED",
  APPLIED = "APPLIED",
  CANCELLED = "CANCELLED",
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
  /**
   * Optional during the backward-compatible rollout. Phase 1 migration will
   * populate UNSPECIFIED for legacy profiles and require explicit HR review.
   */
  employment_status?: EmployeeEmploymentStatus;
  probation_start_date?: LocalDate | null;
  probation_end_date?: LocalDate | null;
  official_start_date?: LocalDate | null;
  resignation_date?: LocalDate | null;
  notes: string | null;
  is_deleted: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface EmployeeEmploymentTransition
  extends SoftDeletable, ISOTimestamped {
  id: string;
  employee_profile_id: string;
  employee_user_id: string | null;
  workplace_warehouse_id: string;
  from_status: EmployeeEmploymentStatus;
  to_status: EmployeeEmploymentStatus;
  effective_date: LocalDate;
  probation_end_date: LocalDate | null;
  status: EmployeeEmploymentTransitionStatus;
  reason: string;
  requested_by: string;
  applied_by: string | null;
  applied_at: Date | null;
  cancelled_by: string | null;
  cancelled_at: Date | null;
  cancellation_reason: string | null;
}

export interface CreateEmployeeEmploymentTransitionInput {
  to_status: Exclude<
    EmployeeEmploymentStatus,
    EmployeeEmploymentStatus.UNSPECIFIED
  >;
  effective_date: LocalDate;
  probation_end_date?: LocalDate | null;
  reason: string;
}

export interface CancelEmployeeEmploymentTransitionInput {
  reason: string;
}
