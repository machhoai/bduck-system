"use client";

import { CheckCircle2 } from "lucide-react";
import type { InvoiceBulkIssueRunView } from "@/api/invoiceApi";
import type { useInvoiceBulkIssueProgress } from "@/hooks/useInvoiceBulkIssueProgress";

export function BulkIssueProgressCard({
  run,
  progress,
  lang,
}: {
  run: InvoiceBulkIssueRunView;
  progress: ReturnType<typeof useInvoiceBulkIssueProgress>;
  lang: "vi" | "zh";
}) {
  const vi = lang === "vi";
  const percent = run.summary.eligible_count
    ? (progress.issued / run.summary.eligible_count) * 100
    : 0;

  return (
    <div className="mt-2.5 rounded-md border border-sky-200 bg-white p-2.5">
      <div className="flex items-center justify-between gap-2.5">
        <p className="text-xs font-bold text-slate-900">
          {progress.complete
            ? vi
              ? "Đã hoàn tất tiến trình MISA"
              : "MISA 处理已完成"
            : vi
              ? "MISA đang xử lý trực tiếp"
              : "MISA 实时处理中"}
        </p>
        <span className="text-xxs font-semibold text-slate-500">
          {progress.issued}/{run.summary.eligible_count}
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-emerald-500 transition-[width] duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-xxs text-slate-600">
        <span>
          {progress.issued} {vi ? "đã phát hành" : "已开具"}
        </span>
        <span>
          {progress.queued + progress.submitting}{" "}
          {vi ? "đang gửi" : "正在提交"}
        </span>
        <span>
          {progress.pending + progress.retrying}{" "}
          {vi ? "chờ MISA xác nhận" : "等待 MISA 确认"}
        </span>
        <span>
          {progress.needsAttention} {vi ? "cần đối soát" : "需要对账"}
        </span>
      </div>
      {progress.complete && progress.needsAttention === 0 && (
        <p className="mt-2 flex items-center gap-1.5 text-xxs font-semibold text-emerald-700">
          <CheckCircle2 size={13} />{" "}
          {vi ? "Tất cả hóa đơn đã được xử lý." : "所有发票均已处理。"}
        </p>
      )}
      {run.summary.eligible_count === 0 && (
        <p className="mt-2 text-xxs text-slate-500">
          {vi ? "Không tìm thấy hóa đơn hợp lệ." : "没有找到有效的发票。"}
        </p>
      )}
      {progress.error && (
        <p className="mt-2 text-xxs text-rose-700">{progress.error}</p>
      )}
    </div>
  );
}

