"use client";

import { useCallback, useEffect, useState } from "react";
import { gooeyToast } from "goey-toast";
import type { WorkflowTask } from "@bduck/shared-types";
import { useBarcodeScanner } from "@/hooks/useBarcodeScanner";
import { useReceivingSessionData } from "@/hooks/useTaskSessionData";
import { useTranslation } from "@/lib/i18n";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { emitDataMutation } from "@/lib/dataInvalidation";
import { useReceivingStore } from "@/stores/useReceivingStore";
import { createDetailedApiError } from "@/utils/apiError";
import {
    ReceivingSessionFooter,
    ReceivingSessionHeader,
    ReceivingSessionSkeleton,
    ReceivingSessionStatsBar,
} from "./ReceivingSessionChrome";
import ReceivingItemRow from "./ReceivingItemRow";
import TaskSessionReviewOverlay from "./TaskSessionReviewOverlay";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://api.wms.localhost";

interface ReceivingSessionDrawerProps {
    task: WorkflowTask;
    onClose: () => void;
}

export default function ReceivingSessionDrawer({ task, onClose }: ReceivingSessionDrawerProps) {
    const {
        voucherId,
        voucherNumber,
        supplierName,
        items,
        lastSavedAt,
        isSubmitting,
        isConfirmed,
        initSession,
        updateItemQuantity,
        incrementByBarcode,
        updateItemNotes,
        setSubmitting,
        setConfirmed,
        clearSession,
    } = useReceivingStore();
    const {
        voucherId: sourceVoucherId,
        voucherNumber: sourceVoucherNumber,
        supplierName: sourceSupplierName,
        items: sourceItems,
        isLoading,
    } = useReceivingSessionData(task);
    const { t } = useTranslation();

    const [highlightedCode, setHighlightedCode] = useState<string | null>(null);
    const [isReviewOpen, setIsReviewOpen] = useState(false);

    const handleBarcodeScan = useCallback(
        (barcode: string) => {
            const found = incrementByBarcode(barcode);
            if (found) {
                setHighlightedCode(barcode.toUpperCase());
                setTimeout(() => setHighlightedCode(null), 1500);

                gooeyToast.success(t.receiving.barcodeScanned, {
                    description: `${t.tasks.detail.sku}: ${barcode} (+1)`,
                    preset: "snappy",
                    timing: { displayDuration: 2000 },
                });
                return;
            }

            gooeyToast.error(t.receiving.productNotFound, {
                description: t.receiving.barcodeNoMatch.replace("{{barcode}}", barcode),
                preset: "snappy",
                timing: { displayDuration: 4000 },
            });
        },
        [incrementByBarcode, t],
    );

    useBarcodeScanner({
        onScan: handleBarcodeScan,
        enabled: !isSubmitting && !isReviewOpen,
    });

    useEffect(() => {
        if (!sourceVoucherId) return;

        void initSession(sourceVoucherId, sourceVoucherNumber, sourceSupplierName, sourceItems);
    }, [initSession, sourceItems, sourceSupplierName, sourceVoucherId, sourceVoucherNumber]);

    const handleSubmit = useCallback(async () => {
        if (isSubmitting || !voucherId) return;
        setSubmitting(true);

        const submitAction = async () => {
            const actualsRes = await fetch(`${API_BASE_URL}/api/import-vouchers/${voucherId}/actuals`, {
                method: "PUT",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    items: items.map((item) => ({
                        id: item.id,
                        actual_quantity: item.actual_quantity,
                        notes: item.notes || null,
                    })),
                    action_time: new Date().toISOString(),
                }),
            });

            if (!actualsRes.ok) {
                const errorBody = await actualsRes.json().catch(() => null);
                throw createDetailedApiError(actualsRes, errorBody, t.receiving.submitError);
            }

            const completeRes = await fetch(`${API_BASE_URL}/api/import-vouchers/${voucherId}/complete-receiving`, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
            });

            if (!completeRes.ok) {
                const errorBody = await completeRes.json().catch(() => null);
                throw createDetailedApiError(completeRes, errorBody, t.receiving.submitError);
            }

            emitDataMutation(["import_vouchers", "inventory", "workflow_tasks", "audit_logs"]);

            return completeRes.json();
        };

        try {
            const promise = submitAction();

            gooeyToast.promise(promise, {
                loading: t.receiving.submittingResults,
                success: t.receiving.submitSuccess,
                error: t.receiving.submitError,
                description: {
                    success: t.receiving.submitSuccessDescription,
                    error: t.receiving.submitErrorDescription,
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
            clearSession();
            onClose();
        } finally {
            setSubmitting(false);
        }
    }, [clearSession, isSubmitting, items, onClose, setSubmitting, t, voucherId]);

    const handleOpenReview = useCallback(() => {
        if (isSubmitting || !isConfirmed) return;
        if (items.filter((item) => item.actual_quantity > 0).length === 0) return;
        setIsReviewOpen(true);
    }, [isConfirmed, isSubmitting, items]);

    const totalExpected = items.reduce((sum, item) => sum + item.expected_quantity, 0);
    const totalActual = items.reduce((sum, item) => sum + item.actual_quantity, 0);
    const completedItems = items.filter((item) => item.actual_quantity > 0).length;
    const itemsNeedingReview = items.filter(
        (item) => item.actual_quantity === 0 || item.actual_quantity !== item.expected_quantity,
    ).length;

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
                <div className="flex min-h-0 flex-1 flex-col bg-[var(--color-bg-base)]">
                    <ReceivingSessionHeader
                        voucherNumber={voucherNumber || sourceVoucherNumber}
                        supplierName={supplierName || sourceSupplierName}
                        onClose={onClose}
                    />
                    <ReceivingSessionStatsBar
                        completedItems={completedItems}
                        totalItems={items.length}
                        totalActual={totalActual}
                        totalExpected={totalExpected}
                        itemsNeedingReview={itemsNeedingReview}
                        lastSavedAt={lastSavedAt}
                    />

                    <div className="flex-1 overflow-y-auto px-4 py-3">
                        {isLoading ? (
                            <ReceivingSessionSkeleton />
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {items.map((item) => (
                                    <ReceivingItemRow
                                        key={item.id}
                                        item={item}
                                        isHighlighted={
                                            highlightedCode === item.product_barcode.toUpperCase() ||
                                            highlightedCode === item.product_sku.toUpperCase()
                                        }
                                        onQuantityChange={updateItemQuantity}
                                        onNotesChange={updateItemNotes}
                                    />
                                ))}
                            </div>
                        )}
                    </div>

                    <ReceivingSessionFooter
                        isConfirmed={isConfirmed}
                        isSubmitting={isSubmitting}
                        completedItems={completedItems}
                        totalItems={items.length}
                        onConfirmChange={setConfirmed}
                        onClose={onClose}
                        onSubmit={handleOpenReview}
                    />

                    {isReviewOpen ? (
                        <TaskSessionReviewOverlay
                            title={t.receiving.reviewTitle}
                            description={t.receiving.reviewDescription}
                            quantityLabel={t.receiving.quantityCount}
                            expectedLabel={t.receiving.expected}
                            actualLabel={t.receiving.actual}
                            diffLabel={t.receiving.diff}
                            confirmLabel={t.receiving.confirmSubmit}
                            attentionLabel={t.receiving.needReview}
                            items={items.map((item) => ({
                                id: item.id,
                                product_name: item.product_name,
                                product_sku: item.product_sku,
                                product_barcode: item.product_barcode,
                                product_image_url: item.product_image_url,
                                location_name: item.location_name,
                                expected_quantity: item.expected_quantity,
                                actual_quantity: item.actual_quantity,
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
