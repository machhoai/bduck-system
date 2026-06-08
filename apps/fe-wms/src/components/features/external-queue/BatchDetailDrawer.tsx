"use client";

import { useState } from "react";
import {
    X,
    Hash,
    User,
    Calendar,
    FileText,
    CheckCircle,
    XCircle,
    Loader2,
} from "lucide-react";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { useTranslation } from "../../../lib/i18n";
import { externalQueueApi } from "../../../api/externalQueueApi";
import { gooeyToast } from "goey-toast";

interface BatchDetailDrawerProps {
    batchId: string;
    batchData: any;
    onClose: () => void;
    readonly?: boolean;
    onSuccess?: () => void;
}

function Field({
    icon: Icon,
    label,
    value,
}: {
    icon: React.ElementType;
    label: string;
    value: React.ReactNode;
}) {
    return (
        <div className="flex items-start gap-3 py-2.5">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-[var(--color-neutral-50)] text-[var(--color-text-muted)]">
                <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-[var(--color-text-muted)]">{label}</p>
                <p className="mt-0.5 break-all text-sm font-medium text-[var(--color-text-primary)]">
                    {value || "—"}
                </p>
            </div>
        </div>
    );
}

export default function BatchDetailDrawer({
    batchId,
    batchData,
    onClose,
    readonly = false,
    onSuccess,
}: BatchDetailDrawerProps) {
    const { t } = useTranslation();
    const [notes, setNotes] = useState("");
    const [rejectReason, setRejectReason] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [actionType, setActionType] = useState<"approve" | "reject" | null>(null);

    const handleApprove = async () => {
        if (isSubmitting) return;
        setIsSubmitting(true);
        setActionType("approve");

        const itemsToApprove = batchData.items.map((i: any) => ({
            scan_id: i.scan_id,
            quantity: i.quantity
        }));

        const promise = externalQueueApi.approveBatch({
            batch_id: batchId,
            approved_items: itemsToApprove,
            notes: notes || null
        });

        gooeyToast.promise(promise, {
            loading: "Đang duyệt đợt quét...",
            success: "Đã duyệt thành công",
            error: "Đã xảy ra lỗi khi duyệt",
            description: {
                success: "Tất cả thay đổi đã được ghi nhận.",
                error: "Vui lòng thử lại sau.",
            },
            action: {
                error: { label: "Thử lại", onClick: handleApprove }
            }
        });

        try {
            await promise;
            onSuccess?.();
            onClose();
        } catch (error) {
            console.error(error);
        } finally {
            setIsSubmitting(false);
            setActionType(null);
        }
    };

    const handleReject = async () => {
        if (isSubmitting) return;
        if (!rejectReason.trim()) {
            gooeyToast.error("Lỗi", {
                description: "Vui lòng nhập lý do từ chối",
                preset: "snappy",
                timing: { displayDuration: 4000 }
            });
            return;
        }

        setIsSubmitting(true);
        setActionType("reject");

        const promise = externalQueueApi.rejectBatch({
            batch_id: batchId,
            reason: rejectReason
        });

        gooeyToast.promise(promise, {
            loading: "Đang từ chối đợt quét...",
            success: "Đã từ chối thành công",
            error: "Đã xảy ra lỗi khi từ chối",
            description: {
                success: "Đợt quét đã bị từ chối và giải phóng hàng chờ.",
                error: "Vui lòng thử lại sau.",
            },
            action: {
                error: { label: "Thử lại", onClick: handleReject }
            }
        });

        try {
            await promise;
            onSuccess?.();
            onClose();
        } catch (error) {
            console.error(error);
        } finally {
            setIsSubmitting(false);
            setActionType(null);
        }
    };

    if (!batchData) return null;

    return (
        <>
            <div
                className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs transition-opacity"
                onClick={onClose}
            />

            <div className="fixed inset-y-0 right-0 z-50 flex w-[90%] lg:w-2/3 flex-col bg-white shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-[var(--color-border-soft)] px-4 py-4">
                    <div>
                        <h2 className="text-lg font-bold text-[var(--color-text-primary)]">
                            {t.externalQueue?.detail?.title || "Chi tiết đợt quét"}
                        </h2>
                        <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                            {batchId}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg p-2 text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-neutral-100)] hover:text-[var(--color-text-secondary)]"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto">
                    {/* Fields */}
                    <div className="px-4 pt-4">
                        <Field icon={Hash} label="Mã máy POS" value={batchData.integration_client_id} />
                        <Field icon={Calendar} label="Ca làm việc" value={batchData.shift_date} />
                        <Field icon={User} label="Nhân viên" value={batchData.operator_name} />
                        <Field icon={Calendar} label="Thời gian gửi" value={batchData.submitted_at ? format(new Date(batchData.submitted_at), "HH:mm dd/MM/yyyy", { locale: vi }) : "—"} />
                        {batchData.notes && <Field icon={FileText} label="Ghi chú đợt" value={batchData.notes} />}
                        {batchData.reject_reason && <Field icon={XCircle} label="Lý do từ chối" value={batchData.reject_reason} />}
                    </div>

                    {/* Items */}
                    <div className="mt-4 px-4">
                        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                            Danh sách mã hàng ({batchData.items?.length || 0})
                        </h3>
                        
                        <div className="space-y-2">
                            {batchData.items?.map((item: any, idx: number) => (
                                <div key={item.scan_id || idx} className="rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-neutral-50)]/50 px-4 py-3">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-semibold text-[var(--color-text-primary)]">{item.product_id}</p>
                                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--color-text-muted)]">
                                                <span className="flex items-center gap-0.5">
                                                    Mã quét: {item.scan_id}
                                                </span>
                                            </div>
                                        </div>
                                        <p className="flex-shrink-0 text-sm font-semibold text-[var(--color-text-primary)]">
                                            {(item.quantity * (item.unit_price || 0)).toLocaleString()}đ
                                        </p>
                                    </div>
                                    <div className="mt-1.5 text-xs text-[var(--color-text-muted)]">
                                        Số lượng: {item.quantity}
                                        {(item.unit_price || 0) > 0 && <> × {(item.unit_price || 0).toLocaleString()}đ</>}
                                    </div>
                                    {item.scan_type && (
                                        <div className="mt-1 flex items-center gap-2">
                                            <span className="px-2 py-0.5 rounded text-xxs font-medium bg-gray-200 text-gray-700">
                                                {item.scan_type}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        {batchData.total_value > 0 && (
                            <div className="mt-3 flex items-center justify-between rounded-xl bg-[var(--color-status-approved-bg)] px-4 py-3 mb-4">
                                <span className="text-sm font-medium text-[var(--color-status-approved-text)]">Tổng giá trị</span>
                                <span className="text-base font-bold text-[var(--color-brand-primary)]">{batchData.total_value.toLocaleString()}đ</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Actions */}
                {!readonly && (
                    <div className="border-t border-[var(--color-border-soft)] bg-[var(--color-surface-elevated)] px-4 py-4 space-y-3">
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={2}
                            placeholder="Ghi chú phê duyệt (nếu có)"
                            className="w-full rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-neutral-50)] px-4 py-2.5 text-sm outline-none transition-colors"
                        />
                        <textarea
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            rows={2}
                            placeholder="Lý do từ chối (bắt buộc nếu từ chối)"
                            className="w-full rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-neutral-50)] px-4 py-2.5 text-sm outline-none transition-colors"
                        />
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={handleReject}
                                disabled={isSubmitting || !rejectReason.trim()}
                                className="flex-1 flex justify-center items-center gap-2 rounded-xl bg-red-100 px-4 py-3 text-sm font-semibold text-red-600 transition-colors hover:bg-red-200 disabled:opacity-50"
                            >
                                {isSubmitting && actionType === "reject" ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                                Từ chối
                            </button>
                            <button
                                type="button"
                                onClick={handleApprove}
                                disabled={isSubmitting}
                                className="flex-1 flex justify-center items-center gap-2 rounded-xl bg-[var(--color-brand-primary)] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-brand-primary-hover)] disabled:opacity-50"
                            >
                                {isSubmitting && actionType === "approve" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                                Duyệt toàn bộ
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}
