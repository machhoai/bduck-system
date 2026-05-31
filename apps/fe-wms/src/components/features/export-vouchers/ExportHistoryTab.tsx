"use client";

/**
 * ExportHistoryTab — Shows completed/cancelled export vouchers
 */

import { PackageMinus, CheckCircle, XCircle } from "lucide-react";
import type { ExportVoucher } from "@bduck/shared-types";
import { ExportVoucherStatus } from "@bduck/shared-types";
import { useTranslation } from "../../../lib/i18n";

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    COMPLETED: { bg: "bg-emerald-100", text: "text-emerald-700", label: "Hoàn tất" },
    CANCELLED: { bg: "bg-gray-100", text: "text-gray-600", label: "Đã hủy" },
  };
  const c = config[status] || { bg: "bg-gray-100", text: "text-gray-600", label: status };
  return (
    <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  );
}

interface Props {
  vouchers: ExportVoucher[];
}

export default function ExportHistoryTab({ vouchers }: Props) {
  const { t } = useTranslation();

  if (vouchers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20">
        <PackageMinus className="h-12 w-12 text-gray-300" />
        <p className="text-sm text-gray-400">
          {t.exportVoucher?.historyEmpty ?? "Chưa có lịch sử xuất kho"}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {vouchers.map((voucher) => {
        const isCompleted = voucher.status === ExportVoucherStatus.COMPLETED;
        return (
          <div
            key={voucher.id}
            className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  {isCompleted ? (
                    <CheckCircle className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-gray-400" />
                  )}
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {voucher.voucher_number}
                  </p>
                  <StatusBadge status={voucher.status} />
                </div>
                <p className="mt-1 text-xs text-gray-500 truncate">
                  {voucher.recipient_name || voucher.export_type}
                  {voucher.recipient_department && ` · ${voucher.recipient_department}`}
                </p>
                <p className="mt-0.5 text-[10px] text-gray-400">
                  {new Date(voucher.created_at as any).toLocaleDateString("vi-VN")}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
