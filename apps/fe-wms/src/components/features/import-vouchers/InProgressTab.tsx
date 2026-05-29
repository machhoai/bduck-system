"use client";

/**
 * InProgressTab — Shows import vouchers in active states
 *
 * REFACTORED: Removed all workflow engine dependencies.
 * Now uses voucher.status as the source of truth (State Machine).
 *
 * Flow:
 *   PENDING_APPROVAL → show "Chờ duyệt"
 *   APPROVED         → show "Tiếp tục" (opens ReceivingSessionDrawer)
 *   RECEIVING        → show "Đang nhận hàng"
 *
 * LUẬT THÉP:
 * - i18n, Light theme, no reload buttons
 * - Status determined by voucher.status, NOT workflow instance
 */

import { useState } from "react";
import {
    Eye,
    Copy,
    Play,
    Clock,
    CheckCircle,
    XCircle,
    PackageOpen,
} from "lucide-react";
import type { ImportVoucher } from "@bduck/shared-types";
import { ImportVoucherStatus } from "@bduck/shared-types";
import { useTranslation } from "../../../lib/i18n";
import VoucherDetailDrawer from "./VoucherDetailDrawer";
import ReceivingSessionDrawer from "../../tasks/ReceivingSessionDrawer";

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

interface InProgressTabProps {
    vouchers: ImportVoucher[];
    onClone: (data: Record<string, unknown>) => void;
}

// ─────────────────────────────────────────────
// STATUS BADGE
// ─────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
    const config: Record<
        string,
        { label: string; color: string; Icon: React.ElementType }
    > = {
        DRAFT: {
            label: "Nháp",
            color: "bg-gray-100 text-gray-600",
            Icon: Clock,
        },
        PENDING_APPROVAL: {
            label: "Chờ duyệt",
            color: "bg-amber-50 text-amber-700",
            Icon: Clock,
        },
        APPROVED: {
            label: "Đã duyệt",
            color: "bg-blue-50 text-blue-700",
            Icon: CheckCircle,
        },
        REJECTED: {
            label: "Từ chối",
            color: "bg-red-50 text-red-700",
            Icon: XCircle,
        },
        RECEIVING: {
            label: "Đang nhận hàng",
            color: "bg-indigo-50 text-indigo-700",
            Icon: PackageOpen,
        },
    };

    const cfg = config[status] || config.DRAFT;
    const Icon = cfg.Icon;

    return (
        <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${cfg.color}`}
        >
            <Icon size={11} />
            {cfg.label}
        </span>
    );
}

// ─────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────

export default function InProgressTab({ vouchers, onClone }: InProgressTabProps) {
    const { t } = useTranslation();
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [receivingVoucherId, setReceivingVoucherId] = useState<string | null>(null);

    if (vouchers.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center gap-3 py-20">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-50">
                    <PackageOpen
                        size={24}
                        className="text-gray-400"
                    />
                </div>
                <p className="text-sm font-medium text-gray-500">
                    {t.importVoucher?.empty?.inProgress ??
                        "Không có lệnh nhập kho đang xử lý"}
                </p>
                <p className="text-xs text-gray-400">
                    {t.importVoucher?.empty?.inProgressHint ??
                        "Tạo lệnh mới ở tab \"Tạo mới\" để bắt đầu."}
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {vouchers.map((voucher) => {
                const isDraft = voucher.status === ImportVoucherStatus.DRAFT;
                const isApproved = voucher.status === ImportVoucherStatus.APPROVED;
                const canEdit = isDraft;
                // Can open receiving session when status = APPROVED (post-approval, pre-receiving)
                const canContinue = isApproved;

                return (
                    <div
                        key={voucher.id}
                        className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm transition-all"
                    >
                        {/* Header */}
                        <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                    <p className="text-sm font-semibold text-gray-900 tabular-nums">
                                        {voucher.voucher_number}
                                    </p>
                                    <StatusBadge status={voucher.status} />
                                </div>
                                <p className="mt-0.5 text-xs text-gray-500">
                                    NCC: {voucher.supplier_name} · Kho: {voucher.warehouse_id}
                                </p>
                                <p className="mt-0.5 text-[10px] text-gray-400">
                                    {voucher.created_at
                                        ? new Date(
                                            typeof voucher.created_at === "string"
                                                ? voucher.created_at
                                                : (voucher.created_at as unknown as { toDate?: () => Date })?.toDate?.() ??
                                                voucher.created_at,
                                        ).toLocaleString("vi-VN")
                                        : ""}
                                </p>
                            </div>
                        </div>

                        {/* Notes */}
                        {voucher.notes && (
                            <div className="mt-3 flex items-start gap-2 rounded-lg bg-gray-50 p-2.5">
                                <div className="text-xs">
                                    <p className="font-medium text-gray-600">
                                        Ghi chú
                                    </p>
                                    <p className="mt-0.5 text-gray-500">
                                        {voucher.notes}
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Actions */}
                        <div className="mt-3 flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={() => setSelectedId(voucher.id)}
                                className="flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-[11px] font-medium text-gray-600 transition-colors hover:bg-gray-50"
                            >
                                <Eye size={12} />
                                Xem chi tiết
                            </button>

                            {canEdit && (
                                <button
                                    type="button"
                                    onClick={() =>
                                        onClone({
                                            warehouse_id: voucher.warehouse_id,
                                            supplier_name: voucher.supplier_name,
                                            purchase_order_id: voucher.purchase_order_id,
                                            notes: voucher.notes,
                                        })
                                    }
                                    className="flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1.5 text-[11px] font-medium text-blue-600 transition-colors hover:bg-blue-100"
                                >
                                    <Copy size={12} />
                                    Sửa lệnh
                                </button>
                            )}

                            {canContinue && (
                                <button
                                    type="button"
                                    onClick={() => setReceivingVoucherId(voucher.id)}
                                    className="flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-emerald-700"
                                >
                                    <Play size={12} />
                                    Tiếp tục
                                </button>
                            )}
                        </div>
                    </div>
                );
            })}

            {/* Detail Drawer */}
            {selectedId && (() => {
                const selected = vouchers.find((v) => v.id === selectedId);
                if (!selected) return null;
                return (
                    <VoucherDetailDrawer
                        voucher={selected}
                        onClose={() => setSelectedId(null)}
                    />
                );
            })()}

            {/* Receiving Session — pass voucher_id instead of task */}
            {receivingVoucherId && (() => {
                const voucher = vouchers.find((v) => v.id === receivingVoucherId);
                if (!voucher) return null;
                return (
                    <ReceivingSessionDrawer
                        task={{
                            id: `receiving-${voucher.id}`,
                            instance_id: voucher.id,
                            entity_id: voucher.id,
                            entity_type: "IMPORT_VOUCHER",
                            voucher_id: voucher.id,
                        } as any}
                        onClose={() => setReceivingVoucherId(null)}
                    />
                );
            })()}
        </div>
    );
}
