"use client";

import { AlertTriangle, Loader2, X } from "lucide-react";
import type {
  ProductImportPreviewRow,
  summarizeProductImportRows,
} from "@/utils/productExcelImport";

export function ProductImportStats({
  summary,
}: {
  summary: ReturnType<typeof summarizeProductImportRows>;
}) {
  const items = [
    { label: "Sản phẩm đọc được", value: summary.totalRows, tone: "neutral" },
    { label: "Dòng hợp lệ", value: summary.validRows, tone: "success" },
    { label: "Dòng lỗi", value: summary.errorRows, tone: "error" },
    { label: "Cảnh báo trùng lặp", value: summary.warningRows, tone: "warning" },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-white p-3"
        >
          <p className="text-xs text-[var(--color-text-muted)]">{item.label}</p>
          <p
            className={`mt-1 text-base font-semibold ${
              item.tone === "error"
                ? "text-[var(--color-accent-error)]"
                : item.tone === "warning"
                  ? "text-amber-600"
                  : item.tone === "success"
                    ? "text-emerald-600"
                    : "text-[var(--color-text-primary)]"
            }`}
          >
            {item.value}
          </p>
        </div>
      ))}
    </div>
  );
}

export function ProductImportPreviewTable({
  rows,
}: {
  rows: ProductImportPreviewRow[];
}) {
  return (
    <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)]">
      <div className="max-h-[360px] overflow-auto">
        <table className="w-full min-w-[1100px] text-left text-sm">
          <thead className="sticky top-0 z-10 bg-[var(--color-surface-card)] text-xs uppercase text-[var(--color-text-muted)]">
            <tr>
              <th className="px-3 py-3">Dòng</th>
              <th className="px-3 py-3">Trạng thái</th>
              <th className="px-3 py-3">Danh mục</th>
              <th className="px-3 py-3">Tên</th>
              <th className="px-3 py-3">SKU</th>
              <th className="px-3 py-3">Barcode</th>
              <th className="px-3 py-3">ĐVT</th>
              <th className="px-3 py-3">Loại</th>
              <th className="px-3 py-3">Nguyên nhân</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border-soft)]">
            {rows.map((row) => (
              <PreviewRow key={row.rowNumber} row={row} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ConfirmSkipInvalidRowsModal({
  validCount,
  errorCount,
  isSubmitting,
  onCancel,
  onConfirm,
}: {
  validCount: number;
  errorCount: number;
  isSubmitting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 px-4 backdrop-blur-sm">
      <div className="w-[500px] overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-white shadow-xl">
        <div className="flex items-start gap-3 border-b border-[var(--color-border-soft)] px-5 py-4">
          <div className="rounded-full bg-red-100 p-2 text-red-600">
            <AlertTriangle size={20} />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
              Bỏ qua dòng lỗi?
            </h3>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              Có {errorCount} dòng lỗi sẽ không được tạo. Hệ thống chỉ tạo{" "}
              {validCount} sản phẩm hợp lệ.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-card)]"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex justify-end gap-3 px-5 py-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="rounded-full border border-[var(--color-border-subtle)] px-4 py-2 text-sm text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-card)] disabled:opacity-50"
          >
            Kiểm tra lại
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 rounded-full bg-[var(--color-brand-primary)] px-4 py-2 text-sm text-white transition-colors hover:bg-[var(--color-brand-primary-hover)] disabled:opacity-50"
          >
            {isSubmitting && <Loader2 size={16} className="animate-spin" />}
            Tiếp tục tạo
          </button>
        </div>
      </div>
    </div>
  );
}

function PreviewRow({ row }: { row: ProductImportPreviewRow }) {
  const hasErrors = row.errors.length > 0;
  const hasWarnings = row.warnings.length > 0;

  return (
    <tr
      className={
        hasErrors
          ? "bg-red-50 text-red-950"
          : hasWarnings
            ? "bg-amber-50"
            : "bg-white"
      }
    >
      <td className="px-3 py-3 font-medium">{row.rowNumber}</td>
      <td className="px-3 py-3">
        <StatusBadge hasErrors={hasErrors} hasWarnings={hasWarnings} />
      </td>
      <td className="px-3 py-3">{row.raw.category_code || "-"}</td>
      <td className="px-3 py-3">{row.raw.name || "-"}</td>
      <td className="px-3 py-3">{row.raw.code || "-"}</td>
      <td className="px-3 py-3">{row.raw.barcode || "-"}</td>
      <td className="px-3 py-3">{row.raw.unit || "-"}</td>
      <td className="px-3 py-3">{row.raw.product_type || "-"}</td>
      <td className="px-3 py-3">
        {[...row.errors, ...row.warnings].length > 0 ? (
          <ul className="space-y-1">
            {[...row.errors, ...row.warnings].map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        ) : (
          "Hợp lệ"
        )}
      </td>
    </tr>
  );
}

function StatusBadge({
  hasErrors,
  hasWarnings,
}: {
  hasErrors: boolean;
  hasWarnings: boolean;
}) {
  if (hasErrors) {
    return (
      <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-1 text-xs font-normal text-red-700">
        Lỗi
      </span>
    );
  }

  if (hasWarnings) {
    return (
      <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-1 text-xs font-normal text-amber-700">
        Cảnh báo
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-1 text-xs font-normal text-emerald-700">
      Hợp lệ
    </span>
  );
}
