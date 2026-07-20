"use client";

import dynamic from "next/dynamic";
import { useMemo, useRef, useState } from "react";
import {
  Download,
  Eye,
  FileText,
  Search,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import { gooeyToast } from "goey-toast";
import type { ProcessDocument, ProcessDocumentType } from "@bduck/shared-types";
import type { CreateProcessDocumentPayload } from "@/hooks/useProcessDocuments";
import type { Language } from "@/lib/i18n";
import { formatFileSize, uploadFile, validateFile } from "@/lib/uploadFile";
import { useUserStore } from "@/stores/useUserStore";
import {
  normalizeFileLibrarySearch,
  toFileLibraryDate,
} from "@/utils/fileLibrary";
import {
  getProcessDocumentTypeLabel,
  PROCESS_DOCUMENT_TYPE_OPTIONS,
} from "@/utils/processDocumentTypes";

const PdfViewer = dynamic(
  () =>
    import("@/components/shared/PdfViewer").then((module) => module.PdfViewer),
  { ssr: false },
);

interface Props {
  documents: ProcessDocument[];
  loading: boolean;
  canUpload: boolean;
  canDelete: boolean;
  lang: Language;
  onCreate: (payload: CreateProcessDocumentPayload) => Promise<unknown>;
  onDelete: (id: string) => Promise<unknown>;
}

const text = {
  vi: {
    title: "Tên quy trình",
    titlePlaceholder: "VD: Quy trình kiểm kê định kỳ",
    description: "Mô tả",
    descriptionPlaceholder: "Mô tả ngắn về phạm vi áp dụng",
    processType: "Loại quy trình",
    allTypes: "Tất cả loại quy trình",
    search: "Tìm theo tên, mô tả, tên tệp hoặc loại quy trình...",
    noResults: "Không tìm thấy quy trình phù hợp với bộ lọc.",
    choose: "Chọn tệp PDF",
    change: "Đổi tệp",
    remove: "Bỏ tệp",
    hint: "Chỉ chấp nhận PDF, tối đa 20MB.",
    upload: "Tải lên quy trình",
    uploading: "Đang tải lên tài liệu quy trình...",
    uploaded: "Đã tải lên tài liệu quy trình",
    uploadError: "Không thể tải lên tài liệu quy trình",
    invalid: "Chỉ chấp nhận tệp PDF hợp lệ, tối đa 20MB.",
    missing: "Vui lòng nhập tên quy trình và chọn tệp PDF.",
    view: "Xem trực tiếp",
    download: "Tải xuống",
    delete: "Xóa",
    deleteConfirm: "Xóa tài liệu quy trình này?",
    deleted: "Đã xóa tài liệu quy trình",
    deleteError: "Không thể xóa tài liệu quy trình",
    empty: "Chưa có tài liệu quy trình",
    emptyHint:
      "Các quy trình PDF đã tải lên sẽ xuất hiện tại đây và có thể xem trực tiếp.",
  },
  zh: {
    title: "流程名称",
    titlePlaceholder: "例如：定期盘点流程",
    description: "描述",
    descriptionPlaceholder: "简要说明适用范围",
    processType: "流程类型",
    allTypes: "所有流程类型",
    search: "按名称、描述、文件名或流程类型搜索...",
    noResults: "未找到符合筛选条件的流程。",
    choose: "选择 PDF 文件",
    change: "更换文件",
    remove: "移除文件",
    hint: "仅支持 PDF，最大 20MB。",
    upload: "上传流程文档",
    uploading: "正在上传流程文档...",
    uploaded: "流程文档已上传",
    uploadError: "无法上传流程文档",
    invalid: "仅支持有效的 PDF 文件，最大 20MB。",
    missing: "请输入流程名称并选择 PDF 文件。",
    view: "在线查看",
    download: "下载",
    delete: "删除",
    deleteConfirm: "删除此流程文档？",
    deleted: "流程文档已删除",
    deleteError: "无法删除流程文档",
    empty: "暂无流程文档",
    emptyHint: "上传的 PDF 流程文档会显示在此处并可在线查看。",
  },
};

export default function ProcessDocumentTab({
  documents,
  loading,
  canUpload,
  canDelete,
  lang,
  onCreate,
  onDelete,
}: Props) {
  const copy = text[lang];
  const [viewing, setViewing] = useState<ProcessDocument | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<ProcessDocumentType | "ALL">(
    "ALL",
  );
  const filteredDocuments = useMemo(() => {
    const keyword = normalizeFileLibrarySearch(search);
    return documents.filter((document) => {
      const processType = document.process_type || "general";
      if (typeFilter !== "ALL" && processType !== typeFilter) return false;
      if (!keyword) return true;
      return normalizeFileLibrarySearch(
        [
          document.title,
          document.description || "",
          document.file_name,
          processType,
          getProcessDocumentTypeLabel(processType, lang),
        ].join(" "),
      ).includes(keyword);
    });
  }, [documents, lang, search, typeFilter]);

  const remove = async (document: ProcessDocument) => {
    if (!window.confirm(copy.deleteConfirm)) return;
    try {
      await onDelete(document.id);
      gooeyToast.success(copy.deleted);
    } catch {
      gooeyToast.error(copy.deleteError);
    }
  };

  return (
    <div className="grid gap-3">
      {canUpload && (
        <ProcessUploadPanel copy={copy} lang={lang} onCreate={onCreate} />
      )}
      <div className="grid gap-2 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] p-2 sm:grid-cols-[minmax(0,1fr)_220px]">
        <label className="relative">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
          />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={copy.search}
            aria-label={copy.search}
            className="h-10 w-full rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] pl-9 pr-3 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-brand-primary)]"
          />
        </label>
        <select
          value={typeFilter}
          onChange={(event) =>
            setTypeFilter(event.target.value as ProcessDocumentType | "ALL")
          }
          aria-label={copy.processType}
          className="h-10 rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] px-3 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-brand-primary)]"
        >
          <option value="ALL">{copy.allTypes}</option>
          {PROCESS_DOCUMENT_TYPE_OPTIONS.map((type) => (
            <option key={type} value={type}>
              {getProcessDocumentTypeLabel(type, lang)}
            </option>
          ))}
        </select>
      </div>
      {loading ? (
        <div className="h-52 animate-pulse rounded-[var(--radius-md)] bg-[var(--color-surface-subtle)]" />
      ) : documents.length === 0 ? (
        <div className="flex min-h-64 flex-col items-center justify-center gap-2 rounded-[var(--radius-md)] border border-dashed border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] p-4 text-center">
          <FileText size={30} className="text-[var(--color-text-muted)]" />
          <p className="text-sm font-bold text-[var(--color-text-primary)]">
            {copy.empty}
          </p>
          <p className="text-xs text-[var(--color-text-muted)]">
            {copy.emptyHint}
          </p>
        </div>
      ) : filteredDocuments.length === 0 ? (
        <div className="flex min-h-40 items-center justify-center rounded-[var(--radius-md)] border border-dashed border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] p-4 text-center text-sm text-[var(--color-text-muted)]">
          {copy.noResults}
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filteredDocuments.map((document) => (
            <article
              key={document.id}
              className="flex min-h-44 flex-col gap-3 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] p-4"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--color-error-bg)] text-[var(--color-error-text)]">
                  <FileText size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-sm font-bold text-[var(--color-text-primary)]">
                    {document.title}
                  </h3>
                  <p className="mt-1 truncate text-xs text-[var(--color-text-muted)]">
                    {document.file_name}
                  </p>
                  <span className="mt-2 inline-flex rounded-full bg-[var(--color-brand-primary-muted)] px-2 py-1 text-xxs font-semibold text-[var(--color-brand-primary)]">
                    {getProcessDocumentTypeLabel(document.process_type, lang)}
                  </span>
                </div>
                {canDelete && (
                  <button
                    type="button"
                    onClick={() => void remove(document)}
                    className="rounded p-1.5 text-[var(--color-error-text)] hover:bg-[var(--color-error-bg)]"
                    aria-label={copy.delete}
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
              {document.description && (
                <p className="line-clamp-3 flex-1 text-xs text-[var(--color-text-secondary)]">
                  {document.description}
                </p>
              )}
              <p className="text-xxs text-[var(--color-text-muted)]">
                {formatFileSize(document.file_size)} ·{" "}
                {formatDate(document.created_at, lang)}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setViewing(document)}
                  className="flex h-9 items-center justify-center gap-2 rounded-[var(--radius-sm)] bg-[var(--color-brand-primary)] text-xs font-bold text-[var(--color-text-on-dark)]"
                >
                  <Eye size={15} /> {copy.view}
                </button>
                <a
                  href={document.file_url}
                  download={document.file_name}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-9 items-center justify-center gap-2 rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] text-xs font-bold text-[var(--color-text-secondary)]"
                >
                  <Download size={15} /> {copy.download}
                </a>
              </div>
            </article>
          ))}
        </div>
      )}
      {viewing && (
        <PdfViewer
          url={viewing.file_url}
          fileName={viewing.file_name}
          onClose={() => setViewing(null)}
        />
      )}
    </div>
  );
}

function ProcessUploadPanel({
  copy,
  lang,
  onCreate,
}: {
  copy: (typeof text)["vi"];
  lang: Language;
  onCreate: (payload: CreateProcessDocumentPayload) => Promise<unknown>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const userId = useUserStore((state) => state.user?.id);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [processType, setProcessType] =
    useState<ProcessDocumentType>("operations");
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);

  const choose = (next: File | undefined) => {
    if (!next) return;
    const isPdf = next.type === "application/pdf" || /\.pdf$/i.test(next.name);
    if (!isPdf || validateFile(next)) {
      gooeyToast.error(copy.invalid);
      return;
    }
    setFile(next);
    if (!title.trim()) setTitle(next.name.replace(/\.pdf$/i, ""));
  };

  const submit = async () => {
    if (!title.trim() || !file) {
      gooeyToast.error(copy.missing);
      return;
    }
    setUploading(true);
    try {
      await gooeyToast.promise(
        (async () => {
          const url = await uploadFile(
            file,
            `process-documents/${userId || "unknown"}`,
            setProgress,
          );
          await onCreate({
            title: title.trim(),
            description: description.trim() || null,
            process_type: processType,
            file_name: file.name,
            file_url: url,
            file_size: file.size,
            file_format: "pdf",
          });
          setTitle("");
          setDescription("");
          setProcessType("operations");
          setFile(null);
          setProgress(0);
        })(),
        {
          loading: copy.uploading,
          success: copy.uploaded,
          error: copy.uploadError,
        },
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <section className="grid gap-3 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] p-3 md:grid-cols-2 xl:grid-cols-[1fr_1fr_180px_1.2fr_auto] xl:items-end">
      <label className="grid gap-1 text-xs font-semibold text-[var(--color-text-secondary)]">
        {copy.title}
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={180}
          placeholder={copy.titlePlaceholder}
          className="h-10 rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] px-3 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-brand-primary)]"
        />
      </label>
      <label className="grid gap-1 text-xs font-semibold text-[var(--color-text-secondary)]">
        {copy.description}
        <input
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          maxLength={1000}
          placeholder={copy.descriptionPlaceholder}
          className="h-10 rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] px-3 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-brand-primary)]"
        />
      </label>
      <label className="grid gap-1 text-xs font-semibold text-[var(--color-text-secondary)]">
        {copy.processType}
        <select
          value={processType}
          onChange={(event) =>
            setProcessType(event.target.value as ProcessDocumentType)
          }
          className="h-10 rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] px-3 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-brand-primary)]"
        >
          {PROCESS_DOCUMENT_TYPE_OPTIONS.map((type) => (
            <option key={type} value={type}>
              {getProcessDocumentTypeLabel(type, lang)}
            </option>
          ))}
        </select>
      </label>
      <div className="grid gap-1 text-xs font-semibold text-[var(--color-text-secondary)]">
        <span>{copy.choose}</span>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,application/pdf"
          className="hidden"
          onChange={(event) => choose(event.target.files?.[0])}
        />
        {file ? (
          <div className="flex h-10 items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] px-2">
            <FileText size={16} className="text-[var(--color-error-text)]" />
            <span className="min-w-0 flex-1 truncate text-xs font-normal">
              {file.name}
            </span>
            {uploading ? (
              <span className="text-xxs">{progress}%</span>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="text-xxs text-[var(--color-brand-primary)]"
                >
                  {copy.change}
                </button>
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  aria-label={copy.remove}
                >
                  <X size={14} />
                </button>
              </>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex h-10 items-center justify-center gap-2 rounded-[var(--radius-sm)] border border-dashed border-[var(--color-border-subtle)] text-xs text-[var(--color-text-secondary)]"
          >
            <UploadCloud size={16} /> {copy.choose}
          </button>
        )}
        <span className="text-xxs font-normal text-[var(--color-text-muted)]">
          {copy.hint}
        </span>
      </div>
      <button
        type="button"
        disabled={uploading}
        onClick={() => void submit()}
        className="h-10 rounded-[var(--radius-sm)] bg-[var(--color-brand-primary)] px-4 text-sm font-bold text-[var(--color-text-on-dark)] disabled:opacity-50"
      >
        {copy.upload}
      </button>
    </section>
  );
}

function formatDate(value: unknown, lang: Language) {
  const date = toFileLibraryDate(value);
  return date
    ? new Intl.DateTimeFormat(lang === "zh" ? "zh-CN" : "vi-VN", {
        dateStyle: "short",
      }).format(date)
    : "-";
}
