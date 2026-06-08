"use client";

import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import {
  summarizeExpenseImportRows,
  type ExpenseImportPreviewRow,
} from "@/utils/expenseExcelImport";

export function ExpenseExcelImportSummary({
  rows,
}: {
  rows: ExpenseImportPreviewRow[];
}) {
  const { t } = useTranslation();
  const summary = summarizeExpenseImportRows(rows);

  return (
    <div className="mt-3 space-y-2">
      <ImportStats summary={summary} />
      {summary.errorRows > 0 ? (
        <ImportErrors rows={rows} />
      ) : summary.importableRows > 0 ? (
        <div className="flex items-center gap-2 rounded-radius-sm border border-accent-success/20 bg-accent-success/10 p-2 text-xs text-accent-success">
          <CheckCircle2 size={14} className="shrink-0" />
          <span>
            {summary.importableRows} {t.expenses.excel.summary.readyRows}
          </span>
        </div>
      ) : null}
    </div>
  );
}

function ImportStats({
  summary,
}: {
  summary: ReturnType<typeof summarizeExpenseImportRows>;
}) {
  const { t } = useTranslation();
  const items = [
    { label: t.expenses.excel.summary.totalRows, value: summary.totalRows },
    { label: t.expenses.excel.summary.fixedRows, value: summary.standardRows },
    {
      label: t.expenses.excel.summary.customCreateRows,
      value: summary.customCreateRows,
    },
    { label: t.expenses.excel.summary.errorRows, value: summary.errorRows },
  ];

  return (
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-radius-sm border border-border-soft bg-surface-card p-2"
        >
          <p className="text-xxs font-medium uppercase tracking-wider text-text-muted">
            {item.label}
          </p>
          <p className="mt-0.5 text-sm font-semibold tabular-nums text-text-primary">
            {item.value}
          </p>
        </div>
      ))}
    </div>
  );
}

function ImportErrors({ rows }: { rows: ExpenseImportPreviewRow[] }) {
  const { t } = useTranslation();
  const errorRows = rows.filter((row) => row.errors.length > 0).slice(0, 6);

  return (
    <div className="rounded-radius-sm border border-accent-error/20 bg-accent-error/10 p-2">
      <div className="flex items-center gap-2 text-xs font-semibold text-accent-error">
        <AlertTriangle size={14} />
        {t.expenses.excel.summary.errorRows}
      </div>
      <ul className="mt-1 space-y-1 text-xs text-accent-error">
        {errorRows.map((row) => (
          <li key={row.rowNumber}>
            {t.expenses.excel.summary.row} {row.rowNumber}:{" "}
            {row.errors.join("; ")}
          </li>
        ))}
      </ul>
    </div>
  );
}
