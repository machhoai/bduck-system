"use client";

/**
 * VoucherDetailDrawer — Slide-over drawer showing voucher detail + cancel actions
 *
 * Used in: UnifiedInProgressTab (all voucher types)
 * Supports:
 * - Creator cancel (PENDING_APPROVAL only, creator_id match)
 * - Force cancel (any status, requires vouchers.force_cancel permission)
 *
 * LUẬT THÉP:
 * - i18n (vi + zh), skeleton loading, realtime onSnapshot
 * - gooeyToast.promise for API calls
 * - Anti-double-click
 * - Code < 300 lines — data logic inline (simple enough)
 */

import { useEffect, useState, useMemo, useCallback } from "react";
import {
    X,
    Hash,
    Warehouse,
    Package,
    User,
    Calendar,
    FileText,
    Barcode,
    Ruler,
    Ban,
    ShieldAlert,
    Loader2,
    Copy,
    Edit,
    CheckCircle2,
    ClipboardSignature,
} from "lucide-react";
import {
    doc,
    collection,
    query as fsQuery,
    onSnapshot,
    getDoc,
    where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { gooeyToast } from "goey-toast";
import { useTranslation } from "@/lib/i18n";
import { MISC_COMPONENT_TEXT } from "@/lib/i18n/componentTranslations";
import { useUserStore } from "@/stores/useUserStore";
import { cancelApproval, forceCancelApproval } from "@/hooks/useApprovalApi";
import { useProcessConfig } from "@/hooks/useProcessConfig";
import type { ImportVoucher, ProcessEntityType } from "@bduck/shared-types";
import AttachmentSection from "@/components/tasks/AttachmentSection";
import { getStatusStyle } from "@/components/ui/StatusBadge";
import { ActionOtpModal } from "@/components/shared/ActionOtpModal";

interface VoucherDetailDrawerProps {
    voucher: ImportVoucher;
    onClose: () => void;
    onClone?: (data: Record<string, unknown>) => void;
    onEdit?: (data: Record<string, unknown>) => void;
}

// ── Enriched item ──
interface EnrichedItem {
    id: string;
    product_id: string;
    product_name: string;
    product_code: string;
    barcode: string | null;
    unit: string;
    expected_quantity: number;
    actual_quantity: number;
    unit_price: number;
    condition: string;
    notes: string | null;
    warehouse_location_id: string | null;
    source_location_id: string | null;
    destination_location_id: string | null;
    warehouse_location_name: string | null;
    source_location_name: string | null;
    destination_location_name: string | null;
}

// ── Helpers ──

function formatDate(val: unknown): string {
    if (!val) return "—";
    let d: Date;
    if (val instanceof Date) {
        d = val;
    } else if (typeof val === "object" && val !== null && "toDate" in val && typeof (val as any).toDate === "function") {
        d = (val as any).toDate();
    } else if (typeof val === "object" && val !== null && "seconds" in val) {
        d = new Date((val as any).seconds * 1000);
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

// ── Determine entity type from voucher ──
function getEntityType(voucher: ImportVoucher): ProcessEntityType {
    if ("export_type" in voucher || "recipient_name" in voucher) return "EXPORT_VOUCHER";
    if ("transfer_type" in voucher || "source_warehouse_id" in voucher) return "TRANSFER_ORDER";
    return "IMPORT_VOUCHER";
}

// ── Determine Firestore collection from entity type ──
function getCollectionName(entityType: string): string {
    switch (entityType) {
        case "EXPORT_VOUCHER": return "export_vouchers";
        case "TRANSFER_ORDER": return "transfer_orders";
        default: return "import_vouchers";
    }
}

/** Statuses that are terminal — cannot be cancelled */
const TERMINAL_STATUSES = new Set(["CANCELLED", "COMPLETED"]);

export default function VoucherDetailDrawer({
    voucher,
    onClose,
    onClone,
    onEdit,
}: VoucherDetailDrawerProps) {
    const { t, lang } = useTranslation();
    const misc = MISC_COMPONENT_TEXT[lang === "zh" ? "zh" : "vi"];
    const currentUser = useUserStore((s) => s.user);
    const hasPermission = useUserStore((s) => s.hasPermission);

    const [items, setItems] = useState<EnrichedItem[]>([]);
    const [loadingItems, setLoadingItems] = useState(true);
    const [creatorName, setCreatorName] = useState("");
    const [warehouseName, setWarehouseName] = useState("");
    const [cancelReason, setCancelReason] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [legacyApproverName, setLegacyApproverName] = useState("");
    const [approvers, setApprovers] = useState<{ id: string; name: string; approved_at: Date | null }[]>([]);

    const entityType = useMemo(() => getEntityType(voucher), [voucher]);
    const { config: processConfig } = useProcessConfig(entityType, voucher.warehouse_id);
    const [otpAction, setOtpAction] = useState<"cancel" | "forceCancel" | null>(null);
    const collectionName = useMemo(() => getCollectionName(entityType), [entityType]);

    const isCreator = currentUser?.id === voucher.creator_id;
    const isPendingApproval = voucher.status === "PENDING_APPROVAL";
    const canCreatorCancel = isCreator && isPendingApproval;
    const canForceCancel = hasPermission("vouchers.force_cancel") && !TERMINAL_STATUSES.has(voucher.status);
    const canEdit = isCreator && ["DRAFT", "PENDING_APPROVAL", "REJECTED"].includes(voucher.status) && !!onEdit;

    // ── Resolve creator + warehouse + legacy approver names ──
    useEffect(() => {
        if (voucher.creator_id) {
            getDoc(doc(db, "users", voucher.creator_id))
                .then((snap) => {
                    if (snap.exists()) {
                        const u = snap.data();
                        setCreatorName(u?.full_name || u?.email || voucher.creator_id);
                    }
                })
                .catch(() => setCreatorName(voucher.creator_id));
        }
        if (voucher.warehouse_id) {
            getDoc(doc(db, "warehouses", voucher.warehouse_id))
                .then((snap) => {
                    if (snap.exists()) {
                        setWarehouseName(snap.data()?.name || voucher.warehouse_id);
                    }
                })
                .catch(() => setWarehouseName(voucher.warehouse_id));
        }
        if (voucher.approver_id) {
            getDoc(doc(db, "users", voucher.approver_id))
                .then((snap) => {
                    if (snap.exists()) {
                        const u = snap.data();
                        setLegacyApproverName(u?.full_name || u?.email || voucher.approver_id);
                    }
                })
                .catch(() => setLegacyApproverName(voucher.approver_id!));
        }
    }, [voucher.creator_id, voucher.warehouse_id, voucher.approver_id]);

    // ── Load approvers from pending_approvals ──
    useEffect(() => {
        const approvalsQuery = fsQuery(
            collection(db, "pending_approvals"),
            where("entity_id", "==", voucher.id),
            where("status", "==", "APPROVED")
        );

        const unsub = onSnapshot(approvalsQuery, async (snap) => {
            const records = snap.docs.map(d => d.data());
            records.sort((a, b) => (a.level || 0) - (b.level || 0));

            const approverData = await Promise.all(records.map(async (record) => {
                let name = record.approver_id;
                if (record.approver_id) {
                    try {
                        const uSnap = await getDoc(doc(db, "users", record.approver_id));
                        if (uSnap.exists()) {
                            const u = uSnap.data();
                            name = u?.full_name || u?.email || record.approver_id;
                        }
                    } catch { }
                }
                return {
                    id: record.approver_id,
                    name,
                    approved_at: record.approved_at
                };
            }));

            setApprovers(approverData);
        });

        return () => unsub();
    }, [voucher.id]);

    // ── Load items + resolve products ──
    useEffect(() => {
        const itemsQuery = fsQuery(
            collection(db, collectionName, voucher.id, "items"),
        );
        const unsub = onSnapshot(itemsQuery, async (snap) => {
            const rawItems = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
            const enriched: EnrichedItem[] = await Promise.all(
                rawItems.map(async (item: any) => {
                    let productName = item.product_id || "";
                    let productCode = "";
                    let barcode: string | null = null;
                    let unit = "";
                    if (item.product_id) {
                        try {
                            const pSnap = await getDoc(doc(db, "products", item.product_id));
                            if (pSnap.exists()) {
                                const p = pSnap.data();
                                productName = p?.name || item.product_id;
                                productCode = p?.code || "";
                                barcode = p?.barcode || null;
                                unit = p?.unit || "";
                            }
                        } catch { /* fallback to ID */ }
                    }
                    let warehouse_location_name = null;
                    let source_location_name = null;
                    let destination_location_name = null;

                    if (item.warehouse_location_id) {
                        try {
                            const snap = await getDoc(doc(db, "warehouse_locations", item.warehouse_location_id));
                            if (snap.exists()) warehouse_location_name = snap.data()?.name || item.warehouse_location_id;
                        } catch { }
                    }
                    if (item.source_location_id) {
                        try {
                            const snap = await getDoc(doc(db, "warehouse_locations", item.source_location_id));
                            if (snap.exists()) source_location_name = snap.data()?.name || item.source_location_id;
                        } catch { }
                    }
                    if (item.destination_location_id) {
                        try {
                            const snap = await getDoc(doc(db, "warehouse_locations", item.destination_location_id));
                            if (snap.exists()) destination_location_name = snap.data()?.name || item.destination_location_id;
                        } catch { }
                    }

                    return {
                        id: item.id,
                        product_id: item.product_id,
                        product_name: productName,
                        product_code: productCode,
                        barcode,
                        unit,
                        expected_quantity: item.expected_quantity || item.quantity || 0,
                        actual_quantity: item.actual_quantity || item.picked_quantity || item.received_quantity || 0,
                        unit_price: item.unit_price || 0,
                        condition: item.condition || "",
                        notes: item.notes || null,
                        warehouse_location_id: item.warehouse_location_id || null,
                        source_location_id: item.source_location_id || null,
                        destination_location_id: item.destination_location_id || null,
                        warehouse_location_name,
                        source_location_name,
                        destination_location_name,
                    };
                }),
            );
            setItems(enriched);
            setLoadingItems(false);
        });
        return () => unsub();
    }, [voucher.id, collectionName]);

    // ── Cancel by creator ──
    const handleCreatorCancel = useCallback(async (otp?: string) => {
        if (isSubmitting) return;

        if (!cancelReason.trim()) {
            gooeyToast.error(t.tasks.selfApproval.cancelReason, { preset: "snappy" });
            return;
        }

        if (processConfig?.require_otp && !otp) {
            setOtpAction("cancel");
            return;
        }

        setIsSubmitting(true);
        setOtpAction(null);

        const action = async () => {
            await cancelApproval(entityType, voucher.id, cancelReason || undefined, otp);
        };

        try {
            const promise = action();
            gooeyToast.promise(promise, {
                loading: t.tasks.selfApproval.cancelling,
                success: t.tasks.selfApproval.cancelSuccess,
                error: t.tasks.selfApproval.cancelError,
                description: {
                    success: t.tasks.selfApproval.cancelSuccessDesc,
                    error: t.tasks.selfApproval.cancelErrorDesc,
                },
                action: {
                    error: { label: t.tasks.approval.retry, onClick: () => handleCreatorCancel() },
                },
            });
            await promise;
            onClose();
        } finally {
            setIsSubmitting(false);
        }
    }, [isSubmitting, cancelReason, entityType, voucher.id, onClose, t]);

    // ── Force cancel ──
    const handleForceCancel = useCallback(async (otp?: string) => {
        if (isSubmitting) return;
        if (!cancelReason.trim()) {
            gooeyToast.error(t.tasks.selfApproval.cancelError, {
                description: misc.cancelReasonRequired,
                preset: "snappy",
                timing: { displayDuration: 4000 },
            });
            return;
        }

        if (processConfig?.require_otp && !otp) {
            setOtpAction("forceCancel");
            return;
        }

        setIsSubmitting(true);
        setOtpAction(null);

        const action = async () => {
            await forceCancelApproval(entityType, voucher.id, cancelReason, otp);
        };

        try {
            const promise = action();
            gooeyToast.promise(promise, {
                loading: t.tasks.selfApproval.cancelling,
                success: t.tasks.selfApproval.cancelSuccess,
                error: t.tasks.selfApproval.cancelError,
                description: {
                    success: t.tasks.selfApproval.cancelSuccessDesc,
                    error: t.tasks.selfApproval.cancelErrorDesc,
                },
                action: {
                    error: { label: t.tasks.approval.retry, onClick: () => handleForceCancel() },
                },
            });
            await promise;
            onClose();
        } finally {
            setIsSubmitting(false);
        }
    }, [isSubmitting, cancelReason, entityType, voucher.id, onClose, t]);

    const statusKey = voucher.status as keyof typeof t.importVoucher.status;
    const statusLabel = t.importVoucher.status[statusKey] || voucher.status;
    const statusColor = getStatusStyle(voucher.status);

    const totalValue = useMemo(
        () => items.reduce((sum, i) => sum + i.expected_quantity * i.unit_price, 0),
        [items],
    );

    const attachmentUrls = voucher.attachment_urls || [];
    const showCancelSection = canCreatorCancel || canForceCancel;

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
                            {t.vouchers.detail.title}
                        </h2>
                        <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                            {voucher.voucher_number}
                        </p>
                    </div>
                    <div className="flex items-center gap-1">
                        {canEdit && onEdit && (
                            <button
                                type="button"
                                onClick={() => {
                                    const editData = {
                                        ...voucher,
                                        type: entityType.split('_')[0],
                                        items: items
                                    };
                                    onEdit(editData);
                                    onClose();
                                }}
                                className="flex items-center gap-1.5 rounded-lg border border-[var(--color-border-subtle)] px-3 py-2 text-xs font-semibold text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-neutral-100)]"
                                title="Sửa lệnh này"
                            >
                                <Edit className="h-4 w-4" />
                                Sửa
                            </button>
                        )}
                        {onClone && (
                            <button
                                type="button"
                                onClick={() => {
                                    const cloneData = {
                                        ...voucher,
                                        type: entityType.split('_')[0],
                                        items: items
                                    };
                                    onClone(cloneData);
                                    onClose();
                                }}
                                className="flex items-center gap-1.5 rounded-lg border border-[var(--color-border-subtle)] px-3 py-2 text-xs font-semibold text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-neutral-100)]"
                                title="Copy lệnh này"
                            >
                                <Copy className="h-4 w-4" />
                                Copy
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-lg p-2 text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-neutral-100)] hover:text-[var(--color-text-secondary)]"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto">
                    {/* Status */}
                    <div className="px-4 pt-5">
                        <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${statusColor}`}>
                            {statusLabel}
                        </span>
                    </div>

                    {/* Fields */}
                    <div className="px-4 pt-2">
                        <Field icon={Hash} label={t.tasks.detail.voucherNumber} value={voucher.voucher_number} />
                        <Field icon={Warehouse} label={t.tasks.detail.warehouse} value={warehouseName || voucher.warehouse_id} />
                        {entityType === "EXPORT_VOUCHER" ? (
                            <Field icon={User} label={t.tasks.detail.recipient || "Người nhận"} value={(voucher as any).recipient_name} />
                        ) : entityType === "IMPORT_VOUCHER" ? (
                            <Field icon={Package} label={t.tasks.detail.supplier} value={voucher.supplier_name} />
                        ) : null}
                        <Field icon={User} label={t.tasks.detail.creator} value={creatorName || voucher.creator_id} />
                        <Field icon={Calendar} label={t.tasks.detail.createdAt} value={formatDate(voucher.created_at)} />

                        {voucher.status === "COMPLETED" && (
                            <Field icon={CheckCircle2} label={(t as any).tasks?.detail?.completedAt || "Ngày hoàn thành"} value={formatDate(voucher.updated_at)} />
                        )}

                        {approvers.length > 0 ? (
                            <div className="flex flex-col gap-1 py-2.5">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-[var(--color-neutral-50)] text-[var(--color-text-muted)]">
                                        <ClipboardSignature className="h-4 w-4" />
                                    </div>
                                    <p className="text-xs font-medium text-[var(--color-text-muted)]">
                                        {(t as any).tasks?.detail?.approvers || "Người duyệt"}
                                    </p>
                                </div>
                                <div className="pl-11 mt-1 space-y-1">
                                    {approvers.map((appr, idx) => (
                                        <div key={idx} className="flex items-center justify-between text-sm">
                                            <span className="font-medium text-[var(--color-text-primary)]">{appr.name}</span>
                                            <span className="text-xs text-[var(--color-text-muted)]">{formatDate(appr.approved_at)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            voucher.approver_id && <Field icon={ClipboardSignature} label={(t as any).tasks?.detail?.approver || "Người duyệt"} value={legacyApproverName || voucher.approver_id} />
                        )}

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
                                            <p className="flex-shrink-0 text-sm font-semibold text-[var(--color-text-primary)]">
                                                {formatCurrency(item.expected_quantity * item.unit_price)}đ
                                            </p>
                                        </div>
                                        <div className="mt-1.5 text-xs text-[var(--color-text-muted)]">
                                            {t.tasks.detail.quantity}: {formatCurrency(item.expected_quantity)}
                                            {item.unit_price > 0 && <> × {formatCurrency(item.unit_price)}đ</>}
                                        </div>

                                        {(item.warehouse_location_name || item.source_location_name || item.destination_location_name) && (
                                            <div className="mt-1 flex flex-col gap-0.5 text-xs text-[var(--color-text-secondary)]">
                                                {entityType === "IMPORT_VOUCHER" && item.warehouse_location_name && (
                                                    <span>{misc.importLocation} <span className="font-medium text-[var(--color-text-primary)]">{item.warehouse_location_name}</span></span>
                                                )}
                                                {entityType === "TRANSFER_ORDER" && (item.source_location_name || item.destination_location_name) && (
                                                    <span>
                                                        Từ: <span className="font-medium text-[var(--color-text-primary)]">{item.source_location_name || "—"}</span>
                                                        {" → "}
                                                        Đến: <span className="font-medium text-[var(--color-text-primary)]">{item.destination_location_name || "—"}</span>
                                                    </span>
                                                )}
                                                {entityType === "EXPORT_VOUCHER" && item.warehouse_location_name && (
                                                    <span>{misc.exportLocation} <span className="font-medium text-[var(--color-text-primary)]">{item.warehouse_location_name}</span></span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        {totalValue > 0 && (
                            <div className="mt-3 flex items-center justify-between rounded-xl bg-[var(--color-status-approved-bg)] px-4 py-3">
                                <span className="text-sm font-medium text-[var(--color-status-approved-text)]">{t.tasks.detail.totalValue}</span>
                                <span className="text-base font-bold text-[var(--color-brand-primary)]">{formatCurrency(totalValue)}đ</span>
                            </div>
                        )}
                    </div>

                    {/* Attachments */}
                    <AttachmentSection urls={attachmentUrls} t={t} />

                    {/* Bottom spacing */}
                    <div className="h-6" />
                </div>

                {/* Footer: Cancel actions */}
                {showCancelSection && (
                    <div className="border-t border-[var(--color-border-soft)] bg-[var(--color-surface-elevated)] px-4 py-4">
                        <div className="space-y-3">
                            {/* Info banner for creator cancel */}
                            {canCreatorCancel && !canForceCancel && (
                                <div className="flex items-start gap-3 rounded-xl border border-[var(--color-status-pending-border)] bg-[var(--color-status-pending-bg)] p-3">
                                    <ShieldAlert className="h-5 w-5 flex-shrink-0 text-[var(--color-status-pending-icon)]" />
                                    <p className="text-xs leading-relaxed text-[var(--color-status-pending-text)]">
                                        {t.tasks.selfApproval.description}
                                    </p>
                                </div>
                            )}

                            {/* Info banner for force cancel */}
                            {canForceCancel && !canCreatorCancel && (
                                <div className="flex items-start gap-3 rounded-xl border border-[var(--color-error-border)] bg-[var(--color-error-bg)] p-3">
                                    <ShieldAlert className="h-5 w-5 flex-shrink-0 text-[var(--color-error-text)]" />
                                    <p className="text-xs leading-relaxed text-[var(--color-error-text)]">
                                        {t.tasks.selfApproval.forceCancelDescription}
                                    </p>
                                </div>
                            )}

                            {/* Reason textarea */}
                            <textarea
                                value={cancelReason}
                                onChange={(e) => setCancelReason(e.target.value)}
                                rows={2}
                                placeholder={canForceCancel && !canCreatorCancel
                                    ? t.tasks.selfApproval.forceCancelReason
                                    : t.tasks.selfApproval.cancelReason
                                }
                                className="w-full rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-neutral-50)] px-4 py-2.5 text-sm text-[var(--color-text-primary)] outline-none transition-colors placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-border-focus)] focus:bg-[var(--color-surface-input)] focus:ring-2 focus:ring-[var(--color-brand-primary-muted)]"
                            />

                            {/* Cancel buttons */}
                            <div className="flex items-center gap-2">
                                {canCreatorCancel && (
                                    <button
                                        type="button"
                                        onClick={() => handleCreatorCancel()}
                                        disabled={isSubmitting}
                                        className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-[var(--color-error-border)] bg-[var(--color-surface-elevated)] px-4 py-3 text-sm font-semibold text-[var(--color-error-text)] transition-all hover:bg-[var(--color-error-bg)] active:bg-[var(--color-error-bg-muted)] disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
                                        {t.tasks.selfApproval.cancelButton}
                                    </button>
                                )}
                                {canForceCancel && !canCreatorCancel && (
                                    <button
                                        type="button"
                                        onClick={() => handleForceCancel()}
                                        disabled={isSubmitting || !cancelReason.trim()}
                                        className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-[var(--color-error-border)] bg-[var(--color-error-bg)] px-4 py-3 text-sm font-semibold text-[var(--color-error-text)] transition-all hover:bg-[var(--color-error-bg-muted)] disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
                                        {t.tasks.selfApproval.forceCancelButton}
                                    </button>
                                )}
                                {canForceCancel && canCreatorCancel && (
                                    <button
                                        type="button"
                                        onClick={() => handleForceCancel()}
                                        disabled={isSubmitting || !cancelReason.trim()}
                                        className="flex items-center justify-center gap-1.5 rounded-xl border border-[var(--color-neutral-300)] bg-[var(--color-surface-elevated)] px-4 py-3 text-sm font-semibold text-[var(--color-text-secondary)] transition-all hover:bg-[var(--color-neutral-50)] disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldAlert className="h-4 w-4" />}
                                        {t.tasks.selfApproval.forceCancelButton}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {!!otpAction && (
                <ActionOtpModal
                    onConfirm={(code) => {
                        if (otpAction === "cancel") handleCreatorCancel(code);
                        else if (otpAction === "forceCancel") handleForceCancel(code);
                    }}
                    onCancel={() => setOtpAction(null)}
                    isSubmitting={isSubmitting}
                />
            )}
        </>
    );
}
