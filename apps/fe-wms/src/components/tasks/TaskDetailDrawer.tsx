"use client";

/**
 * TaskDetailDrawer — Slide-over drawer showing voucher detail + approve/reject
 *
 * SIMPLIFIED: Only APPROVAL actions. DATA_INPUT (receiving) is now
 * handled via the Import Voucher page's RECEIVING status, not via tasks.
 *
 * LUẬT THÉP:
 * - i18n (vi + zh) via useTranslation
 * - Realtime data via useTaskDetailData hook
 * - Skeleton loading (no spinners)
 * - gooeyToast.promise for API calls
 * - Anti-double-click
 * - Code < 300 lines
 */

import { useState, useCallback, useMemo } from "react";
import {
    X,
    CheckCircle,
    XCircle,
    Package,
    PackagePlus,
    PackageMinus,
    Warehouse,
    User,
    Calendar,
    Hash,
    FileText,
    Loader2,
    Barcode,
    Ruler,
} from "lucide-react";
import { gooeyToast } from "goey-toast";
import type { ApprovalRecord } from "@bduck/shared-types";
import { useTranslation } from "@/lib/i18n";
import { useTaskDetailData } from "@/hooks/useTaskDetailData";
import { approveRecord, rejectRecord } from "@/hooks/useApprovalApi";
import AttachmentSection from "./AttachmentSection";

interface TaskDetailDrawerProps {
    approval: ApprovalRecord;
    onClose: () => void;
}

// ── Helpers ──

function formatDate(val: unknown): string {
    if (!val) return "—";
    let d: Date;
    if (val instanceof Date) {
        d = val;
    } else if (typeof val === "object" && val !== null && "toDate" in val && typeof (val as Record<string, unknown>).toDate === "function") {
        d = (val as { toDate: () => Date }).toDate();
    } else if (typeof val === "object" && val !== null && "seconds" in val) {
        d = new Date((val as { seconds: number }).seconds * 1000);
    } else {
        d = new Date(val as string);
    }
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    });
}

function formatCurrency(val: number): string {
    return new Intl.NumberFormat("vi-VN").format(val);
}

// ── Sub-components ──

function Field({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: React.ReactNode }) {
    return (
        <div className="flex items-start gap-3 py-2.5">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-gray-50 text-gray-400">
                <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-gray-400">{label}</p>
                <p className="mt-0.5 break-all text-sm font-medium text-gray-900">{value || "—"}</p>
            </div>
        </div>
    );
}

function DetailSkeleton() {
    return (
        <div className="animate-pulse space-y-4 p-4">
            <div className="h-5 w-2/3 rounded bg-gray-200" />
            <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-gray-100" />
                        <div className="flex-1 space-y-1.5">
                            <div className="h-3 w-16 rounded bg-gray-100" />
                            <div className="h-4 w-40 rounded bg-gray-200" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ── Main Component ──

export default function TaskDetailDrawer({ approval, onClose }: TaskDetailDrawerProps) {
    const { t } = useTranslation();
    const { voucher, items, creatorName, warehouseName, loadingVoucher, loadingItems } = useTaskDetailData(approval);

    const [comment, setComment] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const isLoading = loadingVoucher;

    const isExport = approval.entity_type === "EXPORT_VOUCHER";

    const statusInfo = useMemo(() => {
        if (!voucher) return null;
        // Use correct i18n status map based on entity type
        const statusMap = isExport
            ? (t as any).exportVoucher?.status || {}
            : t.importVoucher.status;
        const label = statusMap[voucher.status as string] || voucher.status;
        const colorMap: Record<string, string> = {
            DRAFT: "bg-gray-100 text-gray-600",
            PENDING_APPROVAL: "bg-amber-100 text-amber-700",
            APPROVED: isExport ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700",
            RECEIVING: "bg-blue-100 text-blue-700",
            PICKING: "bg-purple-100 text-purple-700",
            SHIPPED: "bg-teal-100 text-teal-700",
            COMPLETED: "bg-green-100 text-green-700",
            CANCELLED: "bg-red-100 text-red-600",
            REJECTED: "bg-red-100 text-red-600",
        };
        return { label, color: colorMap[voucher.status] || "bg-gray-100 text-gray-600" };
    }, [voucher, t, isExport]);

    const totalValue = useMemo(
        () => items.reduce((sum, item) => sum + item.expected_quantity * item.unit_price, 0),
        [items],
    );

    // ── Approve / Reject via new API ──
    const handleDecision = useCallback(
        async (approved: boolean) => {
            if (isSubmitting) return;
            if (!approved && !comment.trim()) {
                gooeyToast.error(t.tasks.approval.rejectReasonRequired, {
                    description: t.tasks.approval.rejectReasonHint,
                    preset: "snappy",
                    timing: { displayDuration: 4000 },
                });
                return;
            }

            setIsSubmitting(true);

            const submitAction = async () => {
                if (approved) {
                    return approveRecord(approval.id, comment || undefined);
                } else {
                    return rejectRecord(approval.id, comment);
                }
            };

            try {
                await gooeyToast.promise(submitAction(), {
                    loading: approved ? t.tasks.approval.approving : t.tasks.approval.rejecting,
                    success: approved ? t.tasks.approval.approveSuccess : t.tasks.approval.rejectSuccess,
                    error: t.tasks.approval.error,
                    description: {
                        success: t.tasks.approval.updated,
                        error: t.tasks.approval.errorDesc,
                    },
                    action: {
                        error: {
                            label: t.tasks.approval.retry,
                            onClick: () => handleDecision(approved),
                        },
                    },
                });
                onClose();
            } finally {
                setIsSubmitting(false);
            }
        },
        [isSubmitting, comment, approval, onClose, t],
    );

    const attachmentUrls = voucher?.attachment_urls || [];

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs transition-opacity"
                onClick={onClose}
            />

            {/* Drawer */}
            <div className="fixed top-0 right-0 z-50 flex h-[calc(100vh-68px)] md:h-full w-[90%] lg:w-2/3 flex-col bg-white shadow-2xl">
                {/* Header — color-coded by entity type */}
                <div className={`flex items-center justify-between border-b px-4 py-4 ${
                    isExport ? "border-orange-100 bg-orange-50/30" : "border-gray-100"
                }`}>
                    <div className="flex items-center gap-3">
                        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                            isExport ? "bg-orange-100 text-orange-600" : "bg-emerald-100 text-emerald-600"
                        }`}>
                            {isExport ? <PackageMinus className="h-4.5 w-4.5" /> : <PackagePlus className="h-4.5 w-4.5" />}
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-900">{t.tasks.detail.title}</h2>
                            <p className="mt-0.5 text-xs text-gray-500">
                                {voucher?.voucher_number || approval.entity_id?.slice(0, 12) + "..."}
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Content (scrollable) */}
                <div className="flex-1 overflow-y-auto">
                    {isLoading ? (
                        <DetailSkeleton />
                    ) : !voucher ? (
                        <div className="flex flex-col items-center justify-center p-12 text-center">
                            <FileText className="h-8 w-12 text-gray-300" />
                            <p className="mt-3 text-sm font-medium text-gray-500">{t.tasks.detail.notFound}</p>
                        </div>
                    ) : (
                        <>
                            {/* Status badge */}
                            <div className="px-4 pt-5">
                                {statusInfo && (
                                    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${statusInfo.color}`}>
                                        {statusInfo.label}
                                    </span>
                                )}
                            </div>

                            {/* Fields — entity-type-aware */}
                            <div className="px-4 pt-2">
                                <Field icon={Hash} label={t.tasks.detail.voucherNumber} value={voucher.voucher_number} />
                                <Field icon={Warehouse} label={t.tasks.detail.warehouse} value={warehouseName || voucher.warehouse_id} />
                                {isExport ? (
                                    <>
                                        <Field icon={User} label={t.tasks.detail.recipient} value={(voucher as any).recipient_name} />
                                        {(voucher as any).recipient_department && (
                                            <Field icon={Package} label={t.tasks.detail.department} value={(voucher as any).recipient_department} />
                                        )}
                                    </>
                                ) : (
                                    <Field icon={Package} label={t.tasks.detail.supplier} value={voucher.supplier_name} />
                                )}
                                <Field icon={User} label={t.tasks.detail.creator} value={creatorName || voucher.creator_id} />
                                <Field icon={Calendar} label={t.tasks.detail.createdAt} value={formatDate(voucher.created_at)} />
                                {voucher.notes && <Field icon={FileText} label={t.tasks.detail.notes} value={voucher.notes} />}
                            </div>

                            {/* Items */}
                            <div className="mt-4 px-4">
                                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
                                    {t.tasks.items.title} ({items.length} {t.tasks.items.productCount})
                                </h3>
                                {loadingItems ? (
                                    <div className="animate-pulse space-y-2">
                                        {Array.from({ length: 3 }).map((_, i) => (
                                            <div key={i} className="rounded-xl border border-gray-100 bg-gray-50/50 p-3">
                                                <div className="h-4 w-40 rounded bg-gray-200" />
                                                <div className="mt-2 h-3 w-24 rounded bg-gray-100" />
                                            </div>
                                        ))}
                                    </div>
                                ) : items.length === 0 ? (
                                    <p className="py-4 text-center text-sm text-gray-400">{t.tasks.items.empty}</p>
                                ) : (
                                    <div className="space-y-2">
                                        {items.map((item, idx) => (
                                            <div key={item.id || idx} className="rounded-xl border border-gray-100 bg-gray-50/50 px-4 py-3">
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="min-w-0 flex-1">
                                                        <p className="truncate text-sm font-semibold text-gray-900">{item.product_name}</p>
                                                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                                                            {item.product_code && (
                                                                <span className="flex items-center gap-0.5">
                                                                    <Ruler className="h-3 w-3" />
                                                                    {t.tasks.detail.sku}: {item.product_code}
                                                                </span>
                                                            )}
                                                            {item.barcode && (
                                                                <span className="flex items-center gap-0.5">
                                                                    <Barcode className="h-3 w-3" />
                                                                    {item.barcode}
                                                                </span>
                                                            )}
                                                            {item.unit && (
                                                                <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xxs font-medium text-gray-600">
                                                                    {item.unit}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="text-right flex-shrink-0">
                                                        <p className="text-sm font-semibold text-gray-900">
                                                            {formatCurrency(item.expected_quantity * item.unit_price)}đ
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="mt-1.5 text-xs text-gray-500">
                                                    {t.tasks.detail.quantity}: {formatCurrency(item.expected_quantity)}
                                                    {item.unit_price > 0 && <> × {formatCurrency(item.unit_price)}đ</>}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Total */}
                                {totalValue > 0 && (
                                    <div className="mt-3 flex items-center justify-between rounded-xl bg-blue-50 px-4 py-3">
                                        <span className="text-sm font-medium text-blue-700">{t.tasks.detail.totalValue}</span>
                                        <span className="text-base font-bold text-blue-800">{formatCurrency(totalValue)}đ</span>
                                    </div>
                                )}
                            </div>

                            {/* Attachments */}
                            <AttachmentSection urls={attachmentUrls} t={t} />
                        </>
                    )}
                </div>

                {/* Footer: Approval actions (always show — all tasks are approvals) */}
                {!isLoading && voucher && (
                    <div className="border-t border-gray-100 bg-white px-4 py-4">
                        <textarea
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            rows={2}
                            placeholder={t.tasks.approval.commentPlaceholder}
                            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
                        />
                        <div className="mt-3 flex items-center gap-3">
                            <button
                                type="button"
                                onClick={() => handleDecision(false)}
                                disabled={isSubmitting}
                                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-white px-4 py-3 text-sm font-semibold text-red-600 transition-all hover:bg-red-50 active:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                                {t.tasks.approval.reject}
                            </button>
                            <button
                                type="button"
                                onClick={() => handleDecision(true)}
                                disabled={isSubmitting}
                                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-emerald-700 active:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                                {t.tasks.approval.approve}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}
