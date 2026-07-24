"use client";

import { EmployeeAdminBottomSheet } from "../EmployeeAdminBottomSheet";
import { AdminRequestDraft } from "./AdminRequestDraft";
import { CompanyHolidayManager } from "./CompanyHolidayManager";
import { DetailGrid, EmptyState } from "./AdminOverviewParts";
import { formatMaybeDate } from "./adminOverviewUtils";
import { LeaveBalanceHistory } from "./LeaveBalanceHistory";
import { LeaveRequestHistory } from "./LeaveRequestHistory";
import { LeaveApprovalConfigManager } from "./LeaveApprovalConfigManager";
import { LeaveApprovalInbox } from "./LeaveApprovalInbox";
import { UnavailableLeaveApprovals } from "./UnavailableLeaveApprovals";
import { LeaveHistoryImportManager } from "./LeaveHistoryImportManager";
import { CompanyLeaveRequests } from "./CompanyLeaveRequests";
import { LeaveBalanceAdjustmentManager } from "./LeaveBalanceAdjustmentManager";
import { LeavePolicyManager } from "./LeavePolicyManager";
import type {
  AdminOverviewSheetKey,
  AdminOverviewSheetsProps,
} from "./AdminOverviewSheets.types";

export type { AdminOverviewSheetKey } from "./AdminOverviewSheets.types";

export function AdminOverviewSheets(props: AdminOverviewSheetsProps) {
  const {
    activeSheet,
    labels,
    emptyLabel,
    profileFields,
    appointments,
    leaveBalance,
    requests,
    requestsLoading,
    requestsError,
    canCreate,
    requestType,
    holidays,
    onClose,
  } = props;
  return (
    <>
      <EmployeeAdminBottomSheet
        open={activeSheet === "leavePolicy"}
        title={labels.leavePolicyTitle}
        description={labels.leavePolicyHint}
        onClose={onClose}
      >
        <LeavePolicyManager
          labels={labels}
          policy={props.leavePolicy}
          loading={props.administrationLoading}
          error={props.administrationError}
          onSave={props.onSavePolicy}
        />
      </EmployeeAdminBottomSheet>

      <EmployeeAdminBottomSheet
        open={activeSheet === "companyLeaveRequests"}
        title={labels.companyLeaveRequestsTitle}
        description={labels.companyLeaveRequestsHint}
        onClose={onClose}
      >
        <CompanyLeaveRequests
          labels={labels}
          items={props.companyRequests}
          loading={props.administrationLoading}
          error={props.administrationError}
        />
      </EmployeeAdminBottomSheet>

      <EmployeeAdminBottomSheet
        open={activeSheet === "leaveBalanceAdjustment"}
        title={labels.leaveBalanceAdjustmentTitle}
        description={labels.leaveBalanceAdjustmentHint}
        onClose={onClose}
      >
        <LeaveBalanceAdjustmentManager
          labels={labels}
          profiles={props.adjustmentProfiles}
          loading={props.administrationLoading}
          error={props.administrationError}
          onLoadBalance={props.onLoadEmployeeBalance}
          onAdjust={props.onAdjustBalance}
        />
      </EmployeeAdminBottomSheet>

      <EmployeeAdminBottomSheet
        open={activeSheet === "leaveImport"}
        title={labels.leaveImportTitle}
        description={labels.leaveImportHint}
        onClose={onClose}
      >
        <LeaveHistoryImportManager
          labels={labels}
          batches={props.importBatches}
          employeeOptions={props.importProfiles}
          preview={props.importPreview}
          loading={props.importsLoading}
          error={props.importsError}
          onPreview={props.onPreviewImport}
          onOpenBatch={props.onOpenImport}
          onCommit={props.onCommitImport}
        />
      </EmployeeAdminBottomSheet>

      <EmployeeAdminBottomSheet
        open={activeSheet === "profile"}
        title={labels.fullProfile}
        description={labels.fullProfileHint}
        onClose={onClose}
      >
        <DetailGrid fields={profileFields} />
      </EmployeeAdminBottomSheet>

      <EmployeeAdminBottomSheet
        open={activeSheet === "approvalConfig"}
        title={labels.approvalConfigTitle}
        description={labels.approvalConfigHint}
        onClose={onClose}
      >
        <LeaveApprovalConfigManager
          labels={labels}
          config={props.approvalConfig}
          options={props.approvalOptions}
          loading={props.approvalsLoading}
          error={props.approvalsError}
          onSave={props.onSaveApprovalConfig}
        />
      </EmployeeAdminBottomSheet>

      <EmployeeAdminBottomSheet
        open={activeSheet === "approvalInbox"}
        title={labels.approvalInboxTitle}
        description={labels.approvalInboxHint}
        onClose={onClose}
      >
        <LeaveApprovalInbox
          labels={labels}
          tasks={props.approvalTasks}
          loading={props.approvalsLoading}
          error={props.approvalsError}
          onDecide={props.onDecideApproval}
        />
      </EmployeeAdminBottomSheet>

      <EmployeeAdminBottomSheet
        open={activeSheet === "approvalUnavailable"}
        title={labels.approvalUnavailableTitle}
        description={labels.approvalUnavailableHint}
        onClose={onClose}
      >
        <UnavailableLeaveApprovals
          labels={labels}
          tasks={props.unavailableApprovalTasks}
          options={props.approvalOptions}
          loading={props.approvalsLoading}
          error={props.approvalsError}
          onReassign={props.onReassignApproval}
        />
      </EmployeeAdminBottomSheet>

      <EmployeeAdminBottomSheet
        open={activeSheet === "appointments"}
        title={labels.appointmentHistory}
        description={labels.appointmentHistoryHint}
        onClose={onClose}
      >
        {appointments.length > 0 ? (
          <div className="space-y-3">
            {appointments.map((item, index) => (
              <div
                key={item.id || `${item.title || "appointment"}-${index}`}
                className="rounded-2xl border border-[var(--color-border-soft)] p-3"
              >
                <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                  {item.title || emptyLabel}
                </p>
                <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                  {item.department || emptyLabel}
                </p>
                <p className="mt-2 text-xs font-medium text-[var(--color-text-secondary)]">
                  {formatMaybeDate(item.effective_from, emptyLabel)}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            title={labels.noAppointments}
            hint={labels.noAppointmentsHint}
          />
        )}
      </EmployeeAdminBottomSheet>

      <EmployeeAdminBottomSheet
        open={activeSheet === "leaveHistory"}
        title={labels.leaveHistoryTitle}
        description={labels.leaveHistoryHint}
        onClose={onClose}
      >
        <LeaveBalanceHistory labels={labels} summary={leaveBalance} />
      </EmployeeAdminBottomSheet>

      <EmployeeAdminBottomSheet
        open={activeSheet === "requestHistory"}
        title={labels.requestHistoryTitle}
        description={labels.requestHistoryHint}
        onClose={onClose}
      >
        <LeaveRequestHistory
          labels={labels}
          requests={requests}
          approvalTasks={props.requestApprovalTasks}
          loading={requestsLoading}
          error={requestsError}
          canCreate={canCreate}
          onSubmit={props.onSubmitRequest}
          onCancel={props.onCancelRequest}
        />
      </EmployeeAdminBottomSheet>

      <EmployeeAdminBottomSheet
        open={activeSheet === "holidays"}
        title={labels.manageCompanyHolidays}
        description={labels.manageCompanyHolidaysHint}
        onClose={onClose}
      >
        <CompanyHolidayManager
          labels={labels}
          holidays={holidays}
          onCreate={props.onCreateHoliday}
          onRemove={props.onRemoveHoliday}
        />
      </EmployeeAdminBottomSheet>

      <EmployeeAdminBottomSheet
        open={activeSheet === "request"}
        title={labels.createRequest}
        description={labels.createRequestHint}
        onClose={onClose}
      >
        <AdminRequestDraft
          labels={labels}
          initialType={requestType}
          holidays={holidays}
          onCreate={props.onCreateRequest}
          onCompleted={onClose}
        />
      </EmployeeAdminBottomSheet>
    </>
  );
}
