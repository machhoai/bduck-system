import type {
  CompanyHoliday,
  CreateLeaveRequestInput,
  DecideLeaveApprovalTaskInput,
  EmployeeProfile,
  LeaveApprovalConfig,
  LeaveApprovalConfigOptions,
  LeaveApprovalTaskView,
  LeaveApprovalTask,
  LeaveBalanceSummary,
  LeaveImportBatch,
  LeaveImportBatchView,
  LeaveImportCommitResult,
  LeaveRequest,
  LeaveRequestAdminView,
  LeavePolicy,
  ManualLeaveBalanceAdjustmentInput,
  PreviewLeaveImportInput,
  ReassignLeaveApprovalTaskInput,
  UpsertCompanyHolidayInput,
  UpsertLeaveApprovalConfigInput,
  UpsertLeavePolicyInput,
  Warehouse,
} from "@bduck/shared-types";

export type ExtendedEmployeeProfile = EmployeeProfile & {
  social_insurance_code?: string | null;
  probation_start_date?: Date | string | null;
  probation_end_date?: Date | string | null;
  official_start_date?: Date | string | null;
  resignation_date?: Date | string | null;
  appointment_history?: Array<{
    id?: string;
    title?: string | null;
    department?: string | null;
    effective_from?: Date | string | null;
    effective_to?: Date | string | null;
  }>;
};

export interface AdminOverviewTabProps {
  labels: Record<string, string>;
  profile: EmployeeProfile | null;
  warehouse: Warehouse | null;
  loading: boolean;
  leaveFeatureEnabled: boolean;
  canViewLeaveBalance: boolean;
  leaveBalance: LeaveBalanceSummary | null;
  leaveBalanceLoading: boolean;
  leaveBalanceError: string | null;
  canCreateLeaveRequest: boolean;
  canManageHolidays: boolean;
  canApproveLeave: boolean;
  canManageLeaveApproval: boolean;
  canReassignLeaveApprover: boolean;
  canImportLeaveHistory: boolean;
  canReadAllLeaveRequests: boolean;
  canAdjustLeaveBalance: boolean;
  leaveRequests: LeaveRequest[];
  companyHolidays: CompanyHoliday[];
  leaveRequestApprovalTasks: LeaveApprovalTask[];
  leaveRequestsLoading: boolean;
  leaveRequestsError: string | null;
  onCreateLeaveRequest: (input: CreateLeaveRequestInput) => Promise<unknown>;
  onSubmitLeaveRequest: (requestId: string) => Promise<unknown>;
  onCancelLeaveRequest: (requestId: string, reason: string) => Promise<unknown>;
  onCreateHoliday: (input: UpsertCompanyHolidayInput) => Promise<unknown>;
  onRemoveHoliday: (holidayId: string) => Promise<unknown>;
  leaveApprovalConfig: LeaveApprovalConfig | null;
  leaveApprovalOptions: LeaveApprovalConfigOptions;
  leaveApprovalTasks: LeaveApprovalTaskView[];
  unavailableLeaveApprovalTasks: LeaveApprovalTaskView[];
  leaveApprovalsLoading: boolean;
  leaveApprovalsError: string | null;
  onSaveLeaveApprovalConfig: (
    input: UpsertLeaveApprovalConfigInput,
  ) => Promise<unknown>;
  onDecideLeaveApproval: (
    taskId: string,
    input: DecideLeaveApprovalTaskInput,
  ) => Promise<unknown>;
  onReassignLeaveApproval: (
    taskId: string,
    input: ReassignLeaveApprovalTaskInput,
  ) => Promise<unknown>;
  leaveImportBatches: LeaveImportBatch[];
  leaveImportPreview: LeaveImportBatchView | null;
  leaveImportsLoading: boolean;
  leaveImportsError: string | null;
  onPreviewLeaveImport: (
    input: PreviewLeaveImportInput,
  ) => Promise<LeaveImportBatchView>;
  onOpenLeaveImport: (batchId: string) => Promise<LeaveImportBatchView>;
  onCommitLeaveImport: (
    batchId: string,
    input: { action_time: Date },
  ) => Promise<LeaveImportCommitResult>;
  leavePolicy: LeavePolicy | null;
  companyLeaveRequests: LeaveRequestAdminView[];
  leaveAdjustmentProfiles: EmployeeProfile[];
  leaveAdministrationLoading: boolean;
  leaveAdministrationError: string | null;
  onSaveLeavePolicy: (input: UpsertLeavePolicyInput) => Promise<unknown>;
  onLoadEmployeeLeaveBalance: (
    profileId: string,
  ) => Promise<LeaveBalanceSummary>;
  onAdjustLeaveBalance: (
    profileId: string,
    input: ManualLeaveBalanceAdjustmentInput,
  ) => Promise<unknown>;
}
