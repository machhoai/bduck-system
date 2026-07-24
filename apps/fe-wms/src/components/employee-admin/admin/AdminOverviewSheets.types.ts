import type {
  CompanyHoliday,
  CreateLeaveRequestInput,
  DecideLeaveApprovalTaskInput,
  EmployeeProfile,
  LeaveApprovalConfig,
  LeaveApprovalConfigOptions,
  LeaveApprovalTask,
  LeaveApprovalTaskView,
  LeaveBalanceSummary,
  LeaveImportBatch,
  LeaveImportBatchView,
  LeaveImportCommitResult,
  LeaveImportEmployeeOption,
  LeavePolicy,
  LeaveRequest,
  LeaveRequestAdminView,
  LeaveRequestType,
  ManualLeaveBalanceAdjustmentInput,
  PreviewLeaveImportInput,
  ReassignLeaveApprovalTaskInput,
  UpsertCompanyHolidayInput,
  UpsertLeaveApprovalConfigInput,
  UpsertLeavePolicyInput,
} from "@bduck/shared-types";

export type AdminOverviewSheetKey =
  | "profile"
  | "appointments"
  | "leaveHistory"
  | "requestHistory"
  | "holidays"
  | "request"
  | "approvalConfig"
  | "approvalInbox"
  | "approvalUnavailable"
  | "leaveImport"
  | "leavePolicy"
  | "companyLeaveRequests"
  | "leaveBalanceAdjustment"
  | null;

interface AppointmentItem {
  id?: string;
  title?: string | null;
  department?: string | null;
  effective_from?: Date | string | null;
}

export interface AdminOverviewSheetsProps {
  activeSheet: AdminOverviewSheetKey;
  labels: Record<string, string>;
  emptyLabel: string;
  profileFields: Array<{ label: string; value: string }>;
  appointments: AppointmentItem[];
  leaveBalance: LeaveBalanceSummary | null;
  requests: LeaveRequest[];
  requestApprovalTasks: LeaveApprovalTask[];
  requestsLoading: boolean;
  requestsError: string | null;
  canCreate: boolean;
  requestType: LeaveRequestType;
  holidays: CompanyHoliday[];
  approvalConfig: LeaveApprovalConfig | null;
  approvalOptions: LeaveApprovalConfigOptions;
  approvalTasks: LeaveApprovalTaskView[];
  unavailableApprovalTasks: LeaveApprovalTaskView[];
  approvalsLoading: boolean;
  approvalsError: string | null;
  importBatches: LeaveImportBatch[];
  importProfiles: LeaveImportEmployeeOption[];
  importPreview: LeaveImportBatchView | null;
  importsLoading: boolean;
  importsError: string | null;
  leavePolicy: LeavePolicy | null;
  companyRequests: LeaveRequestAdminView[];
  adjustmentProfiles: EmployeeProfile[];
  administrationLoading: boolean;
  administrationError: string | null;
  onClose: () => void;
  onCreateRequest: (input: CreateLeaveRequestInput) => Promise<unknown>;
  onSubmitRequest: (requestId: string) => Promise<unknown>;
  onCancelRequest: (requestId: string, reason: string) => Promise<unknown>;
  onCreateHoliday: (input: UpsertCompanyHolidayInput) => Promise<unknown>;
  onRemoveHoliday: (holidayId: string) => Promise<unknown>;
  onSaveApprovalConfig: (
    input: UpsertLeaveApprovalConfigInput,
  ) => Promise<unknown>;
  onDecideApproval: (
    taskId: string,
    input: DecideLeaveApprovalTaskInput,
  ) => Promise<unknown>;
  onReassignApproval: (
    taskId: string,
    input: ReassignLeaveApprovalTaskInput,
  ) => Promise<unknown>;
  onPreviewImport: (
    input: PreviewLeaveImportInput,
  ) => Promise<LeaveImportBatchView>;
  onOpenImport: (batchId: string) => Promise<LeaveImportBatchView>;
  onCommitImport: (
    batchId: string,
    input: { action_time: Date },
  ) => Promise<LeaveImportCommitResult>;
  onSavePolicy: (input: UpsertLeavePolicyInput) => Promise<unknown>;
  onLoadEmployeeBalance: (profileId: string) => Promise<LeaveBalanceSummary>;
  onAdjustBalance: (
    profileId: string,
    input: ManualLeaveBalanceAdjustmentInput,
  ) => Promise<unknown>;
}
