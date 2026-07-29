"use client";

import {
  EMPLOYEE_CONTRACT_PDF_MAX_BYTES,
  type EmployeeContract,
  type EmployeeProfile,
} from "@bduck/shared-types";
import { Download, Eye, FileText, Upload } from "lucide-react";
import { useRef, useState } from "react";
import {
  fetchEmployeeContractDocumentDownload,
  uploadEmployeeContractPdf,
} from "@/api/employeeContractApi";
import { Skeleton } from "@/components/ui/Skeleton";
import { useEmployeeContractDocuments } from "@/hooks/useEmployeeContracts";
import { emitDataMutation } from "@/lib/dataInvalidation";
import { showToast } from "@/utils/toast";
import type { EmployeeContractLabels } from "./employeeContractUiTypes";

interface EmployeeContractDocumentsProps {
  profile: EmployeeProfile;
  contract: EmployeeContract;
  labels: EmployeeContractLabels;
  canRead: boolean;
  canManage: boolean;
}

const formatBytes = (bytes: number) =>
  new Intl.NumberFormat("vi-VN", {
    style: "unit",
    unit: bytes >= 1024 * 1024 ? "megabyte" : "kilobyte",
    maximumFractionDigits: 1,
  }).format(bytes / (bytes >= 1024 * 1024 ? 1024 * 1024 : 1024));

const errorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

export function EmployeeContractDocuments({
  profile,
  contract,
  labels,
  canRead,
  canManage,
}: EmployeeContractDocumentsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const { documents, isLoading, error, source } = useEmployeeContractDocuments(
    canRead ? profile.id : null,
    canRead ? contract.id : null,
    profile.user_id,
    profile.workplace_warehouse_id,
    labels.documentLoadError,
  );

  const upload = async (file: File) => {
    if (isUploading) return;
    const validPdf =
      file.type === "application/pdf" ||
      file.name.toLocaleLowerCase().endsWith(".pdf");
    if (
      !validPdf ||
      file.size < 1 ||
      file.size > EMPLOYEE_CONTRACT_PDF_MAX_BYTES
    ) {
      showToast.error(labels.toasts.uploadError, labels.documents.invalidFile);
      return;
    }
    setIsUploading(true);
    try {
      const operation = uploadEmployeeContractPdf(
        profile.id,
        contract.id,
        file,
        labels.toasts.uploadError,
      );
      await showToast.promise(operation, {
        loading: labels.toasts.uploading,
        success: labels.toasts.uploaded,
        error: labels.toasts.uploadError,
        successDescription: file.name,
        errorDescription: (caught) =>
          errorMessage(caught, labels.toasts.uploadError),
        retry: () => void upload(file),
        retryLabel: labels.toasts.retry,
      });
      emitDataMutation(["employee_contract_documents"]);
    } catch (caught) {
      console.error("[EmployeeContractDocuments] upload error:", caught);
    } finally {
      setIsUploading(false);
    }
  };

  const openDocument = async (
    documentId: string,
    fileName: string,
    mode: "view" | "download",
  ) => {
    const previewWindow =
      mode === "view" ? window.open("about:blank", "_blank") : null;
    if (previewWindow) previewWindow.opener = null;
    const operation = fetchEmployeeContractDocumentDownload(
      profile.id,
      contract.id,
      documentId,
      labels.toasts.openError,
      mode,
    );
    try {
      const signed = await showToast.promise(operation, {
        loading: labels.toasts.opening,
        success: labels.toasts.opened,
        error: labels.toasts.openError,
        successDescription: fileName,
        errorDescription: (caught) =>
          errorMessage(caught, labels.toasts.openError),
        retry: () => void openDocument(documentId, fileName, mode),
        retryLabel: labels.toasts.retry,
      });
      if (previewWindow) {
        previewWindow.location.replace(signed.url);
      } else {
        const link = window.document.createElement("a");
        link.href = signed.url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        if (mode === "download") link.download = fileName;
        link.click();
      }
    } catch (caught) {
      previewWindow?.close();
      console.error("[EmployeeContractDocuments] open error:", caught);
    }
  };

  return (
    <section className="space-y-3 border-t border-[var(--color-border-soft)] pt-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h5 className="text-xs font-semibold">{labels.documents.title}</h5>
          <p className="mt-0.5 text-xxs text-[var(--color-text-muted)]">
            {labels.documents.uploadHint}
          </p>
        </div>
        {canManage ? (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.currentTarget.value = "";
                if (file) void upload(file);
              }}
            />
            <button
              type="button"
              disabled={isUploading}
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[var(--color-border-subtle)] px-3 text-xs font-semibold text-[var(--color-brand-primary)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Upload size={13} />
              {labels.actions.upload}
            </button>
          </>
        ) : null}
      </div>
      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : error ? (
        <p className="rounded-xl bg-red-50 p-3 text-xs text-red-700">{error}</p>
      ) : documents.length === 0 ? (
        <p className="rounded-xl bg-[var(--color-surface-card)] p-3 text-xs text-[var(--color-text-muted)]">
          {labels.documents.empty}
        </p>
      ) : (
        <div className="space-y-2">
          {documents.map((document) => (
            <article
              key={document.id}
              className="flex items-center gap-3 rounded-xl border border-[var(--color-border-subtle)] p-3"
            >
              <FileText
                size={18}
                className="shrink-0 text-[var(--color-brand-primary)]"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold">
                  {document.original_file_name}
                </p>
                <p className="mt-0.5 text-xxs text-[var(--color-text-muted)]">
                  {labels.documents.version} {document.version} ·{" "}
                  {formatBytes(document.file_size)}
                  {document.is_current ? ` · ${labels.documents.current}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  void openDocument(
                    document.id,
                    document.original_file_name,
                    "view",
                  )
                }
                aria-label={labels.actions.view}
                title={labels.actions.view}
                className="rounded-full p-2 text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-card)]"
              >
                <Eye size={15} />
              </button>
              <button
                type="button"
                onClick={() =>
                  void openDocument(
                    document.id,
                    document.original_file_name,
                    "download",
                  )
                }
                aria-label={labels.actions.download}
                title={labels.actions.download}
                className="rounded-full p-2 text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-card)]"
              >
                <Download size={15} />
              </button>
            </article>
          ))}
          <p className="text-right text-xxs text-[var(--color-text-muted)]">
            {source === "realtime" ? labels.realtime : labels.apiFallback}
          </p>
        </div>
      )}
    </section>
  );
}
