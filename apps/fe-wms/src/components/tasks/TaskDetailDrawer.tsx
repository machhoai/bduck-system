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
    ShieldAlert,
} from "lucide-react";
import { gooeyToast } from "goey-toast";
import type { ApprovalRecord } from "@bduck/shared-types";
import { useTranslation } from "@/lib/i18n";
import { useTaskDetailData } from "@/hooks/useTaskDetailData";
import { approveRecord, rejectRecord } from "@/hooks/useApprovalApi";
import AttachmentSection from "./AttachmentSection";
import { getStatusStyle } from "@/components/ui/StatusBadge";

interface TaskDetailDrawerProps {
    approval: ApprovalRecord;
    isSelfCreated?: boolean;
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
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-[var(--color-neutral-50)] text-[var(--color-text-muted)]">
                <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-[var(--color-text-muted)]">{label}</p>
                <p className="mt-0.5 break-all text-sm font-medium text-[var(--color-text-primary)]">{value || "—"}</p>
            </div>
        </div>
    );
}

function DetailSkeleton() {
    return (
        <div className="animate-pulse space-y-4 p-4">
            <div className="h-5 w-2/3 rounded bg-[var(--color-skeleton-base)]" />
            <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-[var(--color-neutral-100)]" />
                        <div className="flex-1 space-y-1.5">
                            <div className="h-3 w-16 rounded bg-[var(--color-neutral-100)]" />
                            <div className="h-4 w-40 rounded bg-[var(--color-skeleton-base)]" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ── Main Component ──

export default function TaskDetailDrawer({ approval, isSelfCreated, onClose }: TaskDetailDrawerProps) {
    const { t } = useTranslation();
    const { voucher, items, creatorName, warehouseName, loadingVoucher, loadingItems } = useTaskDetailData(approval);

    const [comment, setComment] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const isLoading = loadingVoucher;

    const isExport = approval.entity_type === "EXPORT_VOUCHER";

    const statusInfo = useMemo(() => {
        if (!voucher) return null;
        const statusMap = isExport
            ? (t as any).exportVoucher?.status || {}
            : t.importVoucher.status;
        const label = statusMap[voucher.status as string] || voucher.status;
        const color = getStatusStyle(voucher.status);
        return { label, color };
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
                <div className={`flex items-center justify-between border-b px-4 py-4 ${isExport ? "border-[var(--color-status-export-border)] bg-[var(--color-status-export-bg)]" : "border-[var(--color-border-soft)]"
                    }`}>
                    <div className="flex items-center gap-3">
                        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${isExport
                                ? "bg-[var(--color-status-export-bg-muted)] text-[var(--color-status-export-text)]"
                                : "bg-[var(--color-success-bg-muted)] text-[var(--color-success-text)]"
                            }`}>
                            {isExport ? <PackageMinus className="h-4.5 w-4.5" /> : <PackagePlus className="h-4.5 w-4.5" />}
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-[var(--color-text-primary)]">{t.tasks.detail.title}</h2>
                            <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                                {voucher?.voucher_number || approval.entity_id?.slice(0, 12) + "..."}
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg p-2 text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-neutral-100)] hover:text-[var(--color-text-secondary)]"
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
                            <FileText className="h-8 w-12 text-[var(--color-neutral-300)]" />
                            <p className="mt-3 text-sm font-medium text-[var(--color-text-muted)]">{t.tasks.detail.notFound}</p>
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
                                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                                    {t.tasks.items.title} ({items.length} {t.tasks.items.productCount})
                                </h3>
                                {loadingItems ? (
                                    <div className="animate-pulse space-y-2">
                                        {Array.from({ length: 3 }).map((_, i) => (
                                            <div key={i} className="rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-neutral-50)]/50 p-3">
                                                <div className="h-4 w-40 rounded bg-[var(--color-skeleton-base)]" />
                                                <div className="mt-2 h-3 w-24 rounded bg-[var(--color-neutral-100)]" />
                                            </div>
                                        ))}
                                    </div>
                                ) : items.length === 0 ? (
                                    <p className="py-4 text-center text-sm text-[var(--color-text-muted)]">{t.tasks.items.empty}</p>
                                ) : (
                                    <div className="space-y-2">
                                        {items.map((item, idx) => (
                                            <div key={item.id || idx} className="rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-neutral-50)]/50 px-4 py-3">
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="min-w-0 flex-1">
                                                        <p className="truncate text-sm font-semibold text-[var(--color-text-primary)]">{item.product_name}</p>
                                                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--color-text-muted)]">
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
                                                                <span className="rounded bg-[var(--color-neutral-100)] px-1.5 py-0.5 text-xxs font-medium text-[var(--color-neutral-600)]">
                                                                    {item.unit}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="text-right flex-shrink-0">
                                                        <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                                                            {formatCurrency(item.expected_quantity * item.unit_price)}đ
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="mt-1.5 text-xs text-[var(--color-text-muted)]">
                                                    {t.tasks.detail.quantity}: {formatCurrency(item.expected_quantity)}
                                                    {item.unit_price > 0 && <> × {formatCurrency(item.unit_price)}đ</>}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Total */}
                                {totalValue > 0 && (
                                    <div className="mt-3 flex items-center justify-between rounded-xl bg-[var(--color-status-approved-bg)] px-4 py-3">
                                        <span className="text-sm font-medium text-[var(--color-status-approved-text)]">{t.tasks.detail.totalValue}</span>
                                        <span className="text-base font-bold text-[var(--color-brand-primary)]">{formatCurrency(totalValue)}đ</span>
                                    </div>
                                )}
                            </div>

                            {/* Attachments */}
                            <AttachmentSection urls={attachmentUrls} t={t} />
                        </>
                    )}
                </div>

                {/* Footer: Approval actions */}
                {!isLoading && voucher && (
                    <div className="border-t border-[var(--color-border-soft)] bg-[var(--color-surface-elevated)] px-4 py-4">
                        {isSelfCreated ? (
                            /* Self-Approval Block Banner */
                            <div className="flex items-start gap-3 rounded-xl border border-[var(--color-status-pending-border)] bg-[var(--color-status-pending-bg)] p-4">
                                <ShieldAlert className="h-5 w-5 flex-shrink-0 text-[var(--color-status-pending-icon)]" />
                                <div>
                                    <p className="text-sm font-semibold text-[var(--color-status-pending-text)]">
                                        {(t.tasks as any).selfApproval?.title ?? "Kh\u00f4ng th\u1ec3 t\u1ef1 ph\u00ea duy\u1ec7t"}
                                    </p>
                                    <p className="mt-0.5 text-xs leading-relaxed text-[var(--color-status-pending-text)]">
                                        {(t.tasks as any).selfApproval?.description ?? "Theo quy \u0111\u1ecbnh ISO 9001 (Segregation of Duties), ng\u01b0\u1eddi t\u1ea1o l\u1ec7nh kh\u00f4ng \u0111\u01b0\u1ee3c ph\u00e9p t\u1ef1 ph\u00ea duy\u1ec7t l\u1ec7nh c\u1ee7a m\u00ecnh. Vui l\u00f2ng ch\u1edd ng\u01b0\u1eddi kh\u00e1c duy\u1ec7t."}
                                    </p>
                                </div>
                            </div>
                        ) : (
                            /* Normal approval actions */
                            <>
                                <textarea
                                    value={comment}
                                    onChange={(e) => setComment(e.target.value)}
                                    rows={2}
                                    placeholder={t.tasks.approval.commentPlaceholder}
                                    className="w-full rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-neutral-50)] px-4 py-2.5 text-sm text-[var(--color-text-primary)] outline-none transition-colors placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-border-focus)] focus:bg-[var(--color-surface-input)] focus:ring-2 focus:ring-[var(--color-brand-primary-muted)]"
                                />
                                <div className="mt-3 flex items-center gap-3">
                                    <button
                                        type="button"
                                        onClick={() => handleDecision(false)}
                                        disabled={isSubmitting}
                                        className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-[var(--color-error-border)] bg-[var(--color-surface-elevated)] px-4 py-3 text-sm font-semibold text-[var(--color-error-text)] transition-all hover:bg-[var(--color-error-bg)] active:bg-[var(--color-error-bg-muted)] disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                                        {t.tasks.approval.reject}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleDecision(true)}
                                        disabled={isSubmitting}
                                        className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[var(--color-accent-success)] px-4 py-3 text-sm font-semibold text-[var(--color-text-on-dark)] shadow-sm transition-all hover:opacity-90 active:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                                        {t.tasks.approval.approve}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>
        </>
    );
}
