"use client";

import {
    CheckCircle2,
    RefreshCw,
    ShieldCheck,
    TriangleAlert,
} from "lucide-react";

import type { InvoiceIssueRetryCandidate } from "@/api/invoiceApi";
import type { useInvoiceBulkIssueProgress } from "@/hooks/useInvoiceBulkIssueProgress";

import { bulkIssueTranslations } from "./bulkIssueTranslations";

export function BulkIssueProgressCard({
    expectedTotal,
    progress,
    retryCandidates,
    loadingRetryCandidates,
    canRetry,
    retrying,
    lang,
    onRetry,
}: {
    expectedTotal: number;
    progress: ReturnType<typeof useInvoiceBulkIssueProgress>;
    retryCandidates: InvoiceIssueRetryCandidate[];
    loadingRetryCandidates: boolean;
    canRetry: boolean;
    retrying: boolean;
    lang: "vi" | "zh";
    onRetry: () => void;
}) {
    const d = bulkIssueTranslations[lang];
    const total = progress.total || expectedTotal;
    const percent = total ? (progress.issued / total) * 100 : 0;
    const onlyRejected = progress.total === 0 && retryCandidates.length > 0;

    return (
        <div className="mt-2.5 pl-1">
            <div className="flex items-center justify-between gap-2.5">
                <p className="text-xs font-bold text-slate-900">
                    {onlyRejected
                        ? d.progressRejected
                        : progress.complete
                            ? d.progressCompleted
                            : d.progressProcessing}
                </p>
                <span className="text-xxs font-semibold text-slate-500">
                    {onlyRejected ? retryCandidates.length : `${progress.issued}/${total}`}
                </span>
            </div>
            {!onlyRejected && (
                <>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                        <div
                            className="h-full rounded-full bg-emerald-500 transition-[width] duration-500"
                            style={{ width: `${percent}%` }}
                        />
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-xxs text-slate-600">
                        <span>
                            {progress.issued} {d.statusIssued}
                        </span>
                        <span>
                            {progress.queued + progress.submitting} {d.statusSubmitting}
                        </span>
                        <span>
                            {progress.pending + progress.retrying} {d.statusPendingMisa}
                        </span>
                        <span>
                            {progress.needsAttention} {d.statusPausedForSafety}
                        </span>
                    </div>
                </>
            )}
            {progress.complete && progress.needsAttention === 0 && (
                <p className="mt-2 flex items-center gap-1.5 text-xxs font-semibold text-emerald-700">
                    <CheckCircle2 size={13} /> {d.allProcessed}
                </p>
            )}
            {retryCandidates.length > 0 && (
                <div className="mt-2.5 ">
                    <div className="flex items-start gap-2">
                        <TriangleAlert
                            className="mt-0.5 shrink-0 text-amber-700"
                            size={15}
                        />
                        <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-amber-950">
                                {d.misaRejectedTitle(retryCandidates.length)}
                            </p>
                            <p className="mt-0.5 text-xxs leading-relaxed text-amber-800">
                                {d.misaRejectedDescription}
                            </p>
                            <div className="mt-2 flex flex-wrap gap-1">
                                {retryCandidates.slice(0, 6).map((item) => (
                                    <span
                                        key={`${item.job_id}:${item.item_id}`}
                                        className="rounded-full border border-amber-200 bg-white px-2 py-0.5 text-xxs font-semibold text-amber-900"
                                        title={item.message}
                                    >
                                        {item.order_number ?? item.item_id} · {item.misa_error_code}
                                    </span>
                                ))}
                                {retryCandidates.length > 6 && (
                                    <span className="px-1 py-0.5 text-xxs font-semibold text-amber-800">
                                        +{retryCandidates.length - 6}
                                    </span>
                                )}
                            </div>

                        </div>
                        <button
                            type="button"
                            disabled={!canRetry || retrying || loadingRetryCandidates}
                            onClick={onRetry}
                            className="mt-2 inline-flex w-full h-8 items-center gap-1.5 rounded-md bg-amber-800 px-2.5 text-xs font-bold text-white hover:bg-amber-900 disabled:opacity-45"
                        >
                            {retrying ? (
                                <RefreshCw className="animate-spin" size={13} />
                            ) : (
                                <ShieldCheck size={13} />
                            )}
                            {retrying
                                ? d.retryChecking
                                : d.retryRejectedButton(retryCandidates.length)}
                        </button>
                        <p className="mt-1.5 flex items-center gap-1 text-xxs text-amber-800">
                            {d.retrySafetyNote}
                        </p>
                    </div>
                </div>
            )}
            {total === 0 && (
                <p className="mt-2 text-xxs text-slate-500">{d.noValidInvoices}</p>
            )}
            {progress.error && (
                <p className="mt-2 text-xxs text-rose-700">{progress.error}</p>
            )}
        </div>
    );
}
