"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Eye,
  Copy,
  Play,
  AlertTriangle,
  Clock,
  CheckCircle,
  XCircle,
  PackageOpen,
} from "lucide-react";
import type { ImportVoucher, WorkflowTask, WorkflowInstance } from "@bduck/shared-types";
import { ImportVoucherStatus, WorkflowNodeType } from "@bduck/shared-types";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useTranslation } from "../../../lib/i18n";
import { useWorkflowTasks } from "../../../hooks/useWorkflowTasks";
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
  const [receivingTask, setReceivingTask] = useState<WorkflowTask | null>(null);
  const { myTasks } = useWorkflowTasks();

  // Map: entity_id (voucher_id) → instance_id from workflow instances
  const [instanceMap, setInstanceMap] = useState<Map<string, string>>(new Map());

  // Fetch workflow instances to build entity_id → instance_id mapping
  useEffect(() => {
    const approvedVoucherIds = vouchers
      .filter((v) => v.status === ImportVoucherStatus.APPROVED)
      .map((v) => v.id);

    if (approvedVoucherIds.length === 0) {
      setInstanceMap(new Map());
      return;
    }

    // Firestore "in" query supports max 30 items
    const batchIds = approvedVoucherIds.slice(0, 30);
    const q = query(
      collection(db, "workflow_instances"),
      where("entity_id", "in", batchIds),
      where("status", "==", "RUNNING"),
    );

    getDocs(q)
      .then((snap) => {
        const map = new Map<string, string>();
        snap.forEach((doc) => {
          const data = doc.data() as WorkflowInstance;
          map.set(data.entity_id, doc.id);
        });
        setInstanceMap(map);
      })
      .catch((err) => console.error("[InProgressTab] instance lookup:", err));
  }, [vouchers]);

  // Helper: find DATA_INPUT PENDING task for a given voucher
  const findReceivingTask = (voucherId: string): WorkflowTask | null => {
    const instanceId = instanceMap.get(voucherId);
    if (!instanceId) return null;

    return (
      myTasks.find(
        (t) =>
          t.instance_id === instanceId &&
          t.node_type === WorkflowNodeType.DATA_INPUT &&
          (t.status === "PENDING" || t.status === "IN_PROGRESS"),
      ) ?? null
    );
  };

  if (vouchers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-surface-card)]">
          <PackageOpen
            size={24}
            className="text-[var(--color-text-muted)]"
          />
        </div>
        <p className="text-sm font-medium text-[var(--color-text-muted)]">
          {(t as any).importVoucher?.empty?.inProgress ??
            "Không có lệnh nhập kho đang xử lý"}
        </p>
        <p className="text-xs text-[var(--color-text-muted)]">
          {(t as any).importVoucher?.empty?.inProgressHint ??
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
        const canEdit = isDraft; // Can edit while still in DRAFT
        const canContinue = isApproved; // Open receiving session when approved

        return (
          <div
            key={voucher.id}
            className={`rounded-[var(--radius-md)] border bg-[var(--color-surface-elevated)] p-4 transition-all border-[var(--color-border-subtle)]`}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-[var(--color-text-primary)] tabular-nums">
                    {voucher.voucher_number}
                  </p>
                  <StatusBadge status={voucher.status} />
                </div>
                <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                  NCC: {voucher.supplier_name} · Kho: {voucher.warehouse_id}
                </p>
                <p className="mt-0.5 text-[10px] text-[var(--color-text-muted)]">
                  {voucher.created_at
                    ? new Date(
                        typeof voucher.created_at === "string"
                          ? voucher.created_at
                          : (voucher.created_at as any)?.toDate?.() ??
                              voucher.created_at,
                      ).toLocaleString("vi-VN")
                    : ""}
                </p>
              </div>
            </div>

            {/* Notes */}
            {voucher.notes && (
              <div className="mt-3 flex items-start gap-2 rounded-[var(--radius-sm)] bg-[var(--color-surface-card)] p-2.5">
                <div className="text-xs">
                  <p className="font-medium text-[var(--color-text-secondary)]">
                    Ghi chú
                  </p>
                  <p className="mt-0.5 text-[var(--color-text-muted)]">
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
                className="flex items-center gap-1 rounded-[var(--radius-xs)] border border-[var(--color-border-subtle)] px-2.5 py-1.5 text-[11px] font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-card)]"
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
                  className="flex items-center gap-1 rounded-[var(--radius-xs)] bg-[var(--color-brand-primary-muted)] px-2.5 py-1.5 text-[11px] font-medium text-[var(--color-brand-primary)] transition-colors hover:bg-[var(--color-brand-primary)]/20"
                >
                  <Copy size={12} />
                  Sửa lệnh
                </button>
              )}

              {canContinue && (() => {
                const task = findReceivingTask(voucher.id);
                return (
                  <button
                    type="button"
                    onClick={() => {
                      if (task) {
                        setReceivingTask(task);
                      }
                    }}
                    disabled={!task}
                    title={!task ? "Chưa có bước kiểm đếm hoặc đang chờ xử lý trước đó" : "Mở phiên kiểm đếm"}
                    className={`flex items-center gap-1 rounded-[var(--radius-xs)] px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${
                      task
                        ? "bg-[var(--color-accent-success)] text-white hover:brightness-95"
                        : "bg-gray-100 text-gray-400 cursor-not-allowed"
                    }`}
                  >
                    <Play size={12} />
                    Tiếp tục
                  </button>
                );
              })()}
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

      {/* Receiving Session Drawer */}
      {receivingTask && (
        <ReceivingSessionDrawer
          task={receivingTask}
          onClose={() => setReceivingTask(null)}
        />
      )}
    </div>
  );
}
