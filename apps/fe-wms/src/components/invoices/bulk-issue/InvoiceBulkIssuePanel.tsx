"use client";

import { useEffect, useRef, useState } from "react";
import { RefreshCw, Send, TriangleAlert } from "lucide-react";
import type { InvoiceBulkIssuePreview } from "@bduck/shared-types";
import { invoiceApi, type InvoiceBulkIssueRunView } from "@/api/invoiceApi";
import { ActionOtpModal } from "@/components/shared/ActionOtpModal";
import { useInvoiceBulkDisplayConfig } from "@/hooks/useInvoiceBulkDisplayConfig";
import { useInvoiceBulkIssueProgress } from "@/hooks/useInvoiceBulkIssueProgress";
import { showToast } from "@/utils/toast";
import { BulkIssueConfirmModal } from "./BulkIssueConfirmModal";
import { BulkIssueConfigurationModal } from "./BulkIssueConfigurationModal";
import { BulkIssueProgressCard } from "./BulkIssueProgressCard";

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
  const [preview, setPreview] = useState<InvoiceBulkIssuePreview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [showOtp, setShowOtp] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [run, setRun] = useState<InvoiceBulkIssueRunView | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const idempotencyKey = useRef<string | null>(null);
  const completionNotified = useRef(false);
  const progress = useInvoiceBulkIssueProgress(run?.job_ids ?? [], lang);
  const display = useInvoiceBulkDisplayConfig({
    warehouseId,
    businessDate,
    selectedIds,
    canIssue,
    lang,
    onError: setLastError,
  });

  useEffect(() => {
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

  const startPreview = async () => {
    if (!display.selection || !canIssue || previewing || display.configDirty)
      return;
    setPreviewing(true);
    setLastError(null);
    try {
      const nextPreview = await invoiceApi.previewBulkIssue(display.selection);
      if (nextPreview.summary.eligible_count === 0) {
        const message =
          lang === "vi"
            ? "Không có hóa đơn đủ điều kiện. Hãy kiểm tra cấu hình go-live và lỗi dữ liệu."
            : "没有符合条件的发票，请检查启用时间配置和数据错误。";
        setLastError(message);
        showToast.warning(
          lang === "vi" ? "Không có hóa đơn có thể xuất" : "没有可开具的发票",
          message,
        );
        return;
      }
      setPreview(nextPreview);
      display.closeConfiguration();
      idempotencyKey.current = crypto.randomUUID();
    } catch (error) {
      console.error("[InvoiceBulkIssuePanel] preview bulk issue", error);
      const message =
        error instanceof Error
          ? error.message
          : "Unable to preview bulk issue.";
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
    if (!display.selection || !preview || !idempotencyKey.current || issuing)
      return;
    setIssuing(true);
    setLastError(null);
    const operation = invoiceApi.createBulkIssue({
      ...display.selection,
      otp,
      idempotency_key: idempotencyKey.current,
      config_fingerprint: preview.config_fingerprint,
      action_time: new Date().toISOString(),
    });
    try {
      const nextRun = await showToast.promise(operation, {
        loading:
          lang === "vi"
            ? "Đang đưa hóa đơn vào hàng đợi…"
            : "正在加入开票队列…",
        success: lang === "vi" ? "Đã bắt đầu xuất hóa đơn" : "已开始开票",
        error: lang === "vi" ? "Không thể bắt đầu xuất" : "无法开始开票",
        successDescription:
          lang === "vi"
            ? "Tiến trình MISA sẽ được cập nhật trực tiếp bên dưới."
            : "下方将实时显示 MISA 处理进度。",
        errorDescription: (error) =>
          error instanceof Error ? error.message : "Unknown error",
        retry: () => void submitOtp(otp),
        retryLabel: lang === "vi" ? "Thử lại" : "重试",
      });
      setRun(nextRun);
      setShowOtp(false);
      setPreview(null);
      onIssued();
    } catch (error) {
      console.error("[InvoiceBulkIssuePanel] create bulk issue", error);
      setLastError(
        error instanceof Error ? error.message : "Unable to issue invoices.",
      );
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
              {selectedIds.length}{" "}
              {lang === "vi" ? "đơn đã chọn" : "个已选订单"} · {eligibleCount}{" "}
              {lang === "vi"
                ? "đơn có thể kiểm tra trong ngày"
                : "个当日候选订单"}
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              disabled={
                !canIssue ||
                selectedIds.length === 0 ||
                display.loadingConfig ||
                previewing ||
                issuing
              }
              onClick={() => void display.startConfiguration("SELECTED")}
              className="inline-flex h-8 w-fit items-center gap-1.5 rounded-md bg-sky-700 px-3 text-xs font-semibold text-white disabled:opacity-40 hover:bg-sky-800"
            >
              <Send size={14} />{" "}
              {lang === "vi" ? "Xuất các đơn đã chọn" : "开具已选订单"}
            </button>
            <button
              type="button"
              disabled={
                !canIssue ||
                eligibleCount === 0 ||
                display.loadingConfig ||
                previewing ||
                issuing
              }
              onClick={() => void display.startConfiguration("ALL")}
              className="inline-flex h-8 w-fit items-center gap-1.5 rounded-md border border-sky-300 bg-white px-3 text-xs font-semibold text-sky-800 disabled:opacity-40 hover:bg-slate-50"
            >
              {display.loadingConfig || previewing ? (
                <RefreshCw className="animate-spin" size={14} />
              ) : (
                <Send size={14} />
              )}
              {lang === "vi" ? "Xuất tất cả trong ngày" : "开具当日全部订单"}
            </button>
          </div>
        </div>

        {previewing && (
          <div
            className="mt-2.5 grid animate-pulse grid-cols-2 gap-2 sm:grid-cols-4"
            aria-label={
              lang === "vi" ? "Đang tính tổng" : "Calculating summary"
            }
          >
            {[0, 1, 2, 3].map((item) => (
              <div key={item} className="h-10 rounded-md bg-sky-100" />
            ))}
          </div>
        )}

        {run && (
          <BulkIssueProgressCard run={run} progress={progress} lang={lang} />
        )}

        {lastError && (
          <div className="mt-2.5 flex items-center justify-between gap-2 rounded-md border border-rose-200 bg-rose-50 p-2 text-xxs text-rose-800">
            <span className="flex items-center gap-1.5">
              <TriangleAlert size={13} /> {lastError}
            </span>
            {display.selection && (
              <button
                type="button"
                onClick={() =>
                  void display.startConfiguration(
                    display.selection!.selection_mode,
                  )
                }
                className="font-bold underline"
              >
                {lang === "vi" ? "Thử lại" : "重试"}
              </button>
            )}
          </div>
        )}
      </section>

      {display.configOpen && (
        <BulkIssueConfigurationModal
          config={display.displayConfig}
          itemNameMapping={display.itemNameMapping}
          unitNameMapping={display.unitNameMapping}
          dirty={display.configDirty}
          saving={display.savingConfig}
          previewing={previewing}
          lang={lang}
          onItemNameChange={display.changeItemName}
          onUnitNameChange={display.changeUnitName}
          onSave={() => void display.saveDisplayConfig()}
          onContinue={() => void startPreview()}
          onCancel={() =>
            !display.savingConfig && !previewing && display.closeConfiguration()
          }
        />
      )}
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
          title={
            lang === "vi" ? "Xác thực xuất hóa đơn hàng loạt" : "验证批量开票"
          }
          description={
            lang === "vi"
              ? "Nhập OTP để xác nhận gửi hóa đơn thật sang MISA."
              : "输入 OTP 以确认向 MISA 提交真实发票。"
          }
          isSubmitting={issuing}
          onConfirm={(otp) => void submitOtp(otp)}
          onCancel={() => !issuing && setShowOtp(false)}
        />
      )}
    </>
  );
}
