"use client";

import { useEffect, useMemo, useState } from "react";
import {
    AlertCircle,
    Calendar,
    CheckCircle,
    ClipboardList,
    FileText,
    Hash,
    Loader2,
    Package,
    Pencil,
    Save,
    User,
    X,
    XCircle,
} from "lucide-react";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { gooeyToast } from "goey-toast";
import { useTranslation } from "../../../lib/i18n";
import { useUserStore } from "../../../stores/useUserStore";
import { externalQueueApi } from "../../../api/externalQueueApi";

interface BatchDetailDrawerProps {
    batchId: string;
    batchData: any;
    onClose: () => void;
    readonly?: boolean;
    onSuccess?: () => void;
}

function safeDate(value: unknown): Date | null {
    if (!value) return null;
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
    if (typeof value === "string" || typeof value === "number") {
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? null : date;
    }
    if (typeof value === "object") {
        const raw = value as { seconds?: number; _seconds?: number };
        const seconds = raw.seconds ?? raw._seconds;
        return typeof seconds === "number" ? new Date(seconds * 1000) : null;
    }
    return null;
}

function formatDateTime(value: unknown) {
    const date = safeDate(value);
    return date ? format(date, "HH:mm dd/MM/yyyy", { locale: vi }) : "-";
}

function InfoTile({
    icon: Icon,
    label,
    value,
}: {
    icon: React.ElementType;
    label: string;
    value: React.ReactNode;
}) {
    return (
        <div className="flex min-w-0 items-center gap-3 rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-neutral-50)] px-3 py-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white text-[var(--color-brand-primary)] shadow-sm">
                <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
                <p className="text-xxs font-semibold uppercase text-[var(--color-text-muted)]">{label}</p>
                <p className="truncate text-sm font-semibold text-[var(--color-text-primary)]">{value || "-"}</p>
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
    const externalQueueText = (t as any).externalQueue;
    const hasPermission = useUserStore((state) => state.hasPermission);
    const [notes, setNotes] = useState("");
    const [rejectReason, setRejectReason] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [savingScanId, setSavingScanId] = useState<string | null>(null);
    const [actionType, setActionType] = useState<"approve" | "reject" | null>(null);
    const [quantities, setQuantities] = useState<Record<string, number>>({});
    const [savedQuantities, setSavedQuantities] = useState<Record<string, number>>({});

    const canEditQuantity =
        !readonly && hasPermission("external_scan.edit_quantity", batchData?.warehouse_id);

    useEffect(() => {
        const nextQuantities: Record<string, number> = {};
        for (const item of batchData?.items || []) {
            nextQuantities[item.scan_id] = Number(item.quantity || 0);
        }
        setQuantities(nextQuantities);
        setSavedQuantities(nextQuantities);
    }, [batchData]);

    const items = batchData?.items || [];
    const hasUnsavedChanges = items.some(
        (item: any) => quantities[item.scan_id] !== savedQuantities[item.scan_id],
    );
    const totalQuantity = useMemo(
        () => items.reduce((sum: number, item: any) => sum + (quantities[item.scan_id] || 0), 0),
        [items, quantities],
    );
    const totalValue = useMemo(
        () =>
            items.reduce(
                (sum: number, item: any) =>
                    sum + (quantities[item.scan_id] || 0) * (item.unit_price || 0),
                0,
            ),
        [items, quantities],
    );

    const handleSaveQuantity = async (item: any) => {
        if (!canEditQuantity || savingScanId) return;
        const nextQuantity = quantities[item.scan_id];
        if (!Number.isInteger(nextQuantity) || nextQuantity < 0) {
            gooeyToast.error("Số lượng không hợp lệ", {
                description: "Vui lòng nhập số nguyên lớn hơn hoặc bằng 0.",
                preset: "snappy",
            });
            return;
        }

        setSavingScanId(item.scan_id);
        const promise = externalQueueApi.updateQuantity({
            scan_id: item.scan_id,
            quantity: nextQuantity,
            reason: `Điều chỉnh từ ${savedQuantities[item.scan_id]} sang ${nextQuantity} trên hàng chờ ${batchId}`,
        });

        gooeyToast.promise(promise, {
            loading: "Đang lưu số lượng...",
            success: "Đã lưu số lượng",
            error: "Không thể lưu số lượng",
            description: {
                success: "Thay đổi đã được ghi audit log.",
                error: "Vui lòng kiểm tra quyền hoặc tồn khả dụng.",
            },
        });

        try {
            await promise;
            setSavedQuantities((current) => ({
                ...current,
                [item.scan_id]: nextQuantity,
            }));
        } catch (error) {
            console.error(error);
        } finally {
            setSavingScanId(null);
        }
    };

    const handleApprove = async () => {
        if (isSubmitting || hasUnsavedChanges) return;
        setIsSubmitting(true);
        setActionType("approve");

        const itemsToApprove = items.map((item: any) => ({
            scan_id: item.scan_id,
            quantity: savedQuantities[item.scan_id] ?? item.quantity,
        }));

        const promise = externalQueueApi.approveBatch({
            batch_id: batchId,
            approved_items: itemsToApprove,
            notes: notes || null,
        });

        gooeyToast.promise(promise, {
            loading: "Đang duyệt đợt quét...",
            success: "Đã duyệt thành công",
            error: "Đã xảy ra lỗi khi duyệt",
            description: {
                success: "Phiếu xuất đã được tạo từ hàng chờ.",
                error: "Vui lòng thử lại sau.",
            },
            action: {
                error: { label: "Thử lại", onClick: handleApprove },
            },
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
            gooeyToast.error("Thiếu lý do từ chối", {
                description: "Vui lòng nhập lý do trước khi từ chối.",
                preset: "snappy",
            });
            return;
        }

        setIsSubmitting(true);
        setActionType("reject");

        const promise = externalQueueApi.rejectBatch({
            batch_id: batchId,
            reason: rejectReason,
        });

        gooeyToast.promise(promise, {
            loading: "Đang từ chối đợt quét...",
            success: "Đã từ chối thành công",
            error: "Đã xảy ra lỗi khi từ chối",
            description: {
                success: "Hàng giữ đã được hoàn về tồn khả dụng.",
                error: "Vui lòng thử lại sau.",
            },
            action: {
                error: { label: "Thử lại", onClick: handleReject },
            },
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
            <div className="fixed inset-0 z-40 bg-black/35 backdrop-blur-xs" onClick={onClose} />

            <div className="fixed inset-y-0 right-0 z-50 flex w-full flex-col bg-white shadow-2xl sm:w-[92%] xl:w-[980px]">
                <div className="border-b border-[var(--color-border-soft)] px-4 py-4 sm:px-5">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 text-xs font-semibold uppercase text-[var(--color-text-muted)]">
                                <ClipboardList className="h-4 w-4" />
                                Hàng chờ quét sản phẩm
                            </div>
                            <h2 className="mt-1 truncate text-xl font-bold text-[var(--color-text-primary)]">
                                {externalQueueText?.detail?.title || "Chi tiết đợt quét"}
                            </h2>
                            <p className="mt-0.5 truncate text-sm text-[var(--color-text-muted)]">{batchId}</p>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-lg p-2 text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-neutral-100)] hover:text-[var(--color-text-secondary)]"
                            aria-label="Đóng"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                        <InfoTile icon={Hash} label="Máy POS" value={batchData.integration_client_id || batchData.client_id} />
                        <InfoTile icon={Calendar} label="Thời gian gửi" value={formatDateTime(batchData.submitted_at)} />
                        <InfoTile icon={User} label="Nhân viên" value={batchData.operator_name} />
                        <InfoTile icon={Package} label="Tổng hiện tại" value={`${totalQuantity.toLocaleString()} sản phẩm`} />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto bg-[var(--color-surface-subtle)] px-4 py-4 sm:px-5">
                    {canEditQuantity && (
                        <div className="mb-3 flex items-start gap-2 rounded-lg border border-[var(--color-status-pending-border)] bg-[var(--color-status-pending-bg)] px-3 py-2 text-sm text-[var(--color-status-pending-text)]">
                            <Pencil className="mt-0.5 h-4 w-4 shrink-0" />
                            <span>Người có quyền có thể chỉnh số lượng từng dòng. Mỗi lần lưu sẽ ghi audit log trước khi duyệt.</span>
                        </div>
                    )}

                    {hasUnsavedChanges && (
                        <div className="mb-3 flex items-start gap-2 rounded-lg border border-[var(--color-error-border)] bg-[var(--color-error-bg)] px-3 py-2 text-sm text-[var(--color-error-text)]">
                            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                            <span>Còn thay đổi số lượng chưa lưu. Hãy lưu từng dòng trước khi duyệt.</span>
                        </div>
                    )}

                    <div className="overflow-hidden rounded-lg border border-[var(--color-border-subtle)] bg-white">
                        <div className="grid grid-cols-[minmax(0,1.8fr)_110px_130px_150px] gap-3 border-b border-[var(--color-border-soft)] bg-[var(--color-neutral-50)] px-4 py-2 text-xxs font-semibold uppercase text-[var(--color-text-muted)] max-md:hidden">
                            <span>Sản phẩm</span>
                            <span className="text-right">Đơn giá</span>
                            <span className="text-right">Số lượng</span>
                            <span className="text-right">Thành tiền</span>
                        </div>

                        <div className="divide-y divide-[var(--color-border-soft)]">
                            {items.map((item: any, index: number) => {
                                const quantity = quantities[item.scan_id] ?? 0;
                                const savedQuantity = savedQuantities[item.scan_id] ?? item.quantity;
                                const isDirty = quantity !== savedQuantity;
                                const lineTotal = quantity * (item.unit_price || 0);

                                return (
                                    <div
                                        key={item.scan_id || index}
                                        className="grid gap-3 px-4 py-3 md:grid-cols-[minmax(0,1.8fr)_110px_130px_150px] md:items-center"
                                    >
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-semibold text-[var(--color-text-primary)]">
                                                {item.product_id}
                                            </p>
                                            <p className="mt-1 truncate text-xs text-[var(--color-text-muted)]">
                                                Mã quét: {item.scan_id}
                                            </p>
                                        </div>

                                        <div className="text-sm text-[var(--color-text-secondary)] md:text-right">
                                            <span className="md:hidden text-xs text-[var(--color-text-muted)]">Đơn giá: </span>
                                            {(item.unit_price || 0).toLocaleString()}đ
                                        </div>

                                        <div className="flex items-center justify-between gap-2 md:justify-end">
                                            <span className="text-xs text-[var(--color-text-muted)] md:hidden">Số lượng</span>
                                            {canEditQuantity ? (
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="number"
                                                        min={0}
                                                        step={1}
                                                        value={quantity}
                                                        onChange={(event) =>
                                                            setQuantities((current) => ({
                                                                ...current,
                                                                [item.scan_id]: Number(event.target.value),
                                                            }))
                                                        }
                                                        className="h-8 w-20 rounded-md border border-[var(--color-border-subtle)] bg-white px-2 text-right text-sm font-semibold outline-none transition focus:border-[var(--color-border-focus)] focus:ring-2 focus:ring-[var(--color-brand-primary-muted)]"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => handleSaveQuantity(item)}
                                                        disabled={!isDirty || savingScanId === item.scan_id}
                                                        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[var(--color-border-subtle)] text-[var(--color-brand-primary)] transition hover:bg-[var(--color-brand-primary-muted)] disabled:cursor-not-allowed disabled:opacity-40"
                                                        title="Lưu số lượng"
                                                        aria-label="Lưu số lượng"
                                                    >
                                                        {savingScanId === item.scan_id ? (
                                                            <Loader2 className="h-4 w-4 animate-spin" />
                                                        ) : (
                                                            <Save className="h-4 w-4" />
                                                        )}
                                                    </button>
                                                </div>
                                            ) : (
                                                <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                                                    {quantity.toLocaleString()}
                                                </span>
                                            )}
                                        </div>

                                        <div className="text-sm font-semibold text-[var(--color-text-primary)] md:text-right">
                                            <span className="md:hidden text-xs font-medium text-[var(--color-text-muted)]">Thành tiền: </span>
                                            {lineTotal.toLocaleString()}đ
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        <div className="rounded-lg border border-[var(--color-border-soft)] bg-white px-4 py-3">
                            <p className="text-xs font-semibold uppercase text-[var(--color-text-muted)]">Tổng số lượng</p>
                            <p className="mt-1 text-xl font-bold text-[var(--color-text-primary)]">{totalQuantity.toLocaleString()}</p>
                        </div>
                        <div className="rounded-lg border border-[var(--color-border-soft)] bg-white px-4 py-3">
                            <p className="text-xs font-semibold uppercase text-[var(--color-text-muted)]">Tổng giá trị</p>
                            <p className="mt-1 text-xl font-bold text-[var(--color-brand-primary)]">{totalValue.toLocaleString()}đ</p>
                        </div>
                    </div>

                    {batchData.notes && (
                        <div className="mt-3 rounded-lg border border-[var(--color-border-soft)] bg-white px-4 py-3">
                            <div className="flex items-center gap-2 text-xs font-semibold uppercase text-[var(--color-text-muted)]">
                                <FileText className="h-4 w-4" />
                                Ghi chú đợt
                            </div>
                            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{batchData.notes}</p>
                        </div>
                    )}
                </div>

                {!readonly && (
                    <div className="border-t border-[var(--color-border-soft)] bg-white px-4 py-4 sm:px-5">
                        <div className="grid gap-3 lg:grid-cols-2">
                            <textarea
                                value={notes}
                                onChange={(event) => setNotes(event.target.value)}
                                rows={2}
                                placeholder="Ghi chú phê duyệt (nếu có)"
                                className="min-h-20 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-neutral-50)] px-3 py-2 text-sm outline-none transition focus:border-[var(--color-border-focus)] focus:ring-2 focus:ring-[var(--color-brand-primary-muted)]"
                            />
                            <textarea
                                value={rejectReason}
                                onChange={(event) => setRejectReason(event.target.value)}
                                rows={2}
                                placeholder="Lý do từ chối (bắt buộc nếu từ chối)"
                                className="min-h-20 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-neutral-50)] px-3 py-2 text-sm outline-none transition focus:border-[var(--color-border-focus)] focus:ring-2 focus:ring-[var(--color-brand-primary-muted)]"
                            />
                        </div>
                        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                            <button
                                type="button"
                                onClick={handleReject}
                                disabled={isSubmitting || !rejectReason.trim()}
                                className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-[var(--color-error-bg-muted)] px-4 py-3 text-sm font-semibold text-[var(--color-error-text)] transition hover:bg-[var(--color-error-bg)] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {isSubmitting && actionType === "reject" ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                                Từ chối
                            </button>
                            <button
                                type="button"
                                onClick={handleApprove}
                                disabled={isSubmitting || hasUnsavedChanges}
                                className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-[var(--color-brand-primary)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--color-brand-primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {isSubmitting && actionType === "approve" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                                Duyệt hàng chờ
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}
