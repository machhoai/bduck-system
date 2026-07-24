"use client";

import {
  LeaveImportBatchStatus,
  type LeaveImportBatch,
  type LeaveImportBatchView,
  type LeaveImportCommitResult,
  type LeaveImportEmployeeOption,
  type PreviewLeaveImportInput,
} from "@bduck/shared-types";
import { gooeyToast } from "goey-toast";
import { Download, FileSpreadsheet, UploadCloud } from "lucide-react";
import { useRef, useState } from "react";
import { uploadFile } from "@/lib/uploadFile";
import { useUserStore } from "@/stores/useUserStore";
import {
  calculateLeaveImportChecksum,
  downloadLeaveImportTemplate,
  validateLeaveImportFile,
} from "@/utils/leaveImportExcel";
import { LeaveImportPreviewTable } from "./LeaveImportPreviewTable";
import { LeaveImportBatchHistory } from "./LeaveImportBatchHistory";

interface LeaveHistoryImportManagerProps {
  labels: Record<string, string>;
  batches: LeaveImportBatch[];
  employeeOptions: LeaveImportEmployeeOption[];
  preview: LeaveImportBatchView | null;
  loading: boolean;
  error: string | null;
  onPreview: (input: PreviewLeaveImportInput) => Promise<LeaveImportBatchView>;
  onOpenBatch: (batchId: string) => Promise<LeaveImportBatchView>;
  onCommit: (
    batchId: string,
    input: { action_time: Date },
  ) => Promise<LeaveImportCommitResult>;
}

export function LeaveHistoryImportManager(
  props: LeaveHistoryImportManagerProps,
) {
  const { labels, batches, employeeOptions, preview, loading, error } = props;
  const inputRef = useRef<HTMLInputElement>(null);
  const userId = useUserStore((state) => state.user?.id);
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [isBusy, setIsBusy] = useState(false);

  const selectFile = (nextFile?: File) => {
    if (!nextFile) return;
    const validation = validateLeaveImportFile(nextFile, labels);
    if (validation) {
      gooeyToast.error(labels.leaveImportInvalidFile, {
        description: validation,
        preset: "snappy",
      });
      return;
    }
    setFile(nextFile);
    setProgress(0);
  };

  const downloadTemplate = async () => {
    if (employeeOptions.length === 0) {
      gooeyToast.error(labels.leaveImportTemplateError, {
        description: labels.leaveImportNoEmployees,
        preset: "snappy",
      });
      return;
    }
    const action = () => downloadLeaveImportTemplate(labels, employeeOptions);
    try {
      await gooeyToast.promise(action(), {
        loading: labels.leaveImportTemplateGenerating,
        success: labels.leaveImportTemplateReady,
        error: labels.leaveImportTemplateError,
        description: {
          success: labels.leaveImportTemplateReadyHint,
          error: labels.leaveImportRetryHint,
        },
        action: {
          error: {
            label: labels.retry,
            onClick: () => void downloadTemplate(),
          },
        },
      });
    } catch (downloadError) {
      console.error(
        "[LeaveHistoryImportManager] template error:",
        downloadError,
      );
    }
  };

  const createPreview = async () => {
    if (!file || isBusy) return;
    const action = async () => {
      setIsBusy(true);
      setProgress(0);
      const [sourceFileUrl, checksum] = await Promise.all([
        uploadFile(file, `leave-imports/${userId || "unknown"}`, setProgress),
        calculateLeaveImportChecksum(file),
      ]);
      return props.onPreview({
        source_file_name: file.name,
        source_file_url: sourceFileUrl,
        source_file_checksum: checksum,
        action_time: new Date(),
      });
    };
    try {
      await gooeyToast.promise(action(), {
        loading: labels.leaveImportPreviewing,
        success: labels.leaveImportPreviewReady,
        error: labels.leaveImportPreviewError,
        description: {
          success: labels.leaveImportPreviewReadyHint,
          error: labels.leaveImportRetryHint,
        },
        action: {
          error: {
            label: labels.retry,
            onClick: () => void createPreview(),
          },
        },
      });
    } catch (previewError) {
      console.error("[LeaveHistoryImportManager] preview error:", previewError);
    } finally {
      setIsBusy(false);
    }
  };

  const commit = async () => {
    if (!preview || isBusy || preview.batch.invalid_rows > 0) return;
    const action = async () => {
      setIsBusy(true);
      return props.onCommit(preview.batch.id, { action_time: new Date() });
    };
    try {
      await gooeyToast.promise(action(), {
        loading: labels.leaveImportCommitting,
        success: labels.leaveImportCommitted,
        error: labels.leaveImportCommitError,
        description: {
          success: labels.leaveImportCommittedHint,
          error: labels.leaveImportRetryHint,
        },
        action: {
          error: {
            label: labels.retry,
            onClick: () => void commit(),
          },
        },
      });
    } catch (commitError) {
      console.error("[LeaveHistoryImportManager] commit error:", commitError);
    } finally {
      setIsBusy(false);
    }
  };

  const openBatch = async (batchId: string) => {
    if (isBusy) return;
    setIsBusy(true);
    try {
      await gooeyToast.promise(props.onOpenBatch(batchId), {
        loading: labels.leaveImportLoadingBatch,
        success: labels.leaveImportBatchLoaded,
        error: labels.leaveImportLoadError,
        description: {
          success: labels.leaveImportBatchLoadedHint,
          error: labels.leaveImportRetryHint,
        },
        action: {
          error: {
            label: labels.retry,
            onClick: () => void openBatch(batchId),
          },
        },
      });
    } catch (openError) {
      console.error("[LeaveHistoryImportManager] open batch error:", openError);
    } finally {
      setIsBusy(false);
    }
  };

  if (loading && batches.length === 0 && !preview) {
    return (
      <div className="space-y-3">
        <div className="h-28 animate-pulse rounded-2xl bg-slate-100" />
        <div className="h-44 animate-pulse rounded-2xl bg-slate-100" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-2xl bg-rose-50 p-3 text-xs text-rose-700">
          {error}
        </div>
      )}
      <section className="rounded-2xl border border-[var(--color-border-soft)] p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-slate-900">
              {labels.leaveImportSelectFile}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              {labels.leaveImportSelectFileHint}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void downloadTemplate()}
            disabled={isBusy || loading}
            className="inline-flex h-9 items-center gap-2 rounded-xl border border-blue-200 px-3 text-xs font-semibold text-blue-700 disabled:opacity-50"
          >
            <Download size={15} />
            {labels.leaveImportDownloadTemplate}
          </button>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="hidden"
          onChange={(event) => selectFile(event.target.files?.[0])}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isBusy}
          className="mt-3 flex min-h-24 w-full flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 text-center disabled:opacity-50"
        >
          {file ? (
            <>
              <FileSpreadsheet className="text-emerald-600" size={24} />
              <span className="mt-2 max-w-full truncate text-sm font-semibold text-slate-800">
                {file.name}
              </span>
              <span className="text-xs text-slate-500">
                {(file.size / 1024).toFixed(1)} KB
              </span>
            </>
          ) : (
            <>
              <UploadCloud className="text-blue-600" size={24} />
              <span className="mt-2 text-sm font-semibold text-slate-700">
                {labels.leaveImportChooseFile}
              </span>
            </>
          )}
        </button>
        {progress > 0 && progress < 100 && (
          <progress
            value={progress}
            max={100}
            className="mt-3 h-2 w-full accent-blue-600"
          />
        )}
        <button
          type="button"
          onClick={() => void createPreview()}
          disabled={!file || isBusy}
          className="mt-3 h-10 w-full rounded-xl bg-blue-600 text-sm font-semibold text-white disabled:opacity-50"
        >
          {labels.leaveImportPreview}
        </button>
      </section>

      {preview && (
        <>
          <LeaveImportPreviewTable labels={labels} preview={preview} />
          <button
            type="button"
            onClick={() => void commit()}
            disabled={
              isBusy ||
              preview.batch.invalid_rows > 0 ||
              preview.batch.status === LeaveImportBatchStatus.COMMITTED
            }
            className="h-11 w-full rounded-xl bg-emerald-600 text-sm font-semibold text-white disabled:opacity-50"
          >
            {preview.batch.status === LeaveImportBatchStatus.COMMITTED
              ? labels.leaveImportAlreadyCommitted
              : labels.leaveImportCommit}
          </button>
        </>
      )}

      <LeaveImportBatchHistory
        labels={labels}
        batches={batches}
        disabled={isBusy}
        onOpen={(batchId) => void openBatch(batchId)}
      />
    </div>
  );
}
