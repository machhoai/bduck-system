"use client";

import { useMemo, useRef, useState } from "react";
import type { DragEvent } from "react";
import { ExpenseCategory } from "@bduck/shared-types";
import type { ExpenseDocument, ExpenseItem } from "@bduck/shared-types";
import { gooeyToast } from "goey-toast";
import {
  Download,
  FileSpreadsheet,
  Loader2,
  Upload,
} from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import {
  parseExpenseImportFile,
  summarizeExpenseImportRows,
  type ExpenseImportPreviewRow,
} from "@/utils/expenseExcelImport";
import { downloadExpenseImportTemplate } from "@/utils/expenseExcelTemplate";
import { ExpenseExcelImportSummary } from "./ExpenseExcelImportSummary";

const MAX_XLSX_SIZE = 10 * 1024 * 1024;

interface ExpenseExcelImportPanelProps {
  data: ExpenseDocument;
  isClosed: boolean;
  onSaveItem: (
    category: ExpenseCategory,
    itemData: Partial<ExpenseItem>,
  ) => Promise<void>;
  onSaveCustomItem: (
    itemId: string,
    data: {
      label: string;
      cost_center: string;
      actual_amount: number;
      budget_amount: number | null;
      note?: string | null;
    },
  ) => Promise<void>;
}

export default function ExpenseExcelImportPanel({
  data,
  isClosed,
  onSaveItem,
  onSaveCustomItem,
}: ExpenseExcelImportPanelProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<ExpenseImportPreviewRow[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const excelText = t.expenses.excel;
  const labels = useMemo(
    () => ({
      costCenter: t.expenses.costCenter,
      category: t.expenses.category,
    }),
    [t],
  );
  const busy = isParsing || isImporting || isDownloading;
  const uploadDisabled = isClosed || busy;

  const submitRows = async (parsedRows: ExpenseImportPreviewRow[]) => {
    const importableRows = parsedRows.filter(
      (row) => !row.skipped && row.errors.length === 0 && row.target,
    );

    if (importableRows.length === 0) {
      gooeyToast.error(excelText.toast.noRowsTitle, {
        description: excelText.toast.noRowsDescription,
      });
      return;
    }

    const createdCustomIds = new Map<string, string>();
    const importAction = async () => {
      setIsImporting(true);
      try {
        for (const row of importableRows) {
          const target = row.target;
          if (!target) continue;

          if (target.type === "standard") {
            const itemData: Partial<ExpenseItem> = {};
            if (row.budgetAmount !== undefined) {
              itemData.budget_amount = row.budgetAmount;
            }
            if (row.actualAmount !== undefined) {
              itemData.actual_amount = row.actualAmount;
            }
            if (row.note !== undefined) {
              itemData.note = row.note;
            }
            if (Object.keys(itemData).length > 0) {
              await onSaveItem(target.category, itemData);
            }
            continue;
          }

          const duplicateKey = `${target.costCenter}:${target.label.trim().toLowerCase()}`;
          const existing = target.itemId
            ? data.custom_items?.[target.itemId]
            : undefined;
          const itemId =
            target.itemId ??
            createdCustomIds.get(duplicateKey) ??
            crypto.randomUUID();
          createdCustomIds.set(duplicateKey, itemId);

          await onSaveCustomItem(itemId, {
            label: target.label,
            cost_center: target.costCenter,
            actual_amount: row.actualAmount ?? existing?.actual_amount ?? 0,
            budget_amount: row.budgetAmount ?? existing?.budget_amount ?? null,
            note: row.note ?? existing?.note ?? null,
          });
        }

        return importableRows.length;
      } finally {
        setIsImporting(false);
      }
    };

    try {
      await gooeyToast.promise(importAction(), {
        loading: excelText.toast.importing,
        success: excelText.toast.imported,
        error: excelText.toast.importFailed,
        description: {
          success: `${importableRows.length} ${excelText.toast.importedRowsSuffix}`,
          error: excelText.toast.importFailedDescription,
        },
        action: {
          error: {
            label: excelText.toast.retry,
            onClick: () => void submitRows(parsedRows),
          },
        },
      });
    } catch (error) {
      console.error("[ExpenseExcelImportPanel] import error:", error);
    }
  };

  const parseFile = async (file: File) => {
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (extension !== "xlsx") {
      gooeyToast.error(excelText.toast.invalidFileTitle, {
        description: excelText.toast.invalidFileDescription,
      });
      return;
    }

    if (file.size > MAX_XLSX_SIZE) {
      gooeyToast.error(excelText.toast.fileTooLargeTitle, {
        description: excelText.toast.fileTooLargeDescription,
      });
      return;
    }

    setIsParsing(true);
    try {
      const parsedRows = await parseExpenseImportFile(file, {
        data,
        labels,
        text: {
          columns: excelText.template.columns,
          errors: excelText.errors,
        },
      });
      const parsedSummary = summarizeExpenseImportRows(parsedRows);
      setRows(parsedRows);
      setFileName(file.name);

      if (parsedSummary.errorRows > 0) {
        gooeyToast.error(excelText.toast.parseHasErrorsTitle, {
          description: `${parsedSummary.errorRows} ${excelText.toast.parseHasErrorsSuffix}`,
        });
        return;
      }

      await submitRows(parsedRows);
    } catch (error) {
      console.error("[ExpenseExcelImportPanel] parse error:", error);
      gooeyToast.error(excelText.toast.parseFailedTitle, {
        description:
          error instanceof Error
            ? error.message
            : excelText.toast.parseFailedDescription,
      });
    } finally {
      setIsParsing(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleFileInput = (files: FileList | null) => {
    if (uploadDisabled) return;
    const file = files?.[0];
    if (file) void parseFile(file);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    handleFileInput(event.dataTransfer.files);
  };

  const handleDownloadTemplate = async () => {
    setIsDownloading(true);
    try {
      await downloadExpenseImportTemplate({
        labels,
        text: excelText.template,
      });
    } catch (error) {
      console.error("[ExpenseExcelImportPanel] template error:", error);
      gooeyToast.error(excelText.toast.templateFailedTitle, {
        description:
          error instanceof Error
            ? error.message
            : excelText.toast.templateFailedDescription,
      });
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="w-full rounded-radius-lg border border-border-soft bg-surface-elevated p-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex min-w-56 flex-1 items-start gap-2">
          <FileSpreadsheet size={18} className="mt-0.5 shrink-0 text-brand-primary" />
          <div>
            <h3 className="text-sm font-semibold text-text-primary">
              {excelText.title}
            </h3>
            <p className="text-xs text-text-muted">{excelText.subtitle}</p>
            {isClosed && (
              <p className="mt-1 text-xxs font-medium text-accent-warning">
                {excelText.closedHint}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void handleDownloadTemplate()}
            disabled={busy}
            className="flex h-8 w-fit items-center gap-1.5 rounded-radius-sm border border-brand-primary/40 px-3 text-xs font-semibold text-brand-primary transition-colors hover:bg-brand-primary/10 disabled:opacity-50"
            aria-label={excelText.actions.downloadTemplate}
          >
            {isDownloading ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Download size={13} />
            )}
            {excelText.actions.downloadTemplate}
          </button>

          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploadDisabled}
            className="flex h-8 w-fit items-center gap-1.5 rounded-radius-sm bg-brand-primary px-3 text-xs font-semibold text-text-on-dark transition-colors hover:bg-brand-primary/90 disabled:opacity-50"
            aria-label={excelText.actions.chooseFile}
          >
            {isParsing || isImporting ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Upload size={13} />
            )}
            {excelText.actions.chooseFile}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx"
            className="hidden"
            onChange={(event) => handleFileInput(event.target.files)}
          />
        </div>
      </div>

      <div
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleDrop}
        className={`mt-3 flex min-h-16 items-center justify-center rounded-radius-sm border border-dashed p-2 text-center text-xs transition-colors ${
          uploadDisabled
            ? "border-border-soft bg-surface-base text-text-muted"
            : "border-border-subtle bg-surface-card text-text-secondary hover:border-brand-primary"
        }`}
      >
        {fileName || excelText.dropHint}
      </div>

      {rows.length > 0 && <ExpenseExcelImportSummary rows={rows} />}
    </div>
  );
}
