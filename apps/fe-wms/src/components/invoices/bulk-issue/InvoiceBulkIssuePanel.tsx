"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, RefreshCw, Send, TriangleAlert } from "lucide-react";
import type {
  InvoiceBulkIssuePreview,
  InvoiceBulkSelectionMode,
} from "@bduck/shared-types";
import {
  invoiceApi,
  type InvoiceBulkIssueRunView,
  type InvoiceBulkIssueSelectionPayload,
} from "@/api/invoiceApi";
import { ActionOtpModal } from "@/components/shared/ActionOtpModal";
import { useInvoiceBulkIssueProgress } from "@/hooks/useInvoiceBulkIssueProgress";
import { showToast } from "@/utils/toast";
import { BulkIssueConfirmModal } from "./BulkIssueConfirmModal";

export function InvoiceBulkIssuePanel({
  warehouseId,
  businessDate,
  selectedIds,
  eligibleCount,
  canIssue,
  lang,
  onCompleted,
  onIssued,
}: {
  warehouseId: string;
  businessDate: string;
  selectedIds: string[];
  eligibleCount: number;
  canIssue: boolean;
  lang: "vi" | "zh";
  onCompleted: () => void;
  onIssued: () => void;
}) {
  const [selection, setSelection] = useState<InvoiceBulkIssueSelectionPayload | null>(null);
  const [preview, setPreview] = useState<InvoiceBulkIssuePreview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [showOtp, setShowOtp] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [run, setRun] = useState<InvoiceBulkIssueRunView | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const idempotencyKey = useRef<string | null>(null);
  const completionNotified = useRef(false);
  const progress = useInvoiceBulkIssueProgress(run?.job_ids ?? [], lang);

  useEffect(() => {
    setSelection(null);
    setPreview(null);
    setRun(null);
    setLastError(null);
    idempotencyKey.current = null;
    completionNotified.current = false;
  }, [warehouseId, businessDate]);

  useEffect(() => {
    if (!progress.complete || completionNotified.current) return;
    completionNotified.current = true;
    onCompleted();
  }, [onCompleted, progress.complete]);

  const startPreview = async (mode: InvoiceBulkSelectionMode) => {
    if (!warehouseId || !canIssue || previewing) return;
    const nextSelection: InvoiceBulkIssueSelectionPayload = {
      warehouse_id: warehouseId,
      business_date: businessDate,
      selection_mode: mode,
      source_order_ids: mode === "SELECTED" ? selectedIds : [],
    };
    setPreviewing(true);
    setLastError(null);
    try {
      const nextPreview = await invoiceApi.previewBulkIssue(nextSelection);
      if (nextPreview.summary.eligible_count === 0) {
        const message = lang === "vi"
          ? "Không có hóa đơn đủ điều kiện. Hãy kiểm tra cấu hình go-live và lỗi dữ liệu."
          : "没有符合条件的发票，请检查启用时间配置和数据错误。";
        setLastError(message);
        showToast.warning(
          lang === "vi" ? "Không có hóa đơn có thể xuất" : "没有可开具的发票",
          message,
        );
        return;
      }
      setSelection(nextSelection);
      setPreview(nextPreview);
      idempotencyKey.current = crypto.randomUUID();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to preview bulk issue.";
      setLastError(message);
      showToast.error(
        lang === "vi" ? "Không thể kiểm tra đợt xuất" : "无法校验开票批次",
        message,
      );
    } finally {
      setPreviewing(false);
    }
  };

  const submitOtp = async (otp: string) => {
    if (!selection || !idempotencyKey.current || issuing) return;
    setIssuing(true);
    setLastError(null);
    const operation = invoiceApi.createBulkIssue({
      ...selection,
      otp,
      idempotency_key: idempotencyKey.current,
      action_time: new Date().toISOString(),
    });
    try {
      const nextRun = await showToast.promise(operation, {
        loading: lang === "vi" ? "Đang đưa hóa đơn vào hàng đợi…" : "正在加入开票队列…",
        success: lang === "vi" ? "Đã bắt đầu xuất hóa đơn" : "已开始开票",
        error: lang === "vi" ? "Không thể bắt đầu xuất" : "无法开始开票",
        successDescription: lang === "vi"
          ? "Tiến trình MISA sẽ được cập nhật trực tiếp bên dưới."
          : "下方将实时显示 MISA 处理进度。",
        errorDescription: (error) => error instanceof Error ? error.message : "Unknown error",
      });
      setRun(nextRun);
      setShowOtp(false);
      setPreview(null);
      onIssued();
    } catch (error) {
      setLastError(error instanceof Error ? error.message : "Unable to issue invoices.");
    } finally {
      setIssuing(false);
    }
  };

  return (
    <>
      <section className="rounded-[var(--radius-lg)] border border-sky-200 bg-sky-50 p-2.5">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-sky-950">
              {lang === "vi" ? "Xuất hóa đơn hàng loạt" : "批量开票"}
            </p>
            <p className="mt-0.5 text-xxs text-sky-800">
              {selectedIds.length} {lang === "vi" ? "đơn đã chọn" : "个已选订单"} · {eligibleCount} {lang === "vi" ? "đơn có thể kiểm tra trong ngày" : "个当日候选订单"}
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              disabled={!canIssue || selectedIds.length === 0 || previewing || issuing}
              onClick={() => void startPreview("SELECTED")}
              className="inline-flex h-8 w-fit items-center gap-1.5 rounded-md bg-sky-700 px-3 text-xs font-semibold text-white disabled:opacity-40 hover:bg-sky-800"
            >
              <Send size={14} /> {lang === "vi" ? "Xuất các đơn đã chọn" : "开具已选订单"}
            </button>
            <button
              type="button"
              disabled={!canIssue || eligibleCount === 0 || previewing || issuing}
              onClick={() => void startPreview("ALL")}
              className="inline-flex h-8 w-fit items-center gap-1.5 rounded-md border border-sky-300 bg-white px-3 text-xs font-semibold text-sky-800 disabled:opacity-40 hover:bg-slate-50"
            >
              {previewing ? <RefreshCw className="animate-spin" size={14} /> : <Send size={14} />}
              {lang === "vi" ? "Xuất tất cả trong ngày" : "开具当日全部订单"}
            </button>
          </div>
        </div>

        {previewing && (
          <div className="mt-2.5 grid animate-pulse grid-cols-2 gap-2 sm:grid-cols-4" aria-label={lang === "vi" ? "Đang tính tổng" : "Calculating summary"}>
            {[0, 1, 2, 3].map((item) => (
              <div key={item} className="h-10 rounded-md bg-sky-100" />
            ))}
          </div>
        )}

        {run && (
          <div className="mt-2.5 rounded-md border border-sky-200 bg-white p-2.5">
            <div className="flex items-center justify-between gap-2.5">
              <p className="text-xs font-bold text-slate-900">
                {progress.complete
                  ? (lang === "vi" ? "Đã hoàn tất tiến trình MISA" : "MISA 处理已完成")
                  : (lang === "vi" ? "MISA đang xử lý trực tiếp" : "MISA 实时处理中")}
              </p>
              <span className="text-xxs font-semibold text-slate-500">{progress.issued}/{run.summary.eligible_count}</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-emerald-500 transition-[width] duration-500"
                style={{ width: `${run.summary.eligible_count ? (progress.issued / run.summary.eligible_count) * 100 : 0}%` }}
              />
            </div>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-xxs text-slate-600">
              <span>{progress.issued} {lang === "vi" ? "đã phát hành" : "已开具"}</span>
              <span>{progress.queued + progress.submitting} {lang === "vi" ? "đang gửi" : "正在提交"}</span>
              <span>{progress.pending + progress.retrying} {lang === "vi" ? "chờ MISA xác nhận" : "等待 MISA 确认"}</span>
              <span>{progress.needsAttention} {lang === "vi" ? "cần đối soát" : "需要对账"}</span>
            </div>
            {progress.complete && progress.needsAttention === 0 && (
              <p className="mt-2 flex items-center gap-1.5 text-xxs font-semibold text-emerald-700">
                <CheckCircle2 size={13} /> {lang === "vi" ? "Tất cả hóa đơn đã được xử lý." : "所有发票均已处理。"}
              </p>
            )}
            {run.summary.eligible_count === 0 && (
              <p className="mt-2 text-xxs text-slate-500">
                {lang === "vi" ? "Không tìm thấy hóa đơn hợp lệ." : "没有找到有效的发票。"}
              </p>
            )}
            {progress.error && <p className="mt-2 text-xxs text-rose-700">{progress.error}</p>}
          </div>
        )}

        {lastError && (
          <div className="mt-2.5 flex items-center justify-between gap-2 rounded-md border border-rose-200 bg-rose-50 p-2 text-xxs text-rose-800">
            <span className="flex items-center gap-1.5"><TriangleAlert size={13} /> {lastError}</span>
            {selection && (
              <button type="button" onClick={() => void startPreview(selection.selection_mode)} className="font-bold underline">
                {lang === "vi" ? "Thử lại" : "重试"}
              </button>
            )}
          </div>
        )}
      </section>

      {preview && !showOtp && (
        <BulkIssueConfirmModal
          preview={preview}
          lang={lang}
          onCancel={() => setPreview(null)}
          onConfirm={() => setShowOtp(true)}
        />
      )}
      {showOtp && (
        <ActionOtpModal
          title={lang === "vi" ? "Xác thực xuất hóa đơn hàng loạt" : "验证批量开票"}
          description={lang === "vi"
            ? "Nhập OTP để xác nhận gửi hóa đơn thật sang MISA."
            : "输入 OTP 以确认向 MISA 提交真实发票。"}
          isSubmitting={issuing}
          onConfirm={(otp) => void submitOtp(otp)}
          onCancel={() => !issuing && setShowOtp(false)}
        />
      )}
    </>
  );
}
