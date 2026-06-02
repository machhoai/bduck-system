"use client";

/**
 * VoucherDetailDrawer — Slide-over drawer showing import voucher detail
 *
 * Used in: InProgressTab, HistoryTab (import-vouchers page)
 * Loads items + resolves product/warehouse/creator names via Firestore.
 * Displays attachments with PdfViewer integration.
 *
 * LUẬT THÉP:
 * - i18n (vi + zh), skeleton loading, realtime onSnapshot
 * - Code < 300 lines — data logic in custom hook
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
} from "lucide-react";
import {
    doc,
    collection,
    query as fsQuery,
    onSnapshot,
    getDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useTranslation } from "@/lib/i18n";
import type { ImportVoucher } from "@bduck/shared-types";
import AttachmentSection from "@/components/tasks/AttachmentSection";

interface VoucherDetailDrawerProps {
    voucher: ImportVoucher;
    onClose: () => void;
}

// ── Enriched item ──
interface EnrichedItem {
    id: string;
    product_name: string;
    product_code: string;
    barcode: string | null;
    unit: string;
    expected_quantity: number;
    actual_quantity: number;
    unit_price: number;
    condition: string;
    notes: string | null;
}

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

export default function VoucherDetailDrawer({
    voucher,
    onClose,
}: VoucherDetailDrawerProps) {
    const { t } = useTranslation();
    const [items, setItems] = useState<EnrichedItem[]>([]);
    const [loadingItems, setLoadingItems] = useState(true);
    const [creatorName, setCreatorName] = useState("");
    const [warehouseName, setWarehouseName] = useState("");

    // ── Resolve creator + warehouse names ──
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
    }, [voucher.creator_id, voucher.warehouse_id]);

    // ── Load items + resolve products ──
    useEffect(() => {
        const itemsQuery = fsQuery(
            collection(db, "import_vouchers", voucher.id, "items"),
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
                    return {
                        id: item.id,
                        product_name: productName,
                        product_code: productCode,
                        barcode,
                        unit,
                        expected_quantity: item.expected_quantity || 0,
                        actual_quantity: item.actual_quantity || 0,
                        unit_price: item.unit_price || 0,
                        condition: item.condition || "",
                        notes: item.notes || null,
                    };
                }),
            );
            setItems(enriched);
            setLoadingItems(false);
        });
        return () => unsub();
    }, [voucher.id]);

    const statusKey = voucher.status as keyof typeof t.importVoucher.status;
    const statusLabel = t.importVoucher.status[statusKey] || voucher.status;
    const statusColorMap: Record<string, string> = {
        DRAFT: "bg-gray-100 text-gray-600",
        PENDING_APPROVAL: "bg-amber-100 text-amber-700",
        APPROVED: "bg-emerald-100 text-emerald-700",
        RECEIVING: "bg-blue-100 text-blue-700",
        COMPLETED: "bg-green-100 text-green-700",
        CANCELLED: "bg-red-100 text-red-600",
        REJECTED: "bg-red-100 text-red-600",
    };
    const statusColor = statusColorMap[voucher.status] || "bg-gray-100 text-gray-600";

    const totalValue = useMemo(
        () => items.reduce((sum, i) => sum + i.expected_quantity * i.unit_price, 0),
        [items],
    );

    const attachmentUrls = voucher.attachment_urls || [];

    return (
        <>
            <div
                className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs transition-opacity"
                onClick={onClose}
            />

            <div className="fixed inset-y-0 right-0 z-50 flex w-[90%] lg:w-2/3 flex-col bg-white shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-gray-100 px-4 py-4">
                    <div>
                        <h2 className="text-lg font-bold text-gray-900">
                            {t.importVoucher.detail.title}
                        </h2>
                        <p className="mt-0.5 text-xs text-gray-500">
                            {voucher.voucher_number}
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
                        <Field icon={Package} label={t.tasks.detail.supplier} value={voucher.supplier_name} />
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
                                            <p className="flex-shrink-0 text-sm font-semibold text-gray-900">
                                                {formatCurrency(item.expected_quantity * item.unit_price)}đ
                                            </p>
                                        </div>
                                        <div className="mt-1.5 text-xs text-gray-500">
                                            {t.tasks.detail.quantity}: {formatCurrency(item.expected_quantity)}
                                            {item.unit_price > 0 && <> × {formatCurrency(item.unit_price)}đ</>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {totalValue > 0 && (
                            <div className="mt-3 flex items-center justify-between rounded-xl bg-blue-50 px-4 py-3">
                                <span className="text-sm font-medium text-blue-700">{t.tasks.detail.totalValue}</span>
                                <span className="text-base font-bold text-blue-800">{formatCurrency(totalValue)}đ</span>
                            </div>
                        )}
                    </div>

                    {/* Attachments */}
                    <AttachmentSection urls={attachmentUrls} t={t} />

                    {/* Bottom spacing */}
                    <div className="h-6" />
                </div>
            </div>
        </>
    );
}
