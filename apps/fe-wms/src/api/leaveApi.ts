"use client";

import type {
  CancelLeaveRequestInput,
  CompanyHoliday,
  CreateLeaveRequestInput,
  EmployeeProfile,
  LeaveBalanceSummary,
  LeavePolicy,
  LeaveRequest,
  LeaveRequestAdminView,
  LeaveApprovalConfig,
  LeaveApprovalConfigOptions,
  LeaveApprovalTask,
  LeaveApprovalTaskView,
  LeaveImportBatch,
  LeaveImportBatchView,
  LeaveImportCommitResult,
  LeaveImportEmployeeOption,
  PreviewLeaveImportInput,
  CommitLeaveImportInput,
  ManualLeaveBalanceAdjustmentInput,
  ManualLeaveBalanceAdjustmentResult,
  DecideLeaveApprovalTaskInput,
  ReassignLeaveApprovalTaskInput,
  UpsertLeaveApprovalConfigInput,
  UpsertLeavePolicyInput,
  SubmitLeaveRequestInput,
  UpsertCompanyHolidayInput,
} from "@bduck/shared-types";
import { authenticatedFetch } from "@/utils/authenticatedFetch";
import { createDetailedApiError } from "@/utils/apiError";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://api.wms.localhost";

const leaveFetch = async <T>(
  path: string,
  fallbackMessage: string,
  init: RequestInit = {},
): Promise<T> => {
  const response = await authenticatedFetch(
    `${API_BASE_URL}/api/leave${path}`,
    {
      ...init,
      headers: init.body
        ? { "Content-Type": "application/json", ...init.headers }
        : init.headers,
    },
  );
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.success) {
    throw createDetailedApiError(response, body, fallbackMessage);
  }
  return body.data as T;
};

export const fetchMyLeaveRequests = (fallbackMessage: string) =>
  leaveFetch<LeaveRequest[]>("/me/requests", fallbackMessage);

export const fetchCompanyLeavePolicy = (fallbackMessage: string) =>
  leaveFetch<LeavePolicy | null>("/policy", fallbackMessage);

export const saveCompanyLeavePolicy = (
  input: UpsertLeavePolicyInput,
  fallbackMessage: string,
) =>
  leaveFetch<LeavePolicy>("/policy", fallbackMessage, {
    method: "PUT",
    body: JSON.stringify(input),
  });

export const fetchCompanyLeaveRequests = (fallbackMessage: string) =>
  leaveFetch<LeaveRequestAdminView[]>("/requests", fallbackMessage);

export const fetchLeaveBalanceProfiles = (fallbackMessage: string) =>
  leaveFetch<EmployeeProfile[]>("/balance-profiles", fallbackMessage);

export const fetchEmployeeLeaveBalance = (
  profileId: string,
  fallbackMessage: string,
) =>
  leaveFetch<LeaveBalanceSummary>(
    `/balances/${encodeURIComponent(profileId)}`,
    fallbackMessage,
  );

export const createLeaveBalanceAdjustment = (
  profileId: string,
  input: ManualLeaveBalanceAdjustmentInput,
  fallbackMessage: string,
) =>
  leaveFetch<ManualLeaveBalanceAdjustmentResult>(
    `/balances/${encodeURIComponent(profileId)}/adjustments`,
    fallbackMessage,
    { method: "POST", body: JSON.stringify(input) },
  );

export const createMyLeaveRequest = (
  input: CreateLeaveRequestInput,
  fallbackMessage: string,
) =>
  leaveFetch<LeaveRequest>("/me/requests", fallbackMessage, {
    method: "POST",
    body: JSON.stringify(input),
  });

export const submitMyLeaveRequest = (
  requestId: string,
  input: SubmitLeaveRequestInput,
  fallbackMessage: string,
) =>
  leaveFetch<LeaveRequest>(
    `/me/requests/${requestId}/submit`,
    fallbackMessage,
    { method: "POST", body: JSON.stringify(input) },
  );

export const cancelMyLeaveRequest = (
  requestId: string,
  input: CancelLeaveRequestInput,
  fallbackMessage: string,
) =>
  leaveFetch<LeaveRequest>(
    `/me/requests/${requestId}/cancel`,
    fallbackMessage,
    { method: "POST", body: JSON.stringify(input) },
  );

export const fetchCompanyHolidays = (year: number, fallbackMessage: string) =>
  leaveFetch<CompanyHoliday[]>(`/holidays?year=${year}`, fallbackMessage);

export const createCompanyHoliday = (
  input: UpsertCompanyHolidayInput,
  fallbackMessage: string,
) =>
  leaveFetch<CompanyHoliday>("/holidays", fallbackMessage, {
    method: "POST",
    body: JSON.stringify(input),
  });

export const deleteCompanyHoliday = (
  holidayId: string,
  actionTime: Date,
  fallbackMessage: string,
) =>
  leaveFetch<CompanyHoliday>(
    `/holidays/${encodeURIComponent(holidayId)}`,
    fallbackMessage,
    {
      method: "DELETE",
      body: JSON.stringify({ action_time: actionTime }),
    },
  );

export const fetchLeaveApprovalConfig = (fallbackMessage: string) =>
  leaveFetch<LeaveApprovalConfig | null>("/approval-config", fallbackMessage);

export const fetchLeaveApprovalConfigOptions = (fallbackMessage: string) =>
  leaveFetch<LeaveApprovalConfigOptions>(
    "/approval-config/options",
    fallbackMessage,
  );

export const saveLeaveApprovalConfig = (
  input: UpsertLeaveApprovalConfigInput,
  fallbackMessage: string,
) =>
  leaveFetch<LeaveApprovalConfig>("/approval-config", fallbackMessage, {
    method: "PUT",
    body: JSON.stringify(input),
  });

export const fetchMyLeaveApprovalTasks = (fallbackMessage: string) =>
  leaveFetch<LeaveApprovalTaskView[]>("/approval-tasks/me", fallbackMessage);

export const fetchUnavailableLeaveApprovalTasks = (fallbackMessage: string) =>
  leaveFetch<LeaveApprovalTaskView[]>(
    "/approval-tasks/unavailable",
    fallbackMessage,
  );

export const decideLeaveApprovalTask = (
  taskId: string,
  input: DecideLeaveApprovalTaskInput,
  fallbackMessage: string,
) =>
  leaveFetch<LeaveRequest>(
    `/approval-tasks/${encodeURIComponent(taskId)}/decision`,
    fallbackMessage,
    { method: "POST", body: JSON.stringify(input) },
  );

export const reassignLeaveApprovalTask = (
  taskId: string,
  input: ReassignLeaveApprovalTaskInput,
  fallbackMessage: string,
) =>
  leaveFetch<LeaveApprovalTask>(
    `/approval-tasks/${encodeURIComponent(taskId)}/reassign`,
    fallbackMessage,
    { method: "POST", body: JSON.stringify(input) },
  );

export const fetchLeaveImportBatches = (fallbackMessage: string) =>
  leaveFetch<LeaveImportBatch[]>("/imports", fallbackMessage);

export const fetchLeaveImportEmployeeOptions = (fallbackMessage: string) =>
  leaveFetch<LeaveImportEmployeeOption[]>("/import-profiles", fallbackMessage);

export const fetchLeaveImportBatch = (
  batchId: string,
  fallbackMessage: string,
) =>
  leaveFetch<LeaveImportBatchView>(
    `/imports/${encodeURIComponent(batchId)}`,
    fallbackMessage,
  );

export const previewLeaveHistoryImport = (
  input: PreviewLeaveImportInput,
  fallbackMessage: string,
) =>
  leaveFetch<LeaveImportBatchView>("/imports/preview", fallbackMessage, {
    method: "POST",
    body: JSON.stringify(input),
  });

export const commitLeaveHistoryImport = (
  batchId: string,
  input: CommitLeaveImportInput,
  fallbackMessage: string,
) =>
  leaveFetch<LeaveImportCommitResult>(
    `/imports/${encodeURIComponent(batchId)}/commit`,
    fallbackMessage,
    { method: "POST", body: JSON.stringify(input) },
  );
