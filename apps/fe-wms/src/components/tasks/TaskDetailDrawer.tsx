"use client";

/**
 * TaskDetailDrawer — Slide-over drawer showing voucher detail + approve/reject
 *
 * Flow: Click task card → open drawer → read voucher info → approve or reject
 *
 * LUẬT THÉP:
 * - i18n (vi + zh) via useTranslation
 * - Realtime data via useTaskDetailData hook
 * - Skeleton loading (no spinners)
 * - gooeyToast.promise for API calls
 * - Anti-double-click
 * - Code < 300 lines (sub-components extracted)
 */

import { useState, useCallback, useMemo } from "react";
import {
    X,
    CheckCircle,
    XCircle,
    Package,
    Warehouse,
    User,
    Calendar,
    Hash,
    FileText,
    AlertTriangle,
    ClipboardEdit,
    Loader2,
    Barcode,
    Ruler,
} from "lucide-react";
import { gooeyToast } from "goey-toast";
import { WorkflowNodeType } from "@bduck/shared-types";
import type { WorkflowTask } from "@bduck/shared-types";
import { useTranslation } from "@/lib/i18n";
import { emitDataMutation } from "@/lib/dataInvalidation";
import { useTaskDetailData } from "@/hooks/useTaskDetailData";
import AttachmentSection from "./AttachmentSection";

const API_BASE_URL =
    process.env.NEXT_PUBLIC_API_URL || "http://api.wms.localhost";

interface TaskDetailDrawerProps {
    task: WorkflowTask;
    onClose: () => void;
}

// ── Helpers ──

function formatDate(val: unknown): string {
    if (!val) return "—";
    const d = val instanceof Date ? val : new Date(val as string);
    return d.toLocaleDateString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

function formatCurrency(val: number): string {
    return new Intl.NumberFormat("vi-VN").format(val);
}

// ── Sub-components ──

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
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-gray-50 text-gray-400">
                <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-gray-400">{label}</p>
                <p className="mt-0.5 break-all text-sm font-medium text-gray-900">
                    {value || "—"}
                </p>
            </div>
        </div>
    );
}

function DetailSkeleton() {
    return (
        <div className="animate-pulse space-y-4 p-6">
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
            <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex gap-3 rounded-lg bg-gray-50 p-3">
                        <div className="h-10 w-10 rounded bg-gray-200" />
                        <div className="flex-1 space-y-1.5">
                            <div className="h-3 w-32 rounded bg-gray-200" />
                            <div className="h-3 w-20 rounded bg-gray-100" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ── Main Component ──

export default function TaskDetailDrawer({
    task,
    onClose,
}: TaskDetailDrawerProps) {
    const { t } = useTranslation();
    const {
        voucher,
        items,
        creatorName,
        warehouseName,
        loadingInstance,
        loadingVoucher,
        loadingItems,
    } = useTaskDetailData(task);

    const [comment, setComment] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const isLoading = loadingInstance || loadingVoucher;
    const isApprovalTask = task.node_type === WorkflowNodeType.APPROVAL;

    const statusInfo = useMemo(() => {
        if (!voucher) return null;
        const key = voucher.status as keyof typeof t.importVoucher.status;
        const label = t.importVoucher.status[key] || voucher.status;
        const colorMap: Record<string, string> = {
            DRAFT: "bg-gray-100 text-gray-600",
            PENDING_APPROVAL: "bg-amber-100 text-amber-700",
            APPROVED: "bg-emerald-100 text-emerald-700",
            RECEIVING: "bg-blue-100 text-blue-700",
            COMPLETED: "bg-green-100 text-green-700",
            CANCELLED: "bg-red-100 text-red-600",
            REJECTED: "bg-red-100 text-red-600",
        };
        return { label, color: colorMap[voucher.status] || "bg-gray-100 text-gray-600" };
    }, [voucher, t]);

    const totalValue = useMemo(
        () => items.reduce((sum, item) => sum + item.expected_quantity * item.unit_price, 0),
        [items],
    );

    // ── Approve / Reject ──
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
                const response = await fetch(
                    `${API_BASE_URL}/api/workflows/engine/complete-task`,
                    {
                        method: "POST",
                        credentials: "include",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            instance_id: task.instance_id,
                            task_id: task.id,
                            result: {
                                approved,
                                comments: comment || null,
                                decision_time: new Date().toISOString(),
                            },
                        }),
                    },
                );

                if (!response.ok) {
                    const errorData = await response.json().catch(() => null);
                    throw new Error(errorData?.messages?.vi || "Không thể xử lý yêu cầu.");
                }

                emitDataMutation(["workflow_tasks", "import_vouchers", "audit_logs"]);
                return response.json();
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
        [isSubmitting, comment, task, onClose, t],
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
            <div className="fixed inset-y-0 right-0 z-50 flex w-[90%] lg:w-2/3 flex-col bg-white shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
                    <div>
                        <h2 className="text-lg font-bold text-gray-900">{t.tasks.detail.title}</h2>
                        <p className="mt-0.5 text-xs text-gray-500">
                            {voucher?.voucher_number || task.instance_id?.slice(0, 12) + "..."}
                        </p>
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
                            <FileText className="h-12 w-12 text-gray-300" />
                            <p className="mt-3 text-sm font-medium text-gray-500">
                                {t.tasks.detail.notFound}
                            </p>
                        </div>
                    ) : (
                        <>
                            {/* Status badge */}
                            <div className="px-6 pt-5">
                                {statusInfo && (
                                    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${statusInfo.color}`}>
                                        {statusInfo.label}
                                    </span>
                                )}
                            </div>

                            {/* Fields — names resolved */}
                            <div className="px-6 pt-2">
                                <Field icon={Hash} label={t.tasks.detail.voucherNumber} value={voucher.voucher_number} />
                                <Field icon={Warehouse} label={t.tasks.detail.warehouse} value={warehouseName || voucher.warehouse_id} />
                                <Field icon={Package} label={t.tasks.detail.supplier} value={voucher.supplier_name} />
                                <Field icon={User} label={t.tasks.detail.creator} value={creatorName || voucher.creator_id} />
                                <Field icon={Calendar} label={t.tasks.detail.createdAt} value={formatDate(voucher.created_at)} />
                                {voucher.notes && <Field icon={FileText} label={t.tasks.detail.notes} value={voucher.notes} />}
                            </div>

                            {/* Items — product details */}
                            <div className="mt-4 px-6">
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
                                            <div
                                                key={item.id || idx}
                                                className="rounded-xl border border-gray-100 bg-gray-50/50 px-4 py-3"
                                            >
                                                {/* Product name + SKU */}
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="min-w-0 flex-1">
                                                        <p className="truncate text-sm font-semibold text-gray-900">
                                                            {item.product_name}
                                                        </p>
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
                                                                <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600">
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
                                                {/* Qty × Price */}
                                                <div className="mt-1.5 text-xs text-gray-500">
                                                    {t.tasks.detail.quantity}: {formatCurrency(item.expected_quantity)}
                                                    {item.unit_price > 0 && (
                                                        <> × {formatCurrency(item.unit_price)}đ</>
                                                    )}
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

                            {/* Attachments with file viewer */}
                            <AttachmentSection urls={attachmentUrls} t={t} />

                            {/* Overdue warning */}
                            {task.due_at && new Date(task.due_at as any) < new Date() && (
                                <div className="mx-6 mt-4 mb-4 flex items-center gap-2 rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700">
                                    <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                                    <span className="font-medium">{t.tasks.detail.overdueWarning}</span>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Footer: Approval actions */}
                {isApprovalTask && !isLoading && voucher && (
                    <div className="border-t border-gray-100 bg-white px-6 py-4">
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

                {/* DATA_INPUT footer */}
                {task.node_type === WorkflowNodeType.DATA_INPUT && !isLoading && voucher && (
                    <div className="border-t border-gray-100 bg-white px-6 py-4">
                        <button
                            type="button"
                            className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-700 active:bg-blue-800"
                        >
                            <ClipboardEdit className="h-4 w-4" />
                            {t.tasks.dataInput.openSession}
                        </button>
                    </div>
                )}
            </div>
        </>
    );
}
