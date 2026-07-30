"use client";

import type {
    EmployeeProfile,
    LeaveRequest,
    LeaveRequestStatus,
} from "@bduck/shared-types";
import {
    AlertTriangle,
    CalendarDays,
    CheckCircle2,
    Clock3,
    History,
    RefreshCw,
    Umbrella,
} from "lucide-react";
import { useMemo } from "react";

import { useEmployeeDetailLeaveData } from "@/hooks/useEmployeeDetailLeaveData";

import type { EmployeeDetailTabsLabels } from "./employeeDetailTabsTranslations";

const formatLocalDate = (value: string) => {
    const [year, month, day] = value.split("-");
    return year && month && day ? `${day}-${month}-${year}` : value;
};

const statusTone: Record<LeaveRequestStatus, string> = {
    DRAFT: "border-slate-200 bg-slate-50 text-slate-600",
    PENDING_APPROVAL: "border-amber-200 bg-amber-50 text-amber-700",
    APPROVED: "border-emerald-200 bg-emerald-50 text-emerald-700",
    REJECTED: "border-red-200 bg-red-50 text-red-700",
    CANCELLED: "border-slate-200 bg-slate-100 text-slate-500",
    APPROVER_UNAVAILABLE: "border-orange-200 bg-orange-50 text-orange-700",
};

type EmployeeDetailLeaveTabProps = {
    profile: EmployeeProfile;
    labels: EmployeeDetailTabsLabels;
    isSelf: boolean;
    canReadBalance: boolean;
    canReadRequests: boolean;
};

export function EmployeeDetailLeaveTab({
    profile,
    labels,
    isSelf,
    canReadBalance,
    canReadRequests,
}: EmployeeDetailLeaveTabProps) {
    const { balance, requests, balanceError, requestsError, loading, reload } =
        useEmployeeDetailLeaveData({
            profile,
            enabled: true,
            isSelf,
            canReadBalance,
            canReadRequests,
            balanceErrorMessage: labels.leave.balanceError,
            requestsErrorMessage: labels.leave.requestsError,
        });

    const pendingRequests = useMemo(
        () =>
            requests.filter(
                (request) =>
                    request.status === "PENDING_APPROVAL" ||
                    request.status === "APPROVER_UNAVAILABLE",
            ),
        [requests],
    );
    const history = useMemo(
        () =>
            [...requests].sort((left, right) => {
                const leftDate = left.days[0]?.date ?? "";
                const rightDate = right.days[0]?.date ?? "";
                return rightDate.localeCompare(leftDate);
            }),
        [requests],
    );

    return (
        <section
            aria-labelledby="employee-detail-tab-leave"
            className="space-y-4"
            id="employee-detail-panel-leave"
            role="tabpanel"
        >
            <div>
                <h3 className="text-base font-bold text-slate-900">
                    {labels.leave.title}
                </h3>
                <p className="mt-1 text-sm text-slate-500">{labels.leave.subtitle}</p>
            </div>

            {loading && !balance && requests.length === 0 ? (
                <LeaveTabSkeleton />
            ) : (
                <>
                    {canReadBalance && (
                        <div className="space-y-2">
                            {balanceError ? (
                                <ErrorState
                                    label={balanceError}
                                    retryLabel={labels.common.retry}
                                    onRetry={reload}
                                />
                            ) : (
                                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                                    <BalanceCard
                                        icon={<Umbrella className="size-5" />}
                                        label={labels.leave.available}
                                        tone="blue"
                                        value={balance?.available_units ?? 0}
                                    />
                                    <BalanceCard
                                        icon={<Clock3 className="size-5" />}
                                        label={labels.leave.held}
                                        tone="amber"
                                        value={balance?.held_units ?? 0}
                                    />
                                    <BalanceCard
                                        icon={<CheckCircle2 className="size-5" />}
                                        label={labels.leave.used}
                                        tone="green"
                                        value={balance?.used_units ?? 0}
                                    />
                                    <BalanceCard
                                        icon={<CalendarDays className="size-5" />}
                                        label={labels.leave.probation}
                                        tone="slate"
                                        value={balance?.pending_probation_units ?? 0}
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    {canReadRequests && (
                        <>
                            <RequestSection
                                emptyLabel={labels.leave.emptyPending}
                                icon={<Clock3 className="h-4 w-4 text-amber-600" />}
                                labels={labels}
                                requests={pendingRequests}
                                title={labels.leave.pendingTitle}
                            />
                            {requestsError ? (
                                <ErrorState
                                    label={requestsError}
                                    retryLabel={labels.common.retry}
                                    onRetry={reload}
                                />
                            ) : (
                                <RequestSection
                                    emptyLabel={labels.leave.emptyHistory}
                                    icon={<History className="h-4 w-4 text-blue-600" />}
                                    labels={labels}
                                    requests={history}
                                    title={labels.leave.historyTitle}
                                />
                            )}
                        </>
                    )}
                </>
            )}
        </section>
    );
}

function BalanceCard({
    icon,
    label,
    tone,
    value,
}: {
    icon: React.ReactNode;
    label: string;
    tone: "blue" | "amber" | "green" | "slate";
    value: number;
}) {
    const tones = {
        blue: "bg-blue-50 text-blue-700",
        amber: "bg-amber-50 text-amber-700",
        green: "bg-emerald-50 text-emerald-700",
        slate: "bg-slate-100 text-slate-600",
    };
    return (
        <div className="rounded-2xl border flex border-slate-200 bg-white p-3.5 shadow-xs gap-2">
            <div className={`inline-flex rounded-lg aspect-square items-center justify-center p-2 ${tones[tone]}`}>{icon}</div>
            <div>
                <p className="mt-3 text-2xl font-bold tabular-nums text-slate-900">
                    {value}
                </p>
                <p className="mt-0.5 text-xs font-medium text-slate-500">{label}</p>
            </div>
        </div>
    );
}

function RequestSection({
    emptyLabel,
    icon,
    labels,
    requests,
    title,
}: {
    emptyLabel: string;
    icon: React.ReactNode;
    labels: EmployeeDetailTabsLabels;
    requests: LeaveRequest[];
    title: string;
}) {
    return (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
            <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
                {icon}
                <h4 className="text-sm font-bold text-slate-800">{title}</h4>
                <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold tabular-nums text-slate-600">
                    {requests.length}
                </span>
            </div>
            {requests.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-slate-500">
                    {emptyLabel}
                </p>
            ) : (
                <div className="divide-y divide-slate-100">
                    {requests.map((request) => {
                        const firstDay = request.days[0]?.date ?? "";
                        const lastDay =
                            request.days[request.days.length - 1]?.date ?? firstDay;
                        return (
                            <article
                                className="p-4 [content-visibility:auto]"
                                key={request.id}
                            >
                                <div className="flex flex-wrap items-start justify-between gap-2">
                                    <div>
                                        <p className="text-sm font-semibold text-slate-800">
                                            {labels.leave.requestTypes[request.request_type]}
                                        </p>
                                        <p className="mt-1 text-xs text-slate-500">
                                            {labels.leave.fromTo(
                                                formatLocalDate(firstDay),
                                                formatLocalDate(lastDay),
                                            )}
                                            {" · "}
                                            {request.total_units} {labels.common.days}
                                        </p>
                                    </div>
                                    <span
                                        className={`rounded-full border px-2 py-1 text-xs font-semibold ${statusTone[request.status]}`}
                                    >
                                        {labels.leave.statuses[request.status]}
                                    </span>
                                </div>
                                {request.reason && (
                                    <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-slate-600">
                                        {request.reason}
                                    </p>
                                )}
                            </article>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

function ErrorState({
    label,
    retryLabel,
    onRetry,
}: {
    label: string;
    retryLabel: string;
    onRetry: () => void;
}) {
    return (
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span className="flex-1">{label}</span>
            <button
                className="inline-flex items-center gap-1 font-semibold hover:underline"
                onClick={onRetry}
                type="button"
            >
                <RefreshCw className="h-3.5 w-3.5" />
                {retryLabel}
            </button>
        </div>
    );
}

function LeaveTabSkeleton() {
    return (
        <div aria-label="loading" className="space-y-4" role="status">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {Array.from({ length: 4 }, (_, index) => (
                    <div
                        className="h-28 animate-pulse rounded-2xl bg-slate-200"
                        key={index}
                    />
                ))}
            </div>
            <div className="h-48 animate-pulse rounded-2xl bg-slate-200" />
        </div>
    );
}
