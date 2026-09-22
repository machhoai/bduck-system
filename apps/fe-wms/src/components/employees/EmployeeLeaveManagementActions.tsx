"use client";

import type { CompanyHoliday, EmployeeProfile } from "@bduck/shared-types";
import { CalendarPlus, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { fetchCompanyHolidays } from "@/api/leaveApi";
import { LeaveBalanceAdjustmentManager } from "@/components/employee-admin/admin/LeaveBalanceAdjustmentManager";
import { LeaveHistoryImportManager } from "@/components/employee-admin/admin/LeaveHistoryImportManager";
import { useLeaveAdministration } from "@/hooks/useLeaveAdministration";
import { useLeaveImports } from "@/hooks/useLeaveImports";

type LeaveAction = "import" | "adjust" | null;

export function EmployeeLeaveManagementActions({
    profile,
    labels,
    canImportHistory,
    canAdjustBalance,
}: {
    profile: EmployeeProfile;
    labels: Record<string, string>;
    canImportHistory: boolean;
    canAdjustBalance: boolean;
}) {
    const [activeAction, setActiveAction] = useState<LeaveAction>(null);
    const [holidays, setHolidays] = useState<CompanyHoliday[]>([]);
    const leaveImportLabels = useMemo(
        () => ({
            loadError: labels.leaveImportLoadError,
            saveError: labels.leaveImportSaveError,
        }),
        [labels.leaveImportLoadError, labels.leaveImportSaveError],
    );
    const administrationLabels = useMemo(
        () => ({
            loadError: labels.leaveAdministrationLoadError,
            saveError: labels.leaveAdministrationSaveError,
        }),
        [
            labels.leaveAdministrationLoadError,
            labels.leaveAdministrationSaveError,
        ],
    );
    const leaveImports = useLeaveImports(
        canImportHistory && activeAction === "import",
        leaveImportLabels,
    );
    const administration = useLeaveAdministration(
        {
            canManagePolicy: false,
            canReadAll: false,
            canAdjust: canAdjustBalance && activeAction === "adjust",
        },
        administrationLabels,
    );

    useEffect(() => {
        if (!canImportHistory || activeAction !== "import") return;
        let active = true;
        const year = new Date().getFullYear();
        void Promise.all([
            fetchCompanyHolidays(year, labels.holidaysLoadError),
            fetchCompanyHolidays(year + 1, labels.holidaysLoadError),
        ])
            .then((results) => {
                if (active) setHolidays(results.flat());
            })
            .catch((error) =>
                console.error(
                    "[EmployeeLeaveManagementActions] holidays error:",
                    error,
                ),
            );
        return () => {
            active = false;
        };
    }, [activeAction, canImportHistory, labels.holidaysLoadError]);

    useEffect(() => {
        setActiveAction(null);
    }, [profile.id]);

    if (!canImportHistory && !canAdjustBalance) return null;

    const fixedEmployee = {
        id: profile.id,
        employee_code: profile.employee_code,
        full_name: profile.full_name,
        workplace_warehouse_id: profile.workplace_warehouse_id,
    };

    return (
        <div className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-2">
                {canImportHistory && (
                    <button
                        type="button"
                        onClick={() =>
                            setActiveAction((current) =>
                                current === "import" ? null : "import",
                            )
                        }
                        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
                    >
                        <CalendarPlus size={17} />
                        {labels.leaveImportTitle}
                    </button>
                )}
                {canAdjustBalance && (
                    <button
                        type="button"
                        onClick={() =>
                            setActiveAction((current) =>
                                current === "adjust" ? null : "adjust",
                            )
                        }
                        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100"
                    >
                        <SlidersHorizontal size={17} />
                        {labels.leaveBalanceAdjustmentTitle}
                    </button>
                )}
            </div>

            {activeAction && (
                <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-xs sm:p-4">
                    <div className="mb-3 flex items-start justify-between gap-3">
                        <div>
                            <h4 className="text-sm font-bold text-slate-900">
                                {activeAction === "import"
                                    ? labels.leaveImportTitle
                                    : labels.leaveBalanceAdjustmentTitle}
                            </h4>
                            <p className="mt-0.5 text-xs text-slate-500">
                                {activeAction === "import"
                                    ? labels.leaveImportManualHint
                                    : labels.leaveBalanceAdjustmentHint}
                            </p>
                        </div>
                        <button
                            type="button"
                            aria-label={labels.close}
                            onClick={() => setActiveAction(null)}
                            className="rounded-full p-1.5 text-slate-500 transition hover:bg-slate-100"
                        >
                            <X size={17} />
                        </button>
                    </div>

                    {activeAction === "import" ? (
                        <LeaveHistoryImportManager
                            labels={labels}
                            batches={leaveImports.batches}
                            employeeOptions={[fixedEmployee]}
                            fixedEmployee={fixedEmployee}
                            manualOnly
                            holidays={holidays}
                            preview={leaveImports.preview}
                            loading={leaveImports.isLoading}
                            error={leaveImports.error}
                            onPreview={leaveImports.createPreview}
                            onPreviewManual={leaveImports.createManualPreview}
                            onOpenBatch={leaveImports.openBatch}
                            onCommit={leaveImports.commit}
                        />
                    ) : (
                        <LeaveBalanceAdjustmentManager
                            labels={labels}
                            profiles={[profile]}
                            fixedProfile={profile}
                            loading={administration.isLoading}
                            error={administration.error}
                            onLoadBalance={administration.getBalance}
                            onAdjust={administration.adjustBalance}
                        />
                    )}
                </section>
            )}
        </div>
    );
}
