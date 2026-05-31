"use client";

/**
 * ExportInProgressTab — Shows export vouchers in active states
 *
 * Renders voucher cards with status badges and action buttons.
 * Gates "Soạn hàng" (picking) button by ProcessConfig assignment.
 * Fetches ProcessConfig ONCE at parent level (prevent N+1).
 */

import { useState, useEffect, useCallback } from "react";
import {
  Eye,
  Play,
  Clock,
  CheckCircle,
  XCircle,
  PackageMinus,
  Package,
  Truck,
} from "lucide-react";
import type { ExportVoucher, ProcessConfig } from "@bduck/shared-types";
import { ExportVoucherStatus } from "@bduck/shared-types";
import { useTranslation } from "../../../lib/i18n";
import { useUserStore } from "../../../stores/useUserStore";
import { fetchConfigByEntityType } from "../../../hooks/useApprovalApi";
import { completeExportVoucher } from "../../../hooks/useExportVoucherApi";
import PickingSessionDrawer from "../../tasks/PickingSessionDrawer";
import { gooeyToast } from "goey-toast";

// ─────────────────────────────────────────────
// STATUS BADGE
// ─────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    DRAFT: { bg: "bg-gray-100", text: "text-gray-600", label: "Nháp" },
    PENDING_APPROVAL: {
      bg: "bg-amber-100",
      text: "text-amber-700",
      label: "Chờ duyệt",
    },
    APPROVED: { bg: "bg-blue-100", text: "text-blue-700", label: "Đã duyệt" },
    REJECTED: { bg: "bg-red-100", text: "text-red-700", label: "Từ chối" },
    PICKING: {
      bg: "bg-purple-100",
      text: "text-purple-700",
      label: "Đang soạn",
    },
    SHIPPED: { bg: "bg-teal-100", text: "text-teal-700", label: "Đã bàn giao" },
  };
  const c = config[status] || {
    bg: "bg-gray-100",
    text: "text-gray-600",
    label: status,
  };
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${c.bg} ${c.text}`}
    >
      {c.label}
    </span>
  );
}

// ─────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────

interface Props {
  vouchers: ExportVoucher[];
}

export default function ExportInProgressTab({ vouchers }: Props) {
  const { t } = useTranslation();
  const [pickingVoucherId, setPickingVoucherId] = useState<string | null>(null);

  // Fetch ProcessConfig ONCE (prevent N+1)
  const user = useUserStore((s) => s.user);
  const roleIds = useUserStore((s) => s.roleIds);
  const [processConfig, setProcessConfig] = useState<ProcessConfig | null>(
    null,
  );

  useEffect(() => {
    let disposed = false;
    (async () => {
      try {
        const cfg = await fetchConfigByEntityType("EXPORT_VOUCHER");
        if (!disposed) setProcessConfig(cfg as ProcessConfig);
      } catch (err) {
        console.error("[ExportInProgressTab] Config load error:", err);
      }
    })();
    return () => {
      disposed = true;
    };
  }, []);

  const canPerformPicking = useCallback(
    (voucher: ExportVoucher): boolean => {
      // If no config or no picking step config → allow (default open)
      if (!processConfig?.step_options?.picking) {
        console.log("[canPerformPicking] No picking config → allowed");
        return true;
      }
      const step = processConfig.step_options.picking;
      if (step.assignment_mode === "CREATOR") {
        const result = user?.id === voucher.creator_id;
        console.log("[canPerformPicking] CREATOR mode:", { userId: user?.id, creatorId: voucher.creator_id, result });
        return result;
      }
      if (step.assignment_mode === "ROLE") {
        const result = !!step.assigned_role_id && roleIds.includes(step.assigned_role_id);
        console.log("[canPerformPicking] ROLE mode:", { assignedRole: step.assigned_role_id, userRoles: roleIds, result });
        return result;
      }
      return true;
    },
    [processConfig, user, roleIds],
  );

  const handleCompleteExport = useCallback(async (voucherId: string) => {
    await gooeyToast.promise(completeExportVoucher(voucherId), {
      loading: "Đang hoàn tất xuất kho...",
      success: "Phiếu xuất kho đã hoàn tất",
      error: "Lỗi hoàn tất xuất kho",
      description: {
        success: "Phiếu đã chuyển sang trạng thái COMPLETED.",
        error: "Vui lòng thử lại.",
      },
      action: {
        error: {
          label: "Thử lại",
          onClick: () => handleCompleteExport(voucherId),
        },
      },
    });
  }, []);

  if (vouchers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20">
        <PackageMinus className="h-12 w-12 text-gray-300" />
        <p className="text-sm text-gray-400">
          {t.exportVoucher?.empty ?? "Không có phiếu xuất nào đang xử lý"}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {vouchers.map((voucher) => {
          const isApproved = voucher.status === ExportVoucherStatus.APPROVED;
          const isShipped = voucher.status === ExportVoucherStatus.SHIPPED;
          const canPick = isApproved && canPerformPicking(voucher);

          return (
            <div
              key={voucher.id}
              className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {voucher.voucher_number}
                    </p>
                    <StatusBadge status={voucher.status} />
                  </div>
                  <p className="mt-1 text-xs text-gray-500 truncate">
                    {voucher.recipient_name || voucher.export_type}
                    {voucher.recipient_department &&
                      ` · ${voucher.recipient_department}`}
                  </p>
                  <p className="mt-0.5 text-[10px] text-gray-400">
                    {new Date(voucher.created_at as any).toLocaleDateString(
                      "vi-VN",
                    )}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  {/* Picking button — gated by assignment */}
                  {canPick && (
                    <button
                      type="button"
                      onClick={() => setPickingVoucherId(voucher.id)}
                      className="flex items-center gap-1 rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition-colors hover:bg-orange-600"
                    >
                      <Play className="h-3.5 w-3.5" />
                      Soạn hàng
                    </button>
                  )}

                  {/* Complete export button — for SHIPPED status */}
                  {isShipped && (
                    <button
                      type="button"
                      onClick={() => handleCompleteExport(voucher.id)}
                      className="flex items-center gap-1 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition-colors hover:bg-emerald-600"
                    >
                      <CheckCircle className="h-3.5 w-3.5" />
                      Hoàn tất
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Picking Session Drawer */}
      {pickingVoucherId && (
        <PickingSessionDrawer
          voucherId={pickingVoucherId}
          onClose={() => setPickingVoucherId(null)}
        />
      )}
    </>
  );
}
