"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Package, Send, ShieldCheck, ShoppingCart, X } from "lucide-react";
import { gooeyToast } from "goey-toast";
import { usePickingSessionData } from "@/hooks/useTaskSessionData";
import { savePickingActuals, completePicking } from "@/hooks/useExportVoucherApi";
import { useTranslation } from "@/lib/i18n";
import { BottomSheet } from "@/components/ui/BottomSheet";
import PickingSessionItemCard from "./PickingSessionItemCard";
import TaskSessionReviewOverlay from "./TaskSessionReviewOverlay";

interface PickingSessionDrawerProps {
    voucherId: string;
    onClose: () => void;
}

export default function PickingSessionDrawer({ voucherId, onClose }: PickingSessionDrawerProps) {
    const { voucherNumber, items: sourceItems, isLoading, exists } = usePickingSessionData(voucherId);
    const { t } = useTranslation();

    const [items, setItems] = useState(sourceItems);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isReviewOpen, setIsReviewOpen] = useState(false);
    const [isConfirmed, setIsConfirmed] = useState(false);

    useEffect(() => {
        setItems((currentItems) =>
            sourceItems.map((sourceItem) => {
                const currentItem = currentItems.find((item) => item.id === sourceItem.id);
                return currentItem
                    ? {
                          ...sourceItem,
                          picked_quantity: currentItem.picked_quantity,
                          notes: currentItem.notes,
                      }
                    : sourceItem;
            }),
        );
    }, [sourceItems]);

    useEffect(() => {
        if (isLoading || exists) return;

        gooeyToast.error(t.pickingSession.voucherNotFound, {
            description: t.pickingSession.voucherNotFoundDescription,
            preset: "snappy",
        });
        onClose();
    }, [exists, isLoading, onClose, t]);

    const updatePickedQty = useCallback((itemId: string, quantity: number) => {
        setItems((currentItems) =>
            currentItems.map((item) => (item.id === itemId ? { ...item, picked_quantity: quantity } : item)),
        );
    }, []);

    const updateItemNotes = useCallback((itemId: string, notes: string) => {
        setItems((currentItems) => currentItems.map((item) => (item.id === itemId ? { ...item, notes } : item)));
    }, []);

    const buildPayload = useCallback(
        () => ({
            items: items.map((item) => ({
                id: item.id,
                picked_quantity: item.picked_quantity,
                notes: item.notes || null,
            })),
            action_time: new Date().toISOString(),
        }),
        [items],
    );

    const handleSaveDraft = useCallback(async () => {
        if (isSaving) return;
        setIsSaving(true);

        try {
            await gooeyToast.promise(savePickingActuals(voucherId, buildPayload()), {
                loading: t.pickingSession.savingDraft,
                success: t.pickingSession.saveDraftSuccess,
                error: t.pickingSession.saveDraftError,
                description: {
                    success: t.pickingSession.saveDraftSuccessDescription,
                    error: t.pickingSession.saveDraftErrorDescription,
                },
                action: {
                    error: {
                        label: t.common.retry,
                        onClick: () => handleSaveDraft(),
                    },
                },
            });
        } catch {
            // toast handles feedback
        } finally {
            setIsSaving(false);
        }
    }, [buildPayload, isSaving, t, voucherId]);

    const handleSubmit = useCallback(async () => {
        if (isSubmitting) return;

        const hasPickedItems = items.some((item) => item.picked_quantity > 0);
        if (!hasPickedItems) {
            gooeyToast.error(t.pickingSession.submitValidationError, {
                description: t.pickingSession.submitValidationDescription,
                preset: "snappy",
            });
            return;
        }

        setIsSubmitting(true);

        const submitAction = async () => {
            await savePickingActuals(voucherId, buildPayload());
            await completePicking(voucherId);
        };

        try {
            const promise = submitAction();

            gooeyToast.promise(promise, {
                loading: t.pickingSession.submitting,
                success: t.pickingSession.submitSuccess,
                error: t.pickingSession.submitError,
                description: {
                    success: t.pickingSession.submitSuccessDescription,
                    error: t.pickingSession.submitErrorDescription,
                },
                action: {
                    error: {
                        label: t.common.retry,
                        onClick: () => handleSubmit(),
                    },
                },
            });

            await promise;
            setIsReviewOpen(false);
            onClose();
        } finally {
            setIsSubmitting(false);
        }
    }, [buildPayload, isSubmitting, items, onClose, t, voucherId]);

    const handleOpenReview = useCallback(() => {
        if (isSubmitting || isSaving) return;
        if (!isConfirmed) return;

        const hasPickedItems = items.some((item) => item.picked_quantity > 0);
        if (!hasPickedItems) {
            gooeyToast.error(t.pickingSession.submitValidationError, {
                description: t.pickingSession.submitValidationDescription,
                preset: "snappy",
            });
            return;
        }

        setIsReviewOpen(true);
    }, [isConfirmed, isSaving, isSubmitting, items, t]);

    const totalRequested = items.reduce((sum, item) => sum + item.quantity, 0);
    const totalPicked = items.reduce((sum, item) => sum + item.picked_quantity, 0);
    const hasOverPicked = items.some((item) => item.picked_quantity > item.quantity);
    const readyItems = items.filter((item) => item.quantity > 0 && item.picked_quantity === item.quantity).length;
    const attentionItems = items.filter(
        (item) => item.picked_quantity === 0 || item.picked_quantity !== item.quantity,
    ).length;
    const progressValue = totalRequested > 0 ? Math.round((totalPicked / totalRequested) * 100) : 0;

    return (
        <>
            <BottomSheet
                isOpen
                onClose={onClose}
                defaultSnap="full"
                zIndex={50}
                headerMode="handle-only"
                contentClassName="flex min-h-0 flex-1 flex-col overflow-hidden"
                desktopClassName="md:inset-0 md:bottom-0 md:h-screen md:max-h-none md:rounded-none md:border-0 md:shadow-none"
            >
                <div className="flex min-h-0 flex-1 flex-col">
                    <div className="border-b border-[var(--color-border-soft)] bg-white px-4 py-3 shadow-sm">
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-3">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-status-export-bg)] text-[var(--color-status-export-text)]">
                                    <Package size={18} />
                                </div>
                                <div className="min-w-0">
                                    <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
                                        {t.pickingSession.title}
                                    </h2>
                                    <p className="truncate text-xs text-[var(--color-text-muted)]">
                                        {voucherNumber || t.common.noData}
                                    </p>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={onClose}
                                disabled={isSubmitting}
                                className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="mt-3 grid gap-2 sm:grid-cols-3">
                            <div className="rounded-2xl border border-[var(--color-border-soft)] bg-[var(--color-surface-card)] p-3">
                                <div className="mb-2 flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                                    <ShoppingCart className="h-3.5 w-3.5" />
                                    {t.pickingSession.progressLabel}
                                </div>
                                <div className="text-lg font-semibold text-[var(--color-text-primary)]">
                                    {progressValue}%
                                </div>
                                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--color-neutral-100)]">
                                    <div
                                        className="h-full rounded-full bg-[var(--color-brand-primary)] transition-all"
                                        style={{
                                            width: `${Math.min(progressValue, 100)}%`,
                                        }}
                                    />
                                </div>
                            </div>

                            <div className="rounded-2xl border border-[var(--color-border-soft)] bg-[var(--color-surface-card)] p-3">
                                <div className="mb-2 flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                    {t.pickingSession.ready}
                                </div>
                                <div className="text-lg font-semibold text-[var(--color-text-primary)]">
                                    {readyItems}
                                    <span className="ml-1 text-sm font-medium text-[var(--color-text-muted)]">
                                        / {items.length}
                                    </span>
                                </div>
                            </div>

                            <div className="rounded-2xl border border-[var(--color-status-pending-border)] bg-[var(--color-status-pending-bg)]/40 p-3">
                                <div className="mb-2 flex items-center gap-2 text-xs text-[var(--color-status-pending-text)]">
                                    <AlertTriangle className="h-3.5 w-3.5" />
                                    {t.pickingSession.attentionItems}
                                </div>
                                <div className="text-lg font-semibold text-[var(--color-text-primary)]">
                                    {attentionItems}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4">
                        {isLoading ? (
                            <div className="space-y-3">
                                {Array.from({ length: 3 }).map((_, index) => (
                                    <div
                                        key={index}
                                        className="h-44 animate-pulse rounded-2xl border border-[var(--color-border-soft)] bg-[var(--color-surface-card)]"
                                    />
                                ))}
                            </div>
                        ) : items.length === 0 ? (
                            <div className="flex flex-col items-center justify-center gap-3 py-20">
                                <Package className="h-8 w-12 text-gray-300" />
                                <p className="text-sm text-gray-400">{t.pickingSession.empty}</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {items.map((item) => (
                                    <PickingSessionItemCard
                                        key={item.id}
                                        item={item}
                                        isSubmitting={isSubmitting}
                                        onQuantityChange={updatePickedQty}
                                        onNotesChange={updateItemNotes}
                                    />
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="border-t border-[var(--color-border-soft)] bg-white px-4 py-3 shadow-inner">
                        <div className="mb-3 flex items-center justify-between text-xs text-[var(--color-text-muted)]">
                            <span>
                                {t.pickingSession.picked}:{" "}
                                <span className="font-semibold text-[var(--color-text-primary)]">{totalPicked}</span>
                                {" / "}
                                <span className="text-[var(--color-text-secondary)]">{totalRequested}</span>
                            </span>
                            {hasOverPicked && (
                                <span className="flex items-center gap-1 text-[var(--color-status-pending-text)]">
                                    <AlertTriangle size={12} />
                                    {t.pickingSession.overPickedSummary}
                                </span>
                            )}
                        </div>

                        <label
                            className={`mb-3 flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 transition-all ${
                                isConfirmed
                                    ? "border-[var(--color-success-border)] bg-[var(--color-success-bg)]/40"
                                    : "border-[var(--color-border-soft)] bg-[var(--color-neutral-50)]"
                            }`}
                        >
                            <input
                                type="checkbox"
                                checked={isConfirmed}
                                onChange={(event) => setIsConfirmed(event.target.checked)}
                                className="mt-0.5 h-4 w-4 cursor-pointer rounded border-[var(--color-border-subtle)] accent-[var(--color-brand-primary)]"
                            />
                            <div className="flex-1">
                                <div className="flex items-center gap-1.5">
                                    <ShieldCheck
                                        className={`h-4 w-4 flex-shrink-0 ${
                                            isConfirmed
                                                ? "text-[var(--color-success-icon)]"
                                                : "text-[var(--color-text-muted)]"
                                        }`}
                                    />
                                    <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                                        {t.pickingSession.confirmData}
                                    </span>
                                </div>
                                <p className="mt-0.5 text-xs leading-relaxed text-[var(--color-text-muted)]">
                                    {t.pickingSession.confirmStatement}
                                </p>
                            </div>
                        </label>

                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={handleSaveDraft}
                                disabled={isSaving || isSubmitting}
                                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[var(--color-border-subtle)] px-4 py-2.5 text-xs font-medium text-[var(--color-text-secondary)] transition-all hover:bg-[var(--color-surface-subtle)] disabled:opacity-50"
                            >
                                {t.pickingSession.saveDraft}
                            </button>
                            <button
                                type="button"
                                onClick={handleOpenReview}
                                disabled={isSubmitting || isSaving || !isConfirmed}
                                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-4 py-2.5 text-xs font-semibold transition-all disabled:opacity-50 ${
                                    isConfirmed
                                        ? "bg-[var(--color-status-export-icon)] text-[var(--color-text-on-dark)] hover:opacity-90 active:scale-[0.98]"
                                        : "cursor-not-allowed bg-[var(--color-neutral-200)] text-[var(--color-text-muted)]"
                                }`}
                            >
                                <Send size={14} />
                                {isSubmitting ? t.pickingSession.processing : t.pickingSession.complete}
                            </button>
                        </div>
                    </div>

                    {isReviewOpen ? (
                        <TaskSessionReviewOverlay
                            title={t.pickingSession.reviewTitle}
                            description={t.pickingSession.reviewDescription}
                            quantityLabel={t.pickingSession.picked}
                            expectedLabel={t.pickingSession.requested}
                            actualLabel={t.pickingSession.picked}
                            diffLabel={t.receiving.diff}
                            confirmLabel={t.pickingSession.confirmSubmit}
                            attentionLabel={t.pickingSession.attentionItems}
                            items={items.map((item) => ({
                                id: item.id,
                                product_name: item.product_name,
                                product_sku: item.product_code,
                                product_barcode: item.product_barcode,
                                product_image_url: item.product_image_url,
                                location_name: item.location_name,
                                expected_quantity: item.quantity,
                                actual_quantity: item.picked_quantity,
                            }))}
                            isSubmitting={isSubmitting}
                            onBack={() => setIsReviewOpen(false)}
                            onClose={() => setIsReviewOpen(false)}
                            onConfirm={handleSubmit}
                        />
                    ) : null}
                </div>
            </BottomSheet>
        </>
    );
}
