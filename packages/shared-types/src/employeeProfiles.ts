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

export enum EmployeeIdentitySyncJobStatus {
  PENDING = "PENDING",
  PROCESSING = "PROCESSING",
  SUCCEEDED = "SUCCEEDED",
  FAILED = "FAILED",
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

/**
 * Transactional outbox record used to synchronize the canonical Firestore
 * account state with Firebase Authentication. The deterministic transition
 * relationship makes processing idempotent and safe to retry.
 */
export interface EmployeeIdentitySyncJob
  extends SoftDeletable, ISOTimestamped {
  id: string;
  employee_profile_id: string;
  employee_user_id: string;
  employment_transition_id: string;
  desired_disabled: boolean;
  status: EmployeeIdentitySyncJobStatus;
  retry_count: number;
  next_retry_at: Date;
  lease_expires_at: Date | null;
  last_error: string | null;
  requested_by: string;
  completed_at: Date | null;
}

/**
 * Date-effective attendance eligibility. Historical dates before resignation
 * remain eligible even though the current profile projection is INACTIVE.
 */
export const isEmployeeAttendanceEligibleOnDate = (
  profile: Pick<
    EmployeeProfile,
    | "status"
    | "employment_status"
    | "probation_start_date"
    | "official_start_date"
    | "resignation_date"
    | "is_deleted"
  >,
  attendanceDate: LocalDate,
): boolean => {
  if (profile.is_deleted || !/^\d{4}-\d{2}-\d{2}$/u.test(attendanceDate)) {
    return false;
  }

  const firstWorkingDate =
    profile.probation_start_date ?? profile.official_start_date;
  if (firstWorkingDate && attendanceDate < firstWorkingDate) return false;

  if (profile.resignation_date) {
    return attendanceDate < profile.resignation_date;
  }

  if (profile.employment_status === EmployeeEmploymentStatus.RESIGNED) {
    return false;
  }

  return profile.status !== EmployeeProfileStatus.INACTIVE;
};

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
