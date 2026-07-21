"use client";

import { AlertTriangle, X } from "lucide-react";
import type { InvoiceBulkIssuePreview } from "@bduck/shared-types";

const money = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

export function BulkIssueConfirmModal({
  preview,
  lang,
  onCancel,
  onConfirm,
}: {
  preview: InvoiceBulkIssuePreview;
  lang: "vi" | "zh";
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const summary = preview.summary;
  const stats = [
    [lang === "vi" ? "Hóa đơn đủ điều kiện" : "符合条件的发票", summary.eligible_count],
    [lang === "vi" ? "Tiền trước thuế" : "税前金额", money.format(summary.total_amount_without_vat)],
    ["VAT", money.format(summary.total_vat_amount)],
    [lang === "vi" ? "Tổng gồm VAT" : "含税总额", money.format(summary.total_amount)],
    [lang === "vi" ? "Dòng sản phẩm" : "商品行数", summary.product_line_count],
    [lang === "vi" ? "Số lượng sản phẩm" : "商品数量", summary.product_quantity],
  ];
  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
      <div className="w-[90%] max-w-[500px] rounded-xl bg-white p-3.5 shadow-xl border border-slate-200">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-micro font-bold uppercase tracking-wider text-sky-700">MISA meInvoice</p>
            <h3 className="mt-0.5 text-sm font-bold text-slate-950">
              {lang === "vi" ? "Xác nhận xuất hóa đơn hàng loạt" : "确认批量开票"}
            </h3>
            <p className="mt-0.5 text-xxs text-slate-500">
              {preview.business_date} · {preview.selection_mode === "ALL"
                ? (lang === "vi" ? "Tất cả đơn trong ngày" : "当日全部订单")
                : (lang === "vi" ? "Các đơn đã chọn" : "已选订单")}
            </p>
          </div>
          <button type="button" onClick={onCancel} className="rounded p-1 text-slate-400 hover:bg-slate-100">
            <X size={15} />
          </button>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {stats.map(([label, value]) => (
            <div key={String(label)} className="rounded-md border border-slate-150 bg-slate-50 p-2">
              <p className="text-xxs text-slate-500">{label}</p>
              <p className="mt-0.5 text-xs font-bold text-slate-900">{value}</p>
            </div>
          ))}
        </div>
        {summary.excluded_count > 0 && (
          <div className="mt-3 flex gap-1.5 rounded-md border border-amber-200 bg-amber-50 p-2 text-xxs text-amber-900">
            <AlertTriangle className="mt-0.5 shrink-0" size={14} />
            <span>{summary.excluded_count} {lang === "vi"
              ? "đơn không đủ điều kiện sẽ được bỏ qua. Các kiểm tra go-live và chống xuất trùng vẫn được giữ."
              : "个不符合条件的订单将被跳过。启用时间和防重复检查仍然有效。"}</span>
          </div>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="h-8 rounded-md border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50">
            {lang === "vi" ? "Hủy" : "取消"}
          </button>
          <button type="button" onClick={onConfirm} className="h-8 rounded-md bg-sky-700 px-3 text-xs font-bold text-white hover:bg-sky-800">
            {lang === "vi" ? "Tiếp tục xác thực OTP" : "继续 OTP 验证"}
          </button>
        </div>
      </div>
    </div>
  );
}
