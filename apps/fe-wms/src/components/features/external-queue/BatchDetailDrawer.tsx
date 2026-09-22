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
    MapPin,
    Package,
    Pencil,
    Save,
    ShieldCheck,
    Trash2,
    User,
    X,
    XCircle,
} from "lucide-react";
import { format, type Locale } from "date-fns";
import { vi, zhCN } from "date-fns/locale";
import { gooeyToast } from "goey-toast";
import { useTranslation } from "../../../lib/i18n";
import { useUserStore } from "../../../stores/useUserStore";
import { externalQueueApi } from "../../../api/externalQueueApi";
import { approveRecord, rejectRecord } from "../../../hooks/useApprovalApi";

interface BatchDetailDrawerProps {
    batchId: string;
    batchData: any;
    onClose: () => void;
    readonly?: boolean;
    onSuccess?: () => void;
}

function safeDate(value: unknown): Date | null {
    if (!value) return null;
    if (value instanceof Date)
        return Number.isNaN(value.getTime()) ? null : value;
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

function formatDateTime(value: unknown, locale: Locale) {
    const date = safeDate(value);
    return date ? format(date, "HH:mm dd/MM/yyyy", { locale }) : "-";
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
        <div className="flex min-w-0 items-center gap-2 rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-neutral-50)] p-2.5 sm:gap-3 sm:px-3 sm:py-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white text-[var(--color-brand-primary)] sm:h-8 sm:w-8">
                <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
                <p className="text-xxs font-semibold uppercase text-[var(--color-text-muted)]">
                    {label}
                </p>
                <p className="truncate text-xs font-semibold text-[var(--color-text-primary)] sm:text-sm">
                    {value || "-"}
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
    const { t, lang } = useTranslation();
    const externalQueueText = (t as any).externalQueue;
    const drawerText = externalQueueText?.detailDrawer;
    const dateLocale = lang === "zh" ? zhCN : vi;
    const hasPermission = useUserStore((state) => state.hasPermission);
    const [notes, setNotes] = useState("");
    const [rejectReason, setRejectReason] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [savingScanId, setSavingScanId] = useState<string | null>(null);
    const [actionType, setActionType] = useState<"approve" | "reject" | null>(
        null,
    );
    const [quantities, setQuantities] = useState<Record<string, number>>({});
    const [savedQuantities, setSavedQuantities] = useState<
        Record<string, number>
    >({});

    const isDraftBatch = batchData?.is_draft || batchData?.status === "QUEUED";
    const isRevisionBatch = batchData?.status === "REVISION_REQUIRED";
    const isWaitingExportApproval =
        batchData?.status === "PENDING_EXPORT_APPROVAL";
    const nextApproval = batchData?.next_approval;
    const nextApprovalRecordId = nextApproval?.actionable_record_id || null;
    const canActOnNextApproval = nextApproval?.can_act === true;
    const nextApprovalRole =
        nextApproval?.role_name || nextApproval?.role_id || null;
    const canEditBatchQuantity = [
        "QUEUED",
        "SUBMITTED",
        "REVISION_REQUIRED",
    ].includes(batchData?.status);
    const canManageQueue =
        !readonly &&
        hasPermission("external_scan.manage_queue", batchData?.warehouse_id);
    const canEditQuantity =
        !readonly &&
        canEditBatchQuantity &&
        (hasPermission("external_scan.edit_quantity", batchData?.warehouse_id) ||
            canManageQueue);
    const canViewPrice = hasPermission(
        "products.price.view",
        batchData?.warehouse_id,
    );
    const isProcessedBatch =
        readonly && !isDraftBatch && !isWaitingExportApproval;
    const isRejectedBatch = batchData?.status === "REJECTED";
    const processedBy =
        batchData?.processed_by_name ||
        batchData?.approved_by_name ||
        batchData?.approved_by;
    const processedAt = batchData?.processed_at || batchData?.approved_at;
    const locationDisplay = [
        batchData?.location_name ||
        batchData?.location_code ||
        batchData?.warehouse_location_id,
        batchData?.warehouse_name ||
        batchData?.warehouse_code ||
        batchData?.warehouse_id,
    ]
        .filter(Boolean)
        .join(" · ");

    useEffect(() => {
        const nextQuantities: Record<string, number> = {};
        for (const item of batchData?.items || []) {
            nextQuantities[item.scan_id] = Number(item.quantity || 0);
        }
        setQuantities(nextQuantities);
        setSavedQuantities(nextQuantities);
    }, [batchData]);

    useEffect(() => {
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape" && !isSubmitting) onClose();
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [isSubmitting, onClose]);

    const items = useMemo(
        () =>
            [...(batchData?.items || [])].sort((a: any, b: any) => {
                const scanTimeA = safeDate(a.scan_time)?.getTime() ?? 0;
                const scanTimeB = safeDate(b.scan_time)?.getTime() ?? 0;
                return scanTimeB - scanTimeA;
            }),
        [batchData],
    );
    const hasUnsavedChanges = items.some(
        (item: any) => quantities[item.scan_id] !== savedQuantities[item.scan_id],
    );
    const totalQuantity = useMemo(
        () =>
            items.reduce(
                (sum: number, item: any) => sum + (quantities[item.scan_id] || 0),
                0,
            ),
        [items, quantities],
    );
    const totalValue = useMemo(
        () =>
            canViewPrice
                ? items.reduce(
                    (sum: number, item: any) =>
                        sum + (quantities[item.scan_id] || 0) * (item.unit_price || 0),
                    0,
                )
                : 0,
        [canViewPrice, items, quantities],
    );

    const itemSummary = useMemo(() => {
        const summary: Record<string, number> = {};
        items.forEach((item: any) => {
            const code =
                item.product_code || item.product_name || item.product_id || "Unknown";
            const qty = quantities[item.scan_id] || 0;
            if (qty > 0) {
                summary[code] = (summary[code] || 0) + qty;
            }
        });
        return Object.entries(summary).sort((a, b) => b[1] - a[1]);
    }, [items, quantities]);

    const handleSaveQuantity = async (item: any) => {
        if (!canEditQuantity || savingScanId) return;
        const nextQuantity = quantities[item.scan_id];
        if (!Number.isInteger(nextQuantity) || nextQuantity < 0) {
            gooeyToast.error(
                drawerText?.messages?.invalidQty || "Số lượng không hợp lệ",
                {
                    description:
                        drawerText?.messages?.invalidQtyDesc ||
                        "Vui lòng nhập số nguyên lớn hơn hoặc bằng 0.",
                    preset: "snappy",
                },
            );
            return;
        }

        setSavingScanId(item.scan_id);
        const promise = externalQueueApi.updateQuantity({
            scan_id: item.scan_id,
            quantity: nextQuantity,
            reason: drawerText?.messages?.adjustReason
                ? drawerText.messages.adjustReason
                    .replace("{{from}}", String(savedQuantities[item.scan_id]))
                    .replace("{{to}}", String(nextQuantity))
                    .replace("{{batchId}}", batchId)
                : `Điều chỉnh từ ${savedQuantities[item.scan_id]} sang ${nextQuantity} trên hàng chờ ${batchId}`,
        });

        gooeyToast.promise(promise, {
            loading: drawerText?.messages?.savingQty || "Đang lưu số lượng...",
            success: drawerText?.messages?.saveQtySuccess || "Đã lưu số lượng",
            error: drawerText?.messages?.saveQtyError || "Không thể lưu số lượng",
            description: {
                success:
                    drawerText?.messages?.saveQtySuccessDesc ||
                    "Thay đổi đã được ghi audit log.",
                error:
                    drawerText?.messages?.saveQtyErrorDesc ||
                    "Vui lòng kiểm tra quyền hoặc tồn khả dụng.",
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

    const handleCancelScan = async (item: any) => {
        if (!canManageQueue || savingScanId) return;
        setSavingScanId(item.scan_id);

        const promise = externalQueueApi.cancelScan({
            scan_id: item.scan_id,
            reason: `Huy muc hang cho ${batchId}`,
        });

        gooeyToast.promise(promise, {
            loading:
                drawerText?.messages?.cancelingScan || "Dang huy muc hang cho...",
            success: drawerText?.messages?.cancelScanSuccess || "Da huy muc hang cho",
            error:
                drawerText?.messages?.cancelScanError || "Khong the huy muc hang cho",
            description: {
                success:
                    drawerText?.messages?.cancelScanSuccessDesc ||
                    "Ton ATP da duoc hoan lai va hanh dong da ghi audit log.",
                error:
                    drawerText?.messages?.cancelScanErrorDesc ||
                    "Vui long kiem tra quyen hoac thu lai sau.",
            },
            action: {
                error: {
                    label: drawerText?.messages?.retry || "Thu lai",
                    onClick: () => handleCancelScan(item),
                },
            },
        });

        try {
            await promise;
            onSuccess?.();
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
        const promise =
            isWaitingExportApproval && nextApprovalRecordId
                ? approveRecord(nextApprovalRecordId, notes || undefined)
                : externalQueueApi.approveBatch({
                    batch_id: batchId,
                    approved_items: items.map((item: any) => ({
                        scan_id: item.scan_id,
                        quantity: savedQuantities[item.scan_id] ?? item.quantity,
                    })),
                    notes: notes || null,
                });

        gooeyToast.promise(promise, {
            loading: drawerText?.messages?.approving || "Đang duyệt đợt quét...",
            success: drawerText?.messages?.approveSuccess || "Đã duyệt thành công",
            error: drawerText?.messages?.approveError || "Đã xảy ra lỗi khi duyệt",
            description: {
                success:
                    drawerText?.messages?.approveSuccessDesc ||
                    "Phiếu xuất đã được tạo từ hàng chờ.",
                error:
                    drawerText?.messages?.approveErrorDesc || "Vui lòng thử lại sau.",
            },
            action: {
                error: {
                    label: drawerText?.messages?.retry || "Thử lại",
                    onClick: handleApprove,
                },
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
            gooeyToast.error(
                drawerText?.messages?.missingRejectReason || "Thiếu lý do từ chối",
                {
                    description:
                        drawerText?.messages?.missingRejectReasonDesc ||
                        "Vui lòng nhập lý do trước khi từ chối.",
                    preset: "snappy",
                },
            );
            return;
        }

        setIsSubmitting(true);
        setActionType("reject");
        const promise =
            isWaitingExportApproval && nextApprovalRecordId
                ? rejectRecord(nextApprovalRecordId, rejectReason)
                : externalQueueApi.rejectBatch({
                    batch_id: batchId,
                    reason: rejectReason,
                });

        gooeyToast.promise(promise, {
            loading: drawerText?.messages?.rejecting || "Đang từ chối đợt quét...",
            success: drawerText?.messages?.rejectSuccess || "Đã từ chối thành công",
            error: drawerText?.messages?.rejectError || "Đã xảy ra lỗi khi từ chối",
            description: {
                success:
                    drawerText?.messages?.rejectSuccessDesc ||
                    "Hàng giữ đã được hoàn về tồn khả dụng.",
                error:
                    drawerText?.messages?.approveErrorDesc || "Vui lòng thử lại sau.",
            },
            action: {
                error: {
                    label: drawerText?.messages?.retry || "Thử lại",
                    onClick: handleReject,
                },
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
            <div
                className="fixed inset-0 z-[100] bg-black/35 backdrop-blur-xs"
                onClick={onClose}
            />

            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="external-queue-detail-title"
                className="fixed inset-0 z-[110] flex h-dvh w-full flex-col overflow-hidden bg-white sm:inset-y-0 sm:left-auto sm:right-0 sm:w-[92%] xl:w-[980px]"
            >
                <div className="shrink-0 border-b border-[var(--color-border-soft)] px-3 py-3 sm:px-5 sm:py-4">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 text-xxs font-semibold uppercase text-[var(--color-text-muted)] sm:text-xs">
                                <ClipboardList className="h-4 w-4" />
                                {drawerText?.hints?.queueProduct || "Hàng chờ quét sản phẩm"}
                            </div>
                            <h2
                                id="external-queue-detail-title"
                                className="mt-1 truncate text-lg font-bold text-[var(--color-text-primary)] sm:text-xl"
                            >
                                {drawerText?.title || "Chi tiết đợt quét"}
                            </h2>
                            <p className="mt-0.5 truncate text-xs text-[var(--color-text-muted)] sm:text-sm">
                                {batchId}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-neutral-100)] hover:text-[var(--color-text-secondary)]"
                            aria-label={drawerText?.messages?.close || "Đóng"}
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:mt-4 xl:grid-cols-6">
                        <InfoTile
                            icon={Hash}
                            label={drawerText?.info?.pos || "Máy POS"}
                            value={batchData.integration_client_id || batchData.client_id}
                        />
                        <InfoTile
                            icon={Calendar}
                            label={drawerText?.info?.time || "Thời gian"}
                            value={formatDateTime(
                                batchData.submitted_at ||
                                batchData.last_scan_time ||
                                batchData.shift_date,
                                dateLocale,
                            )}
                        />
                        <InfoTile
                            icon={User}
                            label={drawerText?.info?.operator || "Nhân viên"}
                            value={
                                Array.isArray(batchData.operator_names)
                                    ? batchData.operator_names.join(", ")
                                    : batchData.operator_name
                            }
                        />
                        <InfoTile
                            icon={Calendar}
                            label="Ca được chốt"
                            value={
                                batchData.shift_id
                                    ? `${batchData.shift_id} · ${batchData.work_shift_date || ""}`
                                    : "-"
                            }
                        />
                        <InfoTile
                            icon={Package}
                            label={drawerText?.info?.currentTotal || "Tổng hiện tại"}
                            value={`${totalQuantity.toLocaleString()} ${drawerText?.info?.totalProducts || "sản phẩm"}`}
                        />
                        <InfoTile
                            icon={MapPin}
                            label={drawerText?.info?.location || "Vị trí"}
                            value={locationDisplay}
                        />
                    </div>
                </div>

                <div className="min-h-0 flex-1 overscroll-contain overflow-y-auto bg-[var(--color-surface-subtle)] px-3 py-3 sm:px-5 sm:py-4">
                    {canEditQuantity && (
                        <div className="mb-3 flex items-start gap-2 rounded-lg border border-[var(--color-status-pending-border)] bg-[var(--color-status-pending-bg)] px-3 py-2 text-xs text-[var(--color-status-pending-text)] sm:text-sm">
                            <Pencil className="mt-0.5 h-4 w-4 shrink-0" />
                            <span>
                                {drawerText?.hints?.canEdit ||
                                    "Người có quyền có thể chỉnh số lượng từng dòng. Mỗi lần lưu sẽ ghi audit log."}
                            </span>
                        </div>
                    )}

                    {isDraftBatch && (
                        <div className="mb-3 flex items-start gap-2 rounded-lg border border-[var(--color-border-soft)] bg-white px-3 py-2 text-xs text-[var(--color-text-secondary)] sm:text-sm">
                            <ClipboardList className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-brand-primary)]" />
                            <span>
                                {drawerText?.hints?.queuedNote ||
                                    "Hàng chờ này đang theo quầy và sẽ được auto-submit. Nhân viên chỉ quét; chỉ người có quyền mới được sửa hoặc hủy dòng."}
                            </span>
                        </div>
                    )}

                    {isRevisionBatch && (
                        <div className="mb-3 flex items-start gap-2 rounded-lg border border-[var(--color-error-border)] bg-[var(--color-error-bg)] px-3 py-2 text-xs text-[var(--color-error-text)] sm:text-sm">
                            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                            <span>
                                {batchData.rejection_reason ||
                                    drawerText?.hints?.revisionRequired ||
                                    "Batch đã bị cấp duyệt sau trả về. Cấp 1 có thể chỉnh số lượng rồi gửi duyệt lại; batch này không còn nhận thêm dữ liệu scan mới."}
                            </span>
                        </div>
                    )}

                    {isWaitingExportApproval && (
                        <div className="mb-3 flex items-start gap-2 rounded-lg border border-[var(--color-status-pending-border)] bg-[var(--color-status-pending-bg)] px-3 py-2 text-xs text-[var(--color-status-pending-text)] sm:text-sm">
                            <FileText className="mt-0.5 h-4 w-4 shrink-0" />
                            <div className="min-w-0">
                                <p>
                                    {drawerText?.hints?.waitingExportApproval ||
                                        "Phiếu xuất đã được tạo và đang chờ cấp duyệt tiếp theo. Chỉ khi duyệt đủ cấp thì tồn kho mới được ghi nhận xuất."}
                                </p>
                                {nextApproval && (
                                    <div className="mt-2 flex min-w-0 items-center gap-2 rounded-md bg-white/65 px-2.5 py-2 font-semibold">
                                        <ShieldCheck className="h-4 w-4 shrink-0" />
                                        <span className="break-words sm:truncate">
                                            {drawerText?.info?.nextApproval || "Cấp duyệt tiếp theo"}:{" "}
                                            {drawerText?.info?.approvalLevel || "Cấp"}{" "}
                                            {nextApproval.level}
                                            {nextApprovalRole ? ` · ${nextApprovalRole}` : ""}
                                            {nextApproval.required_count > 1
                                                ? ` · ${nextApproval.approved_count}/${nextApproval.required_count} ${drawerText?.info?.approvedProgress || "đã duyệt"}`
                                                : ""}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {hasUnsavedChanges && (
                        <div className="mb-3 flex items-start gap-2 rounded-lg border border-[var(--color-error-border)] bg-[var(--color-error-bg)] px-3 py-2 text-xs text-[var(--color-error-text)] sm:text-sm">
                            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                            <span>
                                {drawerText?.hints?.unsavedChanges ||
                                    "Còn thay đổi số lượng chưa lưu. Hãy lưu từng dòng trước khi duyệt."}
                            </span>
                        </div>
                    )}

                    {isProcessedBatch && (
                        <div className="mb-3 rounded-lg border border-[var(--color-border-soft)] bg-white px-4 py-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    {isRejectedBatch ? (
                                        <XCircle className="h-5 w-5 text-[var(--color-error-text)]" />
                                    ) : (
                                        <CheckCircle className="h-5 w-5 text-[var(--color-success-text)]" />
                                    )}
                                    <div>
                                        <p className="text-xs font-semibold uppercase text-[var(--color-text-muted)]">
                                            {drawerText?.processed?.title}
                                        </p>
                                        <p className="text-sm font-bold text-[var(--color-text-primary)]">
                                            {isRejectedBatch
                                                ? drawerText?.processed?.rejected
                                                : drawerText?.processed?.approved}
                                        </p>
                                    </div>
                                </div>
                                {batchData.export_voucher_id && (
                                    <div className="rounded-md bg-[var(--color-neutral-50)] px-3 py-2 text-right">
                                        <p className="text-xxs font-semibold uppercase text-[var(--color-text-muted)]">
                                            {drawerText?.info?.exportVoucher}
                                        </p>
                                        <p className="max-w-[220px] truncate text-sm font-semibold text-[var(--color-text-primary)]">
                                            {batchData.export_voucher_id}
                                        </p>
                                    </div>
                                )}
                            </div>
                            <div className="mt-3 grid gap-2 md:grid-cols-2">
                                <InfoTile
                                    icon={User}
                                    label={
                                        isRejectedBatch
                                            ? drawerText?.info?.rejectedBy
                                            : drawerText?.info?.approvedBy
                                    }
                                    value={processedBy || "-"}
                                />
                                <InfoTile
                                    icon={Calendar}
                                    label={
                                        isRejectedBatch
                                            ? drawerText?.info?.rejectedAt
                                            : drawerText?.info?.approvedAt
                                    }
                                    value={formatDateTime(processedAt, dateLocale)}
                                />
                            </div>
                            {(batchData.rejection_reason || batchData.notes) && (
                                <div className="mt-3 grid gap-2 md:grid-cols-2">
                                    {batchData.rejection_reason && (
                                        <div className="rounded-lg border border-[var(--color-error-border)] bg-[var(--color-error-bg)] px-3 py-2">
                                            <p className="text-xs font-semibold uppercase text-[var(--color-error-text)]">
                                                {drawerText?.info?.rejectionReason}
                                            </p>
                                            <p className="mt-1 text-sm text-[var(--color-error-text)]">
                                                {batchData.rejection_reason}
                                            </p>
                                        </div>
                                    )}
                                    {batchData.notes && (
                                        <div className="rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-neutral-50)] px-3 py-2">
                                            <p className="text-xs font-semibold uppercase text-[var(--color-text-muted)]">
                                                {drawerText?.info?.approveNotes}
                                            </p>
                                            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                                                {batchData.notes}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    <div className="overflow-hidden p-0">
                        <div
                            className={`grid gap-3 border-b border-[var(--color-border-soft)] bg-[var(--color-neutral-50)] px-4 py-2 text-xxs font-semibold uppercase text-[var(--color-text-muted)] max-md:hidden ${canViewPrice ? "grid-cols-[minmax(0,1.8fr)_110px_130px_150px]" : "grid-cols-[minmax(0,1fr)_130px]"}`}
                        >
                            <span>{drawerText?.columns?.product || "Sản phẩm"}</span>
                            {canViewPrice && (
                                <span className="text-right">
                                    {drawerText?.columns?.price || "Đơn giá"}
                                </span>
                            )}
                            <span className="text-right">
                                {drawerText?.columns?.quantity || "Số lượng"}
                            </span>
                            {canViewPrice && (
                                <span className="text-right">
                                    {drawerText?.columns?.total || "Thành tiền"}
                                </span>
                            )}
                        </div>

                        <div className="space-y-2 md:space-y-0 md:divide-y md:divide-[var(--color-border-soft)] md:p-0">
                            {items.map((item: any, index: number) => {
                                const quantity = quantities[item.scan_id] ?? 0;
                                const savedQuantity =
                                    savedQuantities[item.scan_id] ?? item.quantity;
                                const isDirty = quantity !== savedQuantity;
                                const lineTotal = quantity * (item.unit_price || 0);
                                const scanTimeText = formatDateTime(item.scan_time, dateLocale);
                                const itemLocationDisplay =
                                    item.location_name ||
                                    item.location_code ||
                                    item.warehouse_location_id;

                                return (
                                    <div
                                        key={item.scan_id || index}
                                        className={`grid gap-3 rounded-lg border border-[var(--color-border-soft)] bg-white p-3 md:rounded-none md:border-0 md:px-4 md:py-3 md:shadow-none md:items-center ${canViewPrice ? "md:grid-cols-[minmax(0,1.8fr)_110px_130px_150px]" : "md:grid-cols-[minmax(0,1fr)_130px]"}`}
                                    >
                                        <div className="min-w-0">
                                            <p className="break-words text-sm font-semibold text-[var(--color-text-primary)] md:truncate">
                                                {item.product_name ||
                                                    item.product_code ||
                                                    item.product_id}
                                            </p>
                                            <p className="mt-1 break-words text-xs text-[var(--color-text-muted)] md:truncate">
                                                {item.product_code
                                                    ? `Ma SP: ${item.product_code}`
                                                    : `Ma quet: ${item.barcode || item.scan_id}`}
                                                {item.operator_name ? ` · ${item.operator_name}` : ""}
                                            </p>
                                            <p className="mt-0.5 break-words text-xs text-[var(--color-text-muted)] md:truncate">
                                                {drawerText?.info?.scanTime || "Thời gian quét"}:{" "}
                                                {scanTimeText}
                                            </p>
                                            {itemLocationDisplay && (
                                                <p className="mt-0.5 break-words text-xs text-[var(--color-text-muted)] md:truncate">
                                                    {drawerText?.info?.itemLocation}:{" "}
                                                    <span className="font-medium text-[var(--color-text-secondary)]">
                                                        {itemLocationDisplay}
                                                    </span>
                                                </p>
                                            )}
                                            {isDraftBatch && canManageQueue && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleCancelScan(item)}
                                                    disabled={savingScanId === item.scan_id}
                                                    className="mt-2 inline-flex h-8 items-center gap-2 rounded-md border border-[var(--color-error-border)] px-2 text-xs font-semibold text-[var(--color-error-text)] transition hover:bg-[var(--color-error-bg)] disabled:cursor-not-allowed disabled:opacity-50"
                                                >
                                                    {savingScanId === item.scan_id ? (
                                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                    ) : (
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    )}
                                                    {drawerText?.messages?.cancelScan || "Hủy dòng"}
                                                </button>
                                            )}
                                        </div>

                                        {canViewPrice && (
                                            <div className="text-sm text-[var(--color-text-secondary)] md:text-right">
                                                <span className="md:hidden text-xs text-[var(--color-text-muted)]">
                                                    {drawerText?.columns?.price || "Đơn giá"}:{" "}
                                                </span>
                                                {(item.unit_price || 0).toLocaleString()}đ
                                            </div>
                                        )}

                                        <div className="flex items-center justify-between gap-2 md:justify-end">
                                            <span className="text-xs text-[var(--color-text-muted)] md:hidden">
                                                {drawerText?.columns?.quantity || "Số lượng"}
                                            </span>
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
                                                        className="h-11 w-24 rounded-md border border-[var(--color-border-subtle)] bg-white px-2 text-right text-base font-semibold outline-none transition focus:border-[var(--color-border-focus)] focus:ring-2 focus:ring-[var(--color-brand-primary-muted)] md:h-8 md:w-20 md:text-sm"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => handleSaveQuantity(item)}
                                                        disabled={!isDirty || savingScanId === item.scan_id}
                                                        className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-[var(--color-border-subtle)] text-[var(--color-brand-primary)] transition hover:bg-[var(--color-brand-primary-muted)] disabled:cursor-not-allowed disabled:opacity-40 md:h-8 md:w-8"
                                                        title={
                                                            drawerText?.messages?.saveQtyTitle ||
                                                            "Lưu số lượng"
                                                        }
                                                        aria-label={
                                                            drawerText?.messages?.saveQtyTitle ||
                                                            "Lưu số lượng"
                                                        }
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

                                        {canViewPrice && (
                                            <div className="text-sm font-semibold text-[var(--color-text-primary)] md:text-right">
                                                <span className="md:hidden text-xs font-medium text-[var(--color-text-muted)]">
                                                    {drawerText?.columns?.total || "Thành tiền"}:{" "}
                                                </span>
                                                {lineTotal.toLocaleString()}đ
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="mt-3 overflow-hidden rounded-lg border border-[var(--color-border-soft)] bg-white">
                        <div
                            className={`grid gap-px bg-[var(--color-border-soft)] ${canViewPrice ? "grid-cols-2" : "grid-cols-1"}`}
                        >
                            <div className="bg-white px-4 py-3">
                                <p className="text-xxs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                                    {drawerText?.info?.totalQuantity || "Tổng số lượng"}
                                </p>
                                <p className="mt-0.5 text-lg font-bold text-[var(--color-text-primary)]">
                                    {totalQuantity.toLocaleString()}
                                </p>
                            </div>
                            {canViewPrice && (
                                <div className="bg-white px-4 py-3">
                                    <p className="text-xxs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                                        {drawerText?.info?.totalValue || "Tổng giá trị"}
                                    </p>
                                    <p className="mt-0.5 text-lg font-bold text-[var(--color-brand-primary)]">
                                        {totalValue.toLocaleString()}đ
                                    </p>
                                </div>
                            )}
                        </div>

                        {itemSummary.length > 0 && (
                            <div className="border-t border-[var(--color-border-soft)] bg-[var(--color-neutral-50)] px-4 py-3">
                                <p className="mb-2 text-xxs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                                    {drawerText?.info?.itemSummary || "Tóm tắt mã hàng"}
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    {itemSummary.map(([code, qty]) => (
                                        <div
                                            key={code}
                                            className="flex items-center gap-1.5 rounded-md border border-[var(--color-border-subtle)] bg-white px-2 py-1"
                                        >
                                            <span className="text-xs font-semibold text-[var(--color-text-primary)]">
                                                {code}
                                            </span>
                                            <span className="flex h-5 items-center justify-center rounded bg-[var(--color-brand-primary-muted)] px-1.5 text-xs font-bold text-[var(--color-brand-primary)]">
                                                {qty.toLocaleString()}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {batchData.notes && !isProcessedBatch && (
                        <div className="mt-3 rounded-lg border border-[var(--color-border-soft)] bg-white px-4 py-3">
                            <div className="flex items-center gap-2 text-xs font-semibold uppercase text-[var(--color-text-muted)]">
                                <FileText className="h-4 w-4" />
                                {drawerText?.info?.batchNotes || "Ghi chú đợt"}
                            </div>
                            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
                                {batchData.notes}
                            </p>
                        </div>
                    )}
                </div>

                {!readonly && isDraftBatch && (
                    <div className="max-h-[30dvh] shrink-0 overflow-y-auto border-t border-[var(--color-border-soft)] bg-white px-3 py-3 text-xs text-[var(--color-text-secondary)] sm:px-5 sm:py-4 sm:text-sm">
                        {drawerText?.hints?.queuedApproveNote ||
                            "Hàng chờ đang quét không submit thủ công tại màn hình này. Hệ thống sẽ auto-submit theo quầy, sau đó admin có thể duyệt xuất kho."}
                    </div>
                )}

                {!readonly &&
                    !isDraftBatch &&
                    (!isWaitingExportApproval || canActOnNextApproval) && (
                        <div className="max-h-[48dvh] shrink-0 overscroll-contain overflow-y-auto border-t border-[var(--color-border-soft)] bg-white px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 sm:px-5 sm:py-4">
                            <div className="grid gap-2 sm:gap-3 lg:grid-cols-2">
                                <textarea
                                    value={rejectReason}
                                    onChange={(event) => setRejectReason(event.target.value)}
                                    rows={2}
                                    placeholder={
                                        drawerText?.hints?.rejectReasonPlaceholder ||
                                        "Lý do từ chối (bắt buộc nếu từ chối)"
                                    }
                                    className="min-h-16 resize-y rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-neutral-50)] px-3 py-2 text-base outline-none transition focus:border-[var(--color-border-focus)] focus:ring-2 focus:ring-[var(--color-brand-primary-muted)] sm:min-h-20 sm:text-sm"
                                />
                                <textarea
                                    value={notes}
                                    onChange={(event) => setNotes(event.target.value)}
                                    rows={2}
                                    placeholder={
                                        drawerText?.hints?.approveNotesPlaceholder ||
                                        "Ghi chú phê duyệt (nếu có)"
                                    }
                                    className="min-h-16 resize-y rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-neutral-50)] px-3 py-2 text-base outline-none transition focus:border-[var(--color-border-focus)] focus:ring-2 focus:ring-[var(--color-brand-primary-muted)] sm:min-h-20 sm:text-sm"
                                />
                            </div>
                            <div className="mt-2 grid grid-cols-2 gap-2 sm:mt-3">
                                <button
                                    type="button"
                                    onClick={handleReject}
                                    disabled={isSubmitting || !rejectReason.trim()}
                                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[var(--color-error-bg-muted)] px-3 py-2.5 text-sm font-semibold text-[var(--color-error-text)] transition hover:bg-[var(--color-error-bg)] disabled:cursor-not-allowed disabled:opacity-50 sm:px-4 sm:py-3"
                                >
                                    {isSubmitting && actionType === "reject" ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <XCircle className="h-4 w-4" />
                                    )}
                                    {drawerText?.reject || "Từ chối"}
                                </button>
                                <button
                                    type="button"
                                    onClick={handleApprove}
                                    disabled={isSubmitting || hasUnsavedChanges}
                                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[var(--color-brand-primary)] px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--color-brand-primary-hover)] disabled:cursor-not-allowed disabled:opacity-50 sm:px-4 sm:py-3"
                                >
                                    {isSubmitting && actionType === "approve" ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <CheckCircle className="h-4 w-4" />
                                    )}
                                    {drawerText?.approve || "Duyệt hàng chờ"}
                                </button>
                            </div>
                        </div>
                    )}
            </div>
        </>
    );
}
