"use client";

import type { InvoiceBulkIssuePreview } from "@bduck/shared-types";
import { RefreshCw, Send, TriangleAlert } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { invoiceApi, type InvoiceBulkIssueRunView, type InvoiceIssueRetryCandidate } from "@/api/invoiceApi";
import { ActionOtpModal } from "@/components/shared/ActionOtpModal";
import { useInvoiceBulkDisplayConfig } from "@/hooks/useInvoiceBulkDisplayConfig";
import { useInvoiceBulkIssueProgress } from "@/hooks/useInvoiceBulkIssueProgress";
import { showToast } from "@/utils/toast";

import { BulkIssueConfigurationModal } from "./BulkIssueConfigurationModal";
import { BulkIssueConfirmModal } from "./BulkIssueConfirmModal";
import { BulkIssueProgressCard } from "./BulkIssueProgressCard";
import { bulkIssueTranslations } from "./bulkIssueTranslations";

export function InvoiceBulkIssuePanel({
    warehouseId,
    businessDate,
    selectedIds,
    eligibleCount,
    canIssue,
    canRetry,
    lang,
    onCompleted,
    onIssued,
}: {
    warehouseId: string;
    businessDate: string;
    selectedIds: string[];
    eligibleCount: number;
    canIssue: boolean;
    canRetry: boolean;
    lang: "vi" | "zh";
    onCompleted: () => void;
    onIssued: () => void;
}) {
    const d = bulkIssueTranslations[lang];
    const [preview, setPreview] = useState<InvoiceBulkIssuePreview | null>(null);
    const [previewing, setPreviewing] = useState(false);
    const [showOtp, setShowOtp] = useState(false);
    const [showRetryOtp, setShowRetryOtp] = useState(false);
    const [issuing, setIssuing] = useState(false);
    const [retryingRejected, setRetryingRejected] = useState(false);
    const [run, setRun] = useState<InvoiceBulkIssueRunView | null>(null);
    const [retryJobIds, setRetryJobIds] = useState<string[]>([]);
    const [retryCandidates, setRetryCandidates] = useState<InvoiceIssueRetryCandidate[]>([]);
    const [loadingRetryCandidates, setLoadingRetryCandidates] = useState(false);
    const [lastError, setLastError] = useState<string | null>(null);
    const idempotencyKey = useRef<string | null>(null);
    const completionNotified = useRef(false);
    const trackedJobIds = useMemo(
        () => [...new Set([...(run?.job_ids ?? []), ...retryJobIds])],
        [retryJobIds, run?.job_ids],
    );
    const progress = useInvoiceBulkIssueProgress(trackedJobIds, lang);
    const display = useInvoiceBulkDisplayConfig({
        warehouseId,
        businessDate,
        selectedIds,
        canIssue,
        lang,
        onError: setLastError,
    });

    const loadRetryCandidates = useCallback(async () => {
        if (!warehouseId || !businessDate || !canRetry) {
            setRetryCandidates([]);
            return;
        }
        setLoadingRetryCandidates(true);
        try {
            setRetryCandidates(await invoiceApi.listIssueRetryCandidates(warehouseId, businessDate));
        } catch (candidateError) {
            console.error("[InvoiceBulkIssuePanel] load retry candidates", candidateError);
        } finally {
            setLoadingRetryCandidates(false);
        }
    }, [businessDate, canRetry, warehouseId]);

    useEffect(() => {
        setPreview(null);
        setRun(null);
        setRetryJobIds([]);
        setRetryCandidates([]);
        setLastError(null);
        idempotencyKey.current = null;
        completionNotified.current = false;
    }, [warehouseId, businessDate]);

    useEffect(() => {
        void loadRetryCandidates();
    }, [loadRetryCandidates]);

    useEffect(() => {
        if (!progress.complete || completionNotified.current) return;
        completionNotified.current = true;
        onCompleted();
        void loadRetryCandidates();
    }, [loadRetryCandidates, onCompleted, progress.complete]);

    const startPreview = async () => {
        if (!display.selection || !canIssue || previewing || display.configDirty) return;
        setPreviewing(true);
        setLastError(null);
        try {
            const nextPreview = await invoiceApi.previewBulkIssue(display.selection);
            if (nextPreview.summary.eligible_count === 0) {
                const message = d.noEligibleInvoices;
                setLastError(message);
                showToast.warning(d.noEligibleInvoicesTitle, message);
                return;
            }
            setPreview(nextPreview);
            display.closeConfiguration();
            idempotencyKey.current = crypto.randomUUID();
        } catch (error) {
            console.error("[InvoiceBulkIssuePanel] preview bulk issue", error);
            const message = error instanceof Error ? error.message : d.previewErrorFallback;
            setLastError(message);
            showToast.error(d.previewErrorTitle, message);
        } finally {
            setPreviewing(false);
        }
    };

    const submitOtp = async (otp: string) => {
        if (!display.selection || !preview || !idempotencyKey.current || issuing) return;
        setIssuing(true);
        setLastError(null);
        const operation = invoiceApi.createBulkIssue({
            ...display.selection,
            otp,
            idempotency_key: idempotencyKey.current,
            config_fingerprint: preview.config_fingerprint,
            action_time: new Date().toISOString(),
        });
        try {
            const nextRun = await showToast.promise(operation, {
                loading: d.queuingInvoices,
                success: d.startIssueSuccess,
                error: d.startIssueError,
                successDescription: d.startIssueSuccessDesc,
                errorDescription: (error) => (error instanceof Error ? error.message : "Unknown error"),
                retry: () => void submitOtp(otp),
                retryLabel: d.retry,
            });
            setRun(nextRun);
            completionNotified.current = false;
            setShowOtp(false);
            setPreview(null);
            onIssued();
        } catch (error) {
            console.error("[InvoiceBulkIssuePanel] create bulk issue", error);
            setLastError(error instanceof Error ? error.message : d.issueErrorFallback);
        } finally {
            setIssuing(false);
        }
    };

    const retryRejected = async (otp: string) => {
        if (retryingRejected || retryCandidates.length === 0 || !canRetry) {
            return;
        }
        setRetryingRejected(true);
        setLastError(null);
        try {
            const result = await showToast.promise(
                invoiceApi.retryRejectedIssueItems(
                    warehouseId,
                    otp,
                    retryCandidates.map((item) => ({
                        job_id: item.job_id,
                        item_id: item.item_id,
                    })),
                ),
                {
                    loading: d.retryChecking,
                    success: d.retryStarted,
                    error: d.retryFailed,
                    successDescription: d.retryStartedDescription(retryCandidates.length),
                    errorDescription: (retryError) =>
                        retryError instanceof Error ? retryError.message : d.issueErrorFallback,
                },
            );
            setRetryJobIds([...new Set(result.retried_items.map((item) => item.job_id))]);
            setShowRetryOtp(false);
            setRetryCandidates([]);
            completionNotified.current = false;
            onIssued();
        } catch (retryError) {
            setLastError(retryError instanceof Error ? retryError.message : d.issueErrorFallback);
        } finally {
            setRetryingRejected(false);
        }
    };

    return (
        <>
            <section className="rounded-[var(--radius-lg)] border border-sky-200 bg-sky-50 p-2">
                <div className="flex flex-col gap-2 pl-1 lg:flex-row lg:items-center">
                    <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-sky-950">{d.title}</p>
                        <p className="mt-0.5 text-xs text-sky-800">
                            {d.selectedOrdersCount(selectedIds.length)} · {d.eligibleOrdersCount(eligibleCount)}
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                        <button
                            type="button"
                            disabled={
                                !canIssue || selectedIds.length === 0 || display.loadingConfig || previewing || issuing
                            }
                            onClick={() => void display.startConfiguration("SELECTED")}
                            className="inline-flex h-9 w-fit items-center gap-1.5 rounded-md bg-sky-700 px-3 text-sm font-semibold text-white disabled:opacity-40 hover:bg-sky-800"
                        >
                            <Send size={14} /> {d.issueSelectedBtn}
                        </button>
                        <button
                            type="button"
                            disabled={
                                !canIssue || eligibleCount === 0 || display.loadingConfig || previewing || issuing
                            }
                            onClick={() => void display.startConfiguration("ALL")}
                            className="inline-flex h-9 w-fit items-center gap-1.5 rounded-md border border-sky-300 bg-white px-3 text-sm font-semibold text-sky-800 disabled:opacity-40 hover:bg-slate-50"
                        >
                            {display.loadingConfig || previewing ? (
                                <RefreshCw className="animate-spin" size={14} />
                            ) : (
                                <Send size={14} />
                            )}
                            {d.issueAllBtn}
                        </button>
                    </div>
                </div>

                {previewing && (
                    <div
                        className="mt-2.5 grid animate-pulse grid-cols-2 gap-2 sm:grid-cols-4"
                        aria-label={d.calculating}
                    >
                        {[0, 1, 2, 3].map((item) => (
                            <div key={item} className="h-10 rounded-md bg-sky-100" />
                        ))}
                    </div>
                )}

                {(run || retryCandidates.length > 0 || retryJobIds.length > 0) && (
                    <BulkIssueProgressCard
                        expectedTotal={run?.summary.eligible_count || progress.total || retryCandidates.length}
                        progress={progress}
                        retryCandidates={retryCandidates}
                        loadingRetryCandidates={loadingRetryCandidates}
                        canRetry={canRetry}
                        retrying={retryingRejected}
                        lang={lang}
                        onRetry={() => setShowRetryOtp(true)}
                    />
                )}

                {lastError && (
                    <div className="mt-2.5 flex items-center justify-between gap-2 rounded-md border border-rose-200 bg-rose-50 p-2 text-xxs text-rose-800">
                        <span className="flex items-center gap-1.5">
                            <TriangleAlert size={13} /> {lastError}
                        </span>
                        {display.selection && (
                            <button
                                type="button"
                                onClick={() => void display.startConfiguration(display.selection!.selection_mode)}
                                className="font-bold underline"
                            >
                                {d.retry}
                            </button>
                        )}
                    </div>
                )}
            </section>

            {display.configOpen && (
                <BulkIssueConfigurationModal
                    config={display.displayConfig}
                    itemNameMapping={display.itemNameMapping}
                    itemUnitMapping={display.itemUnitMapping}
                    dirty={display.configDirty}
                    saving={display.savingConfig}
                    previewing={previewing}
                    lang={lang}
                    onItemNameChange={display.changeItemName}
                    onItemUnitChange={display.changeItemUnit}
                    onSave={() => void display.saveDisplayConfig()}
                    onContinue={() => void startPreview()}
                    onCancel={() => !display.savingConfig && !previewing && display.closeConfiguration()}
                />
            )}
            {preview && !showOtp && (
                <BulkIssueConfirmModal
                    preview={preview}
                    lang={lang}
                    onCancel={() => setPreview(null)}
                    onConfirm={() => setShowOtp(true)}
                />
            )}
            {showOtp && (
                <ActionOtpModal
                    title={d.otpTitle}
                    description={d.otpDescription}
                    isSubmitting={issuing}
                    onConfirm={(otp) => void submitOtp(otp)}
                    onCancel={() => !issuing && setShowOtp(false)}
                />
            )}
            {showRetryOtp && (
                <ActionOtpModal
                    title={d.retryOtpTitle}
                    description={d.retryOtpDescription(retryCandidates.length)}
                    isSubmitting={retryingRejected}
                    onConfirm={(otp) => void retryRejected(otp)}
                    onCancel={() => !retryingRejected && setShowRetryOtp(false)}
                />
            )}
        </>
    );
}
