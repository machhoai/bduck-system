"use client";

import { useRef, useState } from "react";
import type { InvoiceBulkIssuePreview } from "@bduck/shared-types";
import { InvoiceApiError, invoiceApi } from "@/api/invoiceApi";
import { showToast } from "@/utils/toast";

const copy = {
  vi: {
    loading: "Đang tạo bản xem trước…",
    ready: "Đã tạo bản xem trước",
    failed: "Không thể tạo bản xem trước",
    rateLimited: "MISA đang giới hạn lượt xem trước",
    expires: "Link MISA có hiệu lực 5 phút.",
    invalidUrl: "Link xem trước MISA không hợp lệ.",
    popupBlocked: "Trình duyệt đã chặn cửa sổ mới",
    popupHint: "Hãy cho phép cửa sổ bật lên rồi thử xem trước lại.",
    retry: "Thử lại",
  },
  zh: {
    loading: "正在生成预览…",
    ready: "预览已生成",
    failed: "无法生成预览",
    rateLimited: "MISA 暂时限制预览请求",
    expires: "MISA 预览链接有效期为 5 分钟。",
    invalidUrl: "MISA 预览链接无效。",
    popupBlocked: "浏览器已阻止新窗口",
    popupHint: "请允许弹出窗口后重试预览。",
    retry: "重试",
  },
} as const;

export const useBulkIssueMisaPreview = (
  preview: InvoiceBulkIssuePreview,
  lang: "vi" | "zh",
) => {
  const text = copy[lang];
  const previewInFlight = useRef(false);
  const [previewingInvoiceId, setPreviewingInvoiceId] = useState<string | null>(
    null,
  );

  async function previewInvoice(
    invoice: InvoiceBulkIssuePreview["invoices"][number],
  ) {
    if (previewInFlight.current) return;
    previewInFlight.current = true;
    const previewWindow = window.open("about:blank", "_blank");
    if (previewWindow) previewWindow.opener = null;
    setPreviewingInvoiceId(invoice.source_order_document_id);
    try {
      const result = await showToast.promise(
        invoiceApi.previewBulkIssueDocument(
          invoice.source_order_document_id,
          preview.warehouse_id,
          invoice.revision,
          invoice.source_payload_hash,
        ),
        {
          loading: text.loading,
          success: text.ready,
          error: (error) =>
            error instanceof InvoiceApiError && error.statusCode === 429
              ? text.rateLimited
              : text.failed,
          successDescription: text.expires,
          errorDescription: (error) =>
            error instanceof Error ? error.message : text.failed,
          retry: () => void previewInvoice(invoice),
          retryLabel: text.retry,
        },
      );
      let url: URL;
      try {
        url = new URL(result.url);
      } catch {
        previewWindow?.close();
        showToast.error(text.failed, text.invalidUrl);
        return;
      }
      if (
        url.protocol !== "https:" ||
        (url.hostname !== "meinvoice.vn" &&
          !url.hostname.endsWith(".meinvoice.vn"))
      ) {
        previewWindow?.close();
        showToast.error(text.failed, text.invalidUrl);
        return;
      }
      if (previewWindow) {
        previewWindow.location.replace(url.toString());
        return;
      }
      const openedWindow = window.open(
        url.toString(),
        "_blank",
        "noopener,noreferrer",
      );
      if (!openedWindow) {
        showToast.warning(text.popupBlocked, text.popupHint);
      }
    } catch (error) {
      console.error("[useBulkIssueMisaPreview] preview MISA invoice", error);
      previewWindow?.close();
    } finally {
      previewInFlight.current = false;
      setPreviewingInvoiceId(null);
    }
  }

  return { previewingInvoiceId, previewInvoice };
};
