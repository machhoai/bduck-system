import type {
  ISOTimestamped,
  LocalizedText,
  SoftDeletable,
} from "./utility.js";
import type { LeaveRequest } from "./leave.js";

export enum LeaveApprovalTaskStatus {
  WAITING = "WAITING",
  PENDING = "PENDING",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
  CANCELLED = "CANCELLED",
  APPROVER_UNAVAILABLE = "APPROVER_UNAVAILABLE",
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

export interface UpsertLeaveApprovalConfigInput {
  levels: LeaveApprovalLevel[];
  action_time: Date;
}

export interface LeaveApprovalRoleOption {
  id: string;
  name: string;
  color: string;
}

export interface LeaveApprovalUserOption {
  id: string;
  full_name: string;
  employee_id: string;
}

export interface LeaveApprovalConfigOptions {
  roles: LeaveApprovalRoleOption[];
  users: LeaveApprovalUserOption[];
}

export interface LeaveApprovalTask extends SoftDeletable, ISOTimestamped {
  id: string;
  leave_request_id: string;
  employee_profile_id: string;
  employee_user_id: string;
  workplace_warehouse_id: string;
  approval_attempt: number;
  level: 1 | 2 | 3;
  label: LocalizedText;
  status: LeaveApprovalTaskStatus;
  assignment: LeaveApprovalAssignment;
  acted_by: string | null;
  acted_at: Date | null;
  decision_reason: string | null;
  created_by: string;
  updated_by: string;
}

export interface LeaveApprovalTaskView {
  task: LeaveApprovalTask;
  request: LeaveRequest;
  employee_name: string;
  employee_code: string;
}

export interface LeaveRequestAdminView {
  request: LeaveRequest;
  employee_name: string;
  employee_code: string;
  approval_tasks: LeaveApprovalTask[];
}

export interface DecideLeaveApprovalTaskInput {
  decision: "APPROVE" | "REJECT";
  reason: string;
  action_time: Date;
}

export interface ReassignLeaveApprovalTaskInput {
  assignment: LeaveApprovalAssignment;
  reason: string;
  action_time: Date;
}

export interface LeaveApprovalReassignment extends ISOTimestamped {
  id: string;
  leave_request_id: string;
  approval_task_id: string;
  workplace_warehouse_id: string;
  approval_attempt: number;
  level: 1 | 2 | 3;
  previous_assignment: LeaveApprovalAssignment;
  next_assignment: LeaveApprovalAssignment;
  reason: string;
  reassigned_by: string;
  created_at: Date;
}
