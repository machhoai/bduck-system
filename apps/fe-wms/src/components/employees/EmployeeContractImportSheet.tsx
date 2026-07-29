"use client";

import {
  EMPLOYEE_CONTRACT_IMPORT_EXCEL_MAX_BYTES,
  EMPLOYEE_CONTRACT_PDF_MAX_BYTES,
  EmployeeContractImportBatchStatus,
  type EmployeeContractImportBatchView,
} from "@bduck/shared-types";
import { Download, FileSpreadsheet, Files, UploadCloud } from "lucide-react";
import { useRef, useState } from "react";

import {
  commitEmployeeContractImportBatch,
  fetchEmployeeContractImportBatch,
  previewEmployeeContractHistoryFiles,
} from "@/api/employeeContractImportApi";
import { useTranslation } from "@/lib/i18n";
import { employeeContractImportTranslations } from "@/lib/i18n/employeeContractImportTranslations";
import { emitDataMutation } from "@/lib/dataInvalidation";
import { showToast } from "@/utils/toast";
import { EmployeeContractImportPreview } from "./EmployeeContractImportPreview";
import { EmployeeContractSheet } from "./EmployeeContractSheet";

export function EmployeeContractImportSheet({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { lang } = useTranslation();
  const labels = employeeContractImportTranslations[lang];
  const excelRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<HTMLInputElement>(null);
  const [excel, setExcel] = useState<File | null>(null);
  const [pdfs, setPdfs] = useState<File[]>([]);
  const [preview, setPreview] =
    useState<EmployeeContractImportBatchView | null>(null);
  const [busy, setBusy] = useState(false);

  const chooseExcel = (file?: File) => {
    if (!file) return;
    if (
      !file.name.toLowerCase().endsWith(".xlsx") ||
      file.size < 1 ||
      file.size > EMPLOYEE_CONTRACT_IMPORT_EXCEL_MAX_BYTES
    ) {
      showToast.error(labels.saveError, labels.fileInvalid);
      return;
    }
    setExcel(file);
    setPreview(null);
  };

  const choosePdfs = (list?: FileList | null) => {
    const files = Array.from(list ?? []);
    if (
      files.some(
        (file) =>
          file.type !== "application/pdf" ||
          file.size < 1 ||
          file.size > EMPLOYEE_CONTRACT_PDF_MAX_BYTES,
      )
    ) {
      showToast.error(labels.saveError, labels.fileInvalid);
      return;
    }
    setPdfs(files);
    setPreview(null);
  };

  const createPreview = async () => {
    if (!excel || busy) return;
    setBusy(true);
    const operation = previewEmployeeContractHistoryFiles(
      excel,
      pdfs,
      labels.saveError,
    );
    try {
      const result = await showToast.promise(operation, {
        loading: labels.loading,
        success: labels.previewed,
        error: labels.saveError,
        successDescription: labels.successHint,
        errorDescription: (error) =>
          error instanceof Error ? error.message : labels.errorHint,
        retry: () => void createPreview(),
        retryLabel: labels.retry,
      });
      setPreview(result);
    } catch (error) {
      console.error("[EmployeeContractImportSheet] preview error:", error);
    } finally {
      setBusy(false);
    }
  };

  const commit = async () => {
    if (!preview || preview.batch.invalid_rows > 0 || busy) return;
    setBusy(true);
    const operation = commitEmployeeContractImportBatch(
        preview.batch.id,
        {
          expected_batch_checksum: preview.batch.source_file_checksum,
          idempotency_key: `contract-import-commit-${preview.batch.id}`,
          action_time: new Date(),
        },
        labels.saveError,
      )
      .then(async (result) => {
        emitDataMutation([
          "employee_contracts",
          "employee_contract_documents",
        ]);
        if (result.batch.status === EmployeeContractImportBatchStatus.FAILED) {
          setPreview(
            await fetchEmployeeContractImportBatch(
              result.batch.id,
              labels.saveError,
            ),
          );
          throw new Error(
            result.batch.failure_message?.[lang] ?? labels.errorHint,
          );
        }
        setPreview((current) =>
          current ? { ...current, batch: result.batch } : current,
        );
        return result;
      });
    try {
      const result = await showToast.promise(operation, {
        loading: labels.committing,
        success: labels.commitSuccess,
        error: labels.saveError,
        successDescription: labels.successHint,
        errorDescription: (error) =>
          error instanceof Error ? error.message : labels.errorHint,
        retry: () => void commit(),
        retryLabel: labels.retry,
      });
    } catch (error) {
      console.error("[EmployeeContractImportSheet] commit error:", error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <EmployeeContractSheet
      isOpen={isOpen}
      title={labels.title}
      closeLabel={labels.close}
      onClose={onClose}
    >
      <div className="space-y-4">
        <p className="text-xs text-slate-600">{labels.intro}</p>
        <a
          href="/templates/employee-contract-history-import-v1.xlsx"
          download
          className="inline-flex h-9 items-center gap-2 rounded-xl border border-blue-200 px-3 text-xs font-semibold text-blue-700"
        >
          <Download size={15} /> {labels.template}
        </a>
        <div className="grid gap-3 sm:grid-cols-2">
          <FilePicker
            title={labels.excel}
            hint={labels.excelHint}
            value={excel?.name}
            icon={FileSpreadsheet}
            action={labels.chooseExcel}
            onClick={() => excelRef.current?.click()}
            disabled={busy}
          />
          <FilePicker
            title={labels.pdf}
            hint={labels.pdfHint}
            value={pdfs.length ? `${labels.selectedPdf}: ${pdfs.length}` : undefined}
            icon={Files}
            action={labels.choosePdf}
            onClick={() => pdfRef.current?.click()}
            disabled={busy}
          />
        </div>
        <input
          ref={excelRef}
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="hidden"
          onChange={(event) => chooseExcel(event.target.files?.[0])}
        />
        <input
          ref={pdfRef}
          type="file"
          accept="application/pdf,.pdf"
          multiple
          className="hidden"
          onChange={(event) => choosePdfs(event.target.files)}
        />
        <button
          type="button"
          onClick={() => void createPreview()}
          disabled={!excel || busy}
          className="h-11 w-full rounded-xl bg-blue-600 text-sm font-semibold text-white disabled:opacity-50"
        >
          {labels.preview}
        </button>
        {preview ? (
          <>
            <EmployeeContractImportPreview
              preview={preview}
              labels={labels}
              locale={lang}
            />
            <button
              type="button"
              onClick={() => void commit()}
              disabled={
                busy ||
                preview.batch.invalid_rows > 0 ||
                preview.batch.status ===
                  EmployeeContractImportBatchStatus.COMPLETED
              }
              className="h-11 w-full rounded-xl bg-emerald-600 text-sm font-semibold text-white disabled:opacity-50"
            >
              {preview.batch.status ===
              EmployeeContractImportBatchStatus.COMPLETED
                ? labels.committed
                : labels.commit}
            </button>
          </>
        ) : null}
      </div>
    </EmployeeContractSheet>
  );
}

function FilePicker({
  title,
  hint,
  value,
  icon: Icon,
  action,
  onClick,
  disabled,
}: {
  title: string;
  hint: string;
  value?: string;
  icon: typeof UploadCloud;
  action: string;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex min-h-28 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-3 text-center disabled:opacity-50"
    >
      <Icon size={22} className="text-blue-600" />
      <span className="mt-2 text-sm font-semibold text-slate-800">{title}</span>
      <span className="mt-0.5 text-[10px] text-slate-500">{hint}</span>
      <span className="mt-2 max-w-full truncate text-xs font-medium text-blue-700">
        {value ?? action}
      </span>
    </button>
  );
}
