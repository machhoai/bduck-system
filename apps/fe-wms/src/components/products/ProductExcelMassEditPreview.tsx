"use client";

import { AlertTriangle, Loader2, X } from "lucide-react";
import type {
  ProductMassEditPreviewRow,
  summarizeProductMassEditRows,
} from "@/utils/productExcelMassEdit";
import { useTranslation } from "@/lib/i18n";
import { EXCEL_PREVIEW_TEXT } from "@/lib/i18n/componentTranslations";

type ExcelPreviewCopy =
  (typeof EXCEL_PREVIEW_TEXT)[keyof typeof EXCEL_PREVIEW_TEXT];

export function ProductMassEditStats({
  summary,
}: {
  summary: ReturnType<typeof summarizeProductMassEditRows>;
}) {
  const { lang } = useTranslation();
  const copy = EXCEL_PREVIEW_TEXT[lang === "zh" ? "zh" : "vi"];
  const items = [
    { label: copy.productsRead, value: summary.totalRows, tone: "neutral" },
    { label: copy.validRows, value: summary.validRows, tone: "success" },
    { label: copy.errorRows, value: summary.errorRows, tone: "error" },
    { label: copy.duplicateWarnings, value: summary.warningRows, tone: "warning" },
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
                  ? "text-[var(--color-status-pending-text)]"
                  : item.tone === "success"
                    ? "text-[var(--color-success-icon)]"
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

export function ProductMassEditPreviewTable({
  rows,
}: {
  rows: ProductMassEditPreviewRow[];
}) {
  const { lang } = useTranslation();
  const copy = EXCEL_PREVIEW_TEXT[lang === "zh" ? "zh" : "vi"];
  return (
    <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)]">
      <div className="max-h-[360px] overflow-auto">
        <table className="w-full min-w-[1100px] text-left text-sm">
          <thead className="sticky top-0 z-10 bg-[var(--color-surface-card)] text-xs uppercase text-[var(--color-text-muted)]">
            <tr>
              <th className="px-3 py-3">{copy.row}</th>
              <th className="px-3 py-3">{copy.status}</th>
              <th className="px-3 py-3">{copy.category}</th>
              <th className="px-3 py-3">{copy.name}</th>
              <th className="px-3 py-3">{copy.sku}</th>
              <th className="px-3 py-3">{copy.barcode}</th>
              <th className="px-3 py-3">{copy.unit}</th>
              <th className="px-3 py-3">{copy.type}</th>
              <th className="px-3 py-3">{copy.reason}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border-soft)]">
            {rows.map((row) => (
              <PreviewRow key={row.rowNumber} row={row} copy={copy} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ConfirmSkipInvalidRowsMassEditModal({
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
  const { lang } = useTranslation();
  const copy = EXCEL_PREVIEW_TEXT[lang === "zh" ? "zh" : "vi"];
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 px-4 backdrop-blur-sm">
      <div className="w-[500px] overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-white shadow-xl">
        <div className="flex items-start gap-3 border-b border-[var(--color-border-soft)] px-5 py-4">
          <div className="rounded-full bg-[var(--color-error-bg-muted)] p-2 text-[var(--color-error-icon)]">
            <AlertTriangle size={20} />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
              {copy.skipInvalidTitle}
            </h3>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              {copy.updateSkipInvalidDescription
                .replace("{{errorCount}}", String(errorCount))
                .replace("{{validCount}}", String(validCount))}
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
            {copy.reviewAgain}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 rounded-full bg-[var(--color-brand-primary)] px-4 py-2 text-sm text-white transition-colors hover:bg-[var(--color-brand-primary-hover)] disabled:opacity-50"
          >
            {isSubmitting && <Loader2 size={16} className="animate-spin" />}
            {copy.continueUpdate}
          </button>
        </div>
      </div>
    </div>
  );
}

function PreviewRow({
  row,
  copy,
}: {
  row: ProductMassEditPreviewRow;
  copy: ExcelPreviewCopy;
}) {
  const hasErrors = row.errors.length > 0;
  const hasWarnings = row.warnings.length > 0;

  return (
    <tr
      className={
        hasErrors
          ? "bg-[var(--color-error-bg)] text-[var(--color-error-text-strong)]"
          : hasWarnings
            ? "bg-[var(--color-status-pending-bg)]"
            : "bg-white"
      }
    >
      <td className="px-3 py-3 font-medium">{row.rowNumber}</td>
      <td className="px-3 py-3">
        <StatusBadge hasErrors={hasErrors} hasWarnings={hasWarnings} copy={copy} />
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
          copy.valid
        )}
      </td>
    </tr>
  );
}

function StatusBadge({
  hasErrors,
  hasWarnings,
  copy,
}: {
  hasErrors: boolean;
  hasWarnings: boolean;
  copy: ExcelPreviewCopy;
}) {
  if (hasErrors) {
    return (
      <span className="inline-flex items-center rounded-full bg-[var(--color-error-bg-muted)] px-2 py-1 text-xs font-normal text-[var(--color-error-text)]">
        {copy.error}
      </span>
    );
  }

  if (hasWarnings) {
    return (
      <span className="inline-flex items-center rounded-full bg-[var(--color-status-pending-bg-muted)] px-2 py-1 text-xs font-normal text-[var(--color-status-pending-text)]">
        {copy.warning}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-full bg-[var(--color-status-completed-bg-muted)] px-2 py-1 text-xs font-normal text-[var(--color-status-completed-text)]">
      {copy.valid}
    </span>
  );
}
