"use client";

import type { LeaveRequestType } from "@bduck/shared-types";
import { LeaveRequestType as LeaveRequestTypeValue } from "@bduck/shared-types";
import { BriefcaseBusiness, IdCard, UserRound } from "lucide-react";
import { useState } from "react";

import { EmployeeSelfContractPanel } from "@/components/employees/EmployeeSelfContractPanel";
import { isEmployeeContractsFeatureEnabled } from "@/lib/employeeContractFeatureFlag";

import { ActionButton, EmptyState, InfoPill } from "./AdminOverviewParts";
import {
    AdminOverviewSheets,
    type AdminOverviewSheetKey,
} from "./AdminOverviewSheets";
import { AdminOverviewSkeleton } from "./AdminOverviewSkeleton";
import type {
    AdminOverviewTabProps,
    ExtendedEmployeeProfile,
} from "./AdminOverviewTab.types";
import { buildAdminProfileFields, formatMaybeDate } from "./adminOverviewUtils";
import { AdminRequestPanel } from "./AdminRequestPanel";
import { LeaveBalanceCard } from "./LeaveBalanceCard";

export function AdminOverviewTab({
    labels,
    profile,
    warehouse,
    loading,
    leaveFeatureEnabled,
    canViewLeaveBalance,
    leaveBalance,
    leaveBalanceLoading,
    leaveBalanceError,
    canCreateLeaveRequest,
    canManageHolidays,
    canApproveLeave,
    canManageLeaveApproval,
    canReassignLeaveApprover,
    canImportLeaveHistory,
    canReadAllLeaveRequests,
    canAdjustLeaveBalance,
    leaveRequests,
    companyHolidays,
    leaveRequestApprovalTasks,
    leaveRequestsLoading,
    leaveRequestsError,
    onCreateLeaveRequest,
    onSubmitLeaveRequest,
    onCancelLeaveRequest,
    onCreateHoliday,
    onRemoveHoliday,
    leaveApprovalConfig,
    leaveApprovalOptions,
    leaveApprovalTasks,
    unavailableLeaveApprovalTasks,
    leaveApprovalsLoading,
    leaveApprovalsError,
    onSaveLeaveApprovalConfig,
    onDecideLeaveApproval,
    onReassignLeaveApproval,
    leaveImportBatches,
    leaveImportProfiles,
    leaveImportPreview,
    leaveImportsLoading,
    leaveImportsError,
    onPreviewLeaveImport,
    onOpenLeaveImport,
    onCommitLeaveImport,
    leavePolicy,
    companyLeaveRequests,
    leaveAdjustmentProfiles,
    leaveAdministrationLoading,
    leaveAdministrationError,
    onSaveLeavePolicy,
    onLoadEmployeeLeaveBalance,
    onAdjustLeaveBalance,
}: AdminOverviewTabProps) {
    const [activeSheet, setActiveSheet] = useState<AdminOverviewSheetKey>(null);
    const [requestType, setRequestType] = useState<LeaveRequestType>(
        LeaveRequestTypeValue.PAID_ANNUAL,
    );
    const extendedProfile = profile as ExtendedEmployeeProfile | null;
    const emptyLabel = labels.notUpdated || "Not updated";
    const profileFields = buildAdminProfileFields(
        labels,
        extendedProfile,
        warehouse,
        emptyLabel,
    );
    const appointments = extendedProfile?.appointment_history || [];

    if (loading) {
        return (
            <AdminOverviewSkeleton leaveFeatureEnabled={leaveFeatureEnabled} />
        );
    }

    return (
        <div
            className={
                leaveFeatureEnabled
                    ? "grid gap-4 lg:grid-cols-12 lg:gap-5"
                    : "grid gap-4"
            }
        >
            {/* Left Column (5 cols) */}
            <div className="flex flex-col gap-4 min-w-0 lg:col-span-5">
                {/* Personal Profile Section Card */}
                <section
                    data-employee-admin-animate
                    className="rounded-2xl border border-[var(--color-border-subtle)] bg-white p-4 shadow-xs lg:p-5"
                >
                    {/* Standardized Section Header */}
                    <div className="flex items-center justify-between border-b border-[var(--color-border-soft)] pb-3">
                        <div className="flex items-center gap-2">
                            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--color-brand-primary-muted)] text-[var(--color-brand-primary)]">
                                <IdCard size={15} />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold tracking-wider text-[var(--color-text-primary)]">
                                    {profile?.full_name ||
                                        labels.employeeProfile}
                                </h3>
                            </div>
                        </div>
                    </div>

                    <div className="mt-3.5 grid grid-cols-2 gap-2 lg:hidden">
                        {profileFields.slice(0, 4).map((field) => (
                            <InfoPill
                                key={field.label}
                                label={field.label}
                                value={field.value}
                            />
                        ))}
                    </div>
                    <div className="mt-3.5 grid gap-2 sm:grid-cols-2 lg:hidden">
                        <ActionButton
                            icon={<UserRound size={16} />}
                            label={labels.viewFullProfile}
                            onClick={() => setActiveSheet("profile")}
                        />
                        <ActionButton
                            icon={<BriefcaseBusiness size={16} />}
                            label={labels.viewAppointments}
                            onClick={() => setActiveSheet("appointments")}
                        />
                    </div>
                    <div className="mt-3.5 hidden lg:grid lg:grid-cols-2 lg:gap-2.5">
                        {profileFields.map((field) => (
                            <InfoPill
                                key={field.label}
                                label={field.label}
                                value={field.value}
                            />
                        ))}
                    </div>
                </section>

                {profile && isEmployeeContractsFeatureEnabled ? (
                    <EmployeeSelfContractPanel profile={profile} />
                ) : null}

                {/* Appointment History Section Card */}
                <section
                    data-employee-admin-animate
                    className="hidden lg:block rounded-2xl border border-[var(--color-border-subtle)] bg-white p-5 shadow-xs"
                >
                    {/* Standardized Section Header */}
                    <div className="flex items-center justify-between border-b border-[var(--color-border-soft)] pb-3">
                        <div className="flex items-center gap-2">
                            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--color-brand-primary-muted)] text-[var(--color-brand-primary)]">
                                <BriefcaseBusiness size={15} />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold tracking-wider text-[var(--color-text-primary)]">
                                    {labels.appointmentHistory ||
                                        "Lịch sử bổ nhiệm"}
                                </h3>
                            </div>
                        </div>
                    </div>

                    <div className="mt-3.5">
                        {appointments.length > 0 ? (
                            <div className="grid grid-cols-2 gap-3">
                                {appointments.map((item, index) => (
                                    <div
                                        key={
                                            item.id ||
                                            `${item.title || "appointment"}-${index}`
                                        }
                                        className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] p-3"
                                    >
                                        <p className="text-xs font-semibold text-[var(--color-text-primary)]">
                                            {item.title || emptyLabel}
                                        </p>
                                        <p className="mt-1 text-[10px] text-[var(--color-text-muted)] font-medium tracking-wider">
                                            {item.department || emptyLabel}
                                        </p>
                                        <p className="mt-2 text-[10px] font-medium text-[var(--color-text-secondary)]">
                                            Hiệu lực:{" "}
                                            {formatMaybeDate(
                                                item.effective_from,
                                                emptyLabel,
                                            )}
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
                    </div>
                </section>
            </div>

            {/* Right Column (7 cols) */}
            {leaveFeatureEnabled && (
                <div className="flex flex-col gap-4 min-w-0 lg:col-span-7">
                    <LeaveBalanceCard
                        labels={labels}
                        summary={leaveBalance}
                        loading={leaveBalanceLoading}
                        error={leaveBalanceError}
                        canView={canViewLeaveBalance}
                        canRequest={canCreateLeaveRequest}
                        onHistory={() => setActiveSheet("leaveHistory")}
                        onUsedLeave={() => setActiveSheet("requestHistory")}
                        onRequest={() => setActiveSheet("request")}
                    />
                    <AdminRequestPanel
                        labels={labels}
                        canCreate={canCreateLeaveRequest}
                        canManageHolidays={canManageHolidays}
                        canApprove={canApproveLeave}
                        canManageApproval={canManageLeaveApproval}
                        canReassign={canReassignLeaveApprover}
                        canImportHistory={canImportLeaveHistory}
                        canReadAll={canReadAllLeaveRequests}
                        canAdjustBalance={canAdjustLeaveBalance}
                        onCreate={(selectedType) => {
                            setRequestType(selectedType);
                            setActiveSheet("request");
                        }}
                        onOpenHistory={() => setActiveSheet("requestHistory")}
                        onOpenHolidays={() => setActiveSheet("holidays")}
                        onOpenApprovals={() => setActiveSheet("approvalInbox")}
                        onOpenApprovalConfig={() =>
                            setActiveSheet("approvalConfig")
                        }
                        onOpenUnavailable={() =>
                            setActiveSheet("approvalUnavailable")
                        }
                        onOpenImport={() => setActiveSheet("leaveImport")}
                        onOpenPolicy={() => setActiveSheet("leavePolicy")}
                        onOpenCompanyRequests={() =>
                            setActiveSheet("companyLeaveRequests")
                        }
                        onOpenBalanceAdjustment={() =>
                            setActiveSheet("leaveBalanceAdjustment")
                        }
                    />
                </div>
            )}

            {leaveFeatureEnabled && (
                <AdminOverviewSheets
                    activeSheet={activeSheet}
                    labels={labels}
                    emptyLabel={emptyLabel}
                    profileFields={profileFields}
                    appointments={appointments}
                    leaveBalance={leaveBalance}
                    requests={leaveRequests}
                    requestApprovalTasks={leaveRequestApprovalTasks}
                    requestsLoading={leaveRequestsLoading}
                    requestsError={leaveRequestsError}
                    canCreate={canCreateLeaveRequest}
                    requestType={requestType}
                    holidays={companyHolidays}
                    approvalConfig={leaveApprovalConfig}
                    approvalOptions={leaveApprovalOptions}
                    approvalTasks={leaveApprovalTasks}
                    unavailableApprovalTasks={unavailableLeaveApprovalTasks}
                    approvalsLoading={leaveApprovalsLoading}
                    approvalsError={leaveApprovalsError}
                    importBatches={leaveImportBatches}
                    importProfiles={leaveImportProfiles}
                    importPreview={leaveImportPreview}
                    importsLoading={leaveImportsLoading}
                    importsError={leaveImportsError}
                    onClose={() => setActiveSheet(null)}
                    onCreateRequest={onCreateLeaveRequest}
                    onSubmitRequest={onSubmitLeaveRequest}
                    onCancelRequest={onCancelLeaveRequest}
                    onCreateHoliday={onCreateHoliday}
                    onRemoveHoliday={onRemoveHoliday}
                    onSaveApprovalConfig={onSaveLeaveApprovalConfig}
                    onDecideApproval={onDecideLeaveApproval}
                    onReassignApproval={onReassignLeaveApproval}
                    onPreviewImport={onPreviewLeaveImport}
                    onOpenImport={onOpenLeaveImport}
                    onCommitImport={onCommitLeaveImport}
                    leavePolicy={leavePolicy}
                    companyRequests={companyLeaveRequests}
                    adjustmentProfiles={leaveAdjustmentProfiles}
                    administrationLoading={leaveAdministrationLoading}
                    administrationError={leaveAdministrationError}
                    onSavePolicy={onSaveLeavePolicy}
                    onLoadEmployeeBalance={onLoadEmployeeLeaveBalance}
                    onAdjustBalance={onAdjustLeaveBalance}
                />
            )}
        </div>
    );
}
