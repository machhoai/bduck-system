"use client";

import { useMemo, useState } from "react";
import {
  Download,
  FileArchive,
  Files,
  Pencil,
  Plus,
  Search,
  Trash2,
  Workflow,
  X,
} from "lucide-react";
import { gooeyToast } from "goey-toast";
import type {
  FileTemplate,
  FileTemplateBundle,
  FileTemplateCategory,
  ProcessDocument,
  ProcessDocumentType,
} from "@bduck/shared-types";
import type { Language } from "@/lib/i18n";
import type { SaveFileTemplateBundlePayload } from "@/hooks/useFileTemplateBundles";
import { normalizeFileLibrarySearch } from "@/utils/fileLibrary";
import { FILE_TEMPLATE_CATEGORY_OPTIONS } from "@/utils/fileTemplateCategories";
import {
  getProcessDocumentTypeLabel,
  PROCESS_DOCUMENT_TYPE_OPTIONS,
} from "@/utils/processDocumentTypes";

interface Props {
  bundles: FileTemplateBundle[];
  templates: FileTemplate[];
  processDocuments: ProcessDocument[];
  loading: boolean;
  canManage: boolean;
  lang: Language;
  onCreate: (payload: SaveFileTemplateBundlePayload) => Promise<unknown>;
  onUpdate: (
    id: string,
    payload: SaveFileTemplateBundlePayload,
  ) => Promise<unknown>;
  onDelete: (id: string) => Promise<unknown>;
}

const text = {
  vi: {
    create: "Tạo bộ biểu mẫu",
    edit: "Chỉnh sửa bộ biểu mẫu",
    name: "Tên bộ biểu mẫu",
    namePlaceholder: "VD: Bộ hồ sơ nhập hàng",
    description: "Mô tả chức năng",
    descriptionPlaceholder: "Bộ biểu mẫu này dùng khi nào?",
    choose: "Chọn biểu mẫu trong bộ",
    search: "Tìm biểu mẫu...",
    noResults: "Không tìm thấy biểu mẫu phù hợp.",
    selected: "đã chọn",
    cancel: "Hủy",
    save: "Lưu bộ biểu mẫu",
    saving: "Đang lưu bộ biểu mẫu...",
    saved: "Đã lưu bộ biểu mẫu",
    saveError: "Không thể lưu bộ biểu mẫu",
    missing: "Vui lòng nhập tên và chọn ít nhất một biểu mẫu.",
    files: "biểu mẫu",
    download: "Tải cả bộ",
    downloading: "Đang đóng gói bộ biểu mẫu...",
    downloaded: "Đã tạo tệp ZIP",
    downloadError: "Không thể tải trọn bộ biểu mẫu",
    empty: "Chưa có bộ biểu mẫu",
    emptyHint:
      "Người có quyền quản lý có thể nhóm các biểu mẫu đã tải lên tại đây.",
    deleteConfirm: "Xóa bộ biểu mẫu này? Các biểu mẫu gốc sẽ không bị xóa.",
    deleted: "Đã xóa bộ biểu mẫu",
    deleteError: "Không thể xóa bộ biểu mẫu",
    unavailable:
      "Một số biểu mẫu hoặc quy trình trong bộ đã bị xóa hoặc không còn khả dụng.",
    searchBundles:
      "Tìm theo tên bộ, mô tả, biểu mẫu hoặc quy trình được gắn...",
    allTemplateCategories: "Tất cả loại biểu mẫu",
    allProcessTypes: "Tất cả loại quy trình",
    noBundleResults: "Không tìm thấy bộ biểu mẫu phù hợp với bộ lọc.",
    processes: "quy trình",
    chooseProcesses: "Gắn quy trình vào bộ biểu mẫu",
    searchProcesses: "Tìm quy trình...",
    noProcessResults: "Không tìm thấy quy trình phù hợp.",
  },
  zh: {
    create: "创建模板包",
    edit: "编辑模板包",
    name: "模板包名称",
    namePlaceholder: "例如：入库资料包",
    description: "用途说明",
    descriptionPlaceholder: "此模板包何时使用？",
    choose: "选择包内模板",
    search: "搜索模板...",
    noResults: "未找到匹配的模板。",
    selected: "已选择",
    cancel: "取消",
    save: "保存模板包",
    saving: "正在保存模板包...",
    saved: "模板包已保存",
    saveError: "无法保存模板包",
    missing: "请输入名称并至少选择一个模板。",
    files: "个模板",
    download: "下载整个包",
    downloading: "正在打包模板...",
    downloaded: "ZIP 文件已生成",
    downloadError: "无法下载整个模板包",
    empty: "暂无模板包",
    emptyHint: "有管理权限的用户可在此组合已上传的模板。",
    deleteConfirm: "删除此模板包？原始模板不会被删除。",
    deleted: "模板包已删除",
    deleteError: "无法删除模板包",
    unavailable: "包内部分模板或流程已被删除或不可用。",
    searchBundles: "按包名、描述、模板或关联流程搜索...",
    allTemplateCategories: "所有模板类型",
    allProcessTypes: "所有流程类型",
    noBundleResults: "未找到符合筛选条件的模板包。",
    processes: "个流程",
    chooseProcesses: "将流程关联到模板包",
    searchProcesses: "搜索流程...",
    noProcessResults: "未找到匹配的流程。",
  },
};

function safeFileName(value: string) {
  return value.replace(/[\\/:*?"<>|]+/g, "_").trim() || "bo-bieu-mau";
}

export default function FileTemplateBundleTab({
  bundles,
  templates,
  processDocuments,
  loading,
  canManage,
  lang,
  onCreate,
  onUpdate,
  onDelete,
}: Props) {
  const copy = text[lang];
  const [editing, setEditing] = useState<FileTemplateBundle | "new" | null>(
    null,
  );
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [templateCategory, setTemplateCategory] = useState<
    FileTemplateCategory | "ALL"
  >("ALL");
  const [processType, setProcessType] = useState<ProcessDocumentType | "ALL">(
    "ALL",
  );
  const templatesById = useMemo(
    () => new Map(templates.map((template) => [template.id, template])),
    [templates],
  );
  const processDocumentsById = useMemo(
    () => new Map(processDocuments.map((document) => [document.id, document])),
    [processDocuments],
  );
  const filteredBundles = useMemo(() => {
    const keyword = normalizeFileLibrarySearch(search);
    return bundles.filter((bundle) => {
      const bundleTemplates = bundle.template_ids
        .map((id) => templatesById.get(id))
        .filter((item): item is FileTemplate => Boolean(item));
      const bundleProcesses = (bundle.process_document_ids || [])
        .map((id) => processDocumentsById.get(id))
        .filter((item): item is ProcessDocument => Boolean(item));
      if (
        templateCategory !== "ALL" &&
        !bundleTemplates.some((item) => item.category === templateCategory)
      ) {
        return false;
      }
      if (
        processType !== "ALL" &&
        !bundleProcesses.some(
          (item) => (item.process_type || "general") === processType,
        )
      ) {
        return false;
      }
      if (!keyword) return true;
      return normalizeFileLibrarySearch(
        [
          bundle.name,
          bundle.description || "",
          ...bundleTemplates.flatMap((item) => [
            item.title,
            item.description || "",
            item.file_name,
            getProcessDocumentTypeLabel(item.category, lang),
          ]),
          ...bundleProcesses.flatMap((item) => [
            item.title,
            item.description || "",
            item.file_name,
            getProcessDocumentTypeLabel(item.process_type, lang),
          ]),
        ].join(" "),
      ).includes(keyword);
    });
  }, [
    bundles,
    lang,
    processDocumentsById,
    processType,
    search,
    templateCategory,
    templatesById,
  ]);

  const downloadBundle = async (bundle: FileTemplateBundle) => {
    const selectedTemplates = bundle.template_ids
      .map((id) => templatesById.get(id))
      .filter((item): item is FileTemplate => Boolean(item));
    const selectedProcesses = (bundle.process_document_ids || [])
      .map((id) => processDocumentsById.get(id))
      .filter((item): item is ProcessDocument => Boolean(item));
    const selectedFiles = [
      ...selectedTemplates.map((item) => ({
        fileUrl: item.file_url,
        fileName: item.file_name,
      })),
      ...selectedProcesses.map((item) => ({
        fileUrl: item.file_url,
        fileName: item.file_name,
      })),
    ];
    if (!selectedFiles.length) {
      gooeyToast.error(copy.downloadError, { description: copy.unavailable });
      return;
    }
    setDownloadingId(bundle.id);
    try {
      await gooeyToast.promise(
        (async () => {
          const { default: JSZip } = await import("jszip");
          const zip = new JSZip();
          const usedNames = new Set<string>();
          await Promise.all(
            selectedFiles.map(async (file, index) => {
              const response = await fetch(file.fileUrl);
              if (!response.ok) throw new Error(file.fileName);
              let name = safeFileName(file.fileName);
              if (usedNames.has(name)) name = `${index + 1}_${name}`;
              usedNames.add(name);
              zip.file(name, await response.blob());
            }),
          );
          const blob = await zip.generateAsync({ type: "blob" });
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = `${safeFileName(bundle.name)}.zip`;
          link.click();
          URL.revokeObjectURL(url);
        })(),
        {
          loading: copy.downloading,
          success: copy.downloaded,
          error: copy.downloadError,
        },
      );
    } finally {
      setDownloadingId(null);
    }
  };

  const remove = async (bundle: FileTemplateBundle) => {
    if (!window.confirm(copy.deleteConfirm)) return;
    try {
      await onDelete(bundle.id);
      gooeyToast.success(copy.deleted);
    } catch {
      gooeyToast.error(copy.deleteError);
    }
  };

  if (loading) {
    return (
      <div className="h-52 animate-pulse rounded-[var(--radius-md)] bg-[var(--color-surface-subtle)]" />
    );
  }

  return (
    <div className="grid gap-3">
      {canManage && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setEditing("new")}
            className="flex h-10 items-center gap-2 rounded-[var(--radius-sm)] bg-[var(--color-brand-primary)] px-3 text-sm font-bold text-[var(--color-text-on-dark)]"
          >
            <Plus size={16} /> {copy.create}
          </button>
        </div>
      )}

      <div className="grid gap-2 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] p-2 lg:grid-cols-[minmax(0,1fr)_220px_220px]">
        <label className="relative">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
          />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={copy.searchBundles}
            aria-label={copy.searchBundles}
            className="h-10 w-full rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] pl-9 pr-3 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-brand-primary)]"
          />
        </label>
        <select
          value={templateCategory}
          onChange={(event) =>
            setTemplateCategory(
              event.target.value as FileTemplateCategory | "ALL",
            )
          }
          aria-label={copy.allTemplateCategories}
          className="h-10 rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] px-3 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-brand-primary)]"
        >
          <option value="ALL">{copy.allTemplateCategories}</option>
          {FILE_TEMPLATE_CATEGORY_OPTIONS.map((category) => (
            <option key={category} value={category}>
              {getProcessDocumentTypeLabel(category, lang)}
            </option>
          ))}
        </select>
        <select
          value={processType}
          onChange={(event) =>
            setProcessType(event.target.value as ProcessDocumentType | "ALL")
          }
          aria-label={copy.allProcessTypes}
          className="h-10 rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] px-3 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-brand-primary)]"
        >
          <option value="ALL">{copy.allProcessTypes}</option>
          {PROCESS_DOCUMENT_TYPE_OPTIONS.map((type) => (
            <option key={type} value={type}>
              {getProcessDocumentTypeLabel(type, lang)}
            </option>
          ))}
        </select>
      </div>

      {bundles.length === 0 ? (
        <div className="flex min-h-64 flex-col items-center justify-center gap-2 rounded-[var(--radius-md)] border border-dashed border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] p-4 text-center">
          <FileArchive size={30} className="text-[var(--color-text-muted)]" />
          <p className="text-sm font-bold text-[var(--color-text-primary)]">
            {copy.empty}
          </p>
          <p className="text-xs text-[var(--color-text-muted)]">
            {copy.emptyHint}
          </p>
        </div>
      ) : filteredBundles.length === 0 ? (
        <div className="flex min-h-40 items-center justify-center rounded-[var(--radius-md)] border border-dashed border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] p-4 text-center text-sm text-[var(--color-text-muted)]">
          {copy.noBundleResults}
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filteredBundles.map((bundle) => {
            const availableCount = bundle.template_ids.filter((id) =>
              templatesById.has(id),
            ).length;
            const processIds = bundle.process_document_ids || [];
            const availableProcessCount = processIds.filter((id) =>
              processDocumentsById.has(id),
            ).length;
            return (
              <article
                key={bundle.id}
                className="flex min-h-44 flex-col gap-3 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] p-4"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--color-brand-primary-muted)] text-[var(--color-brand-primary)]">
                    <FileArchive size={20} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-bold text-[var(--color-text-primary)]">
                      {bundle.name}
                    </h3>
                    <p className="mt-1 flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
                      <Files size={13} /> {availableCount} {copy.files}
                    </p>
                    <p className="mt-1 flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
                      <Workflow size={13} /> {availableProcessCount}{" "}
                      {copy.processes}
                    </p>
                  </div>
                  {canManage && (
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => setEditing(bundle)}
                        className="rounded p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-subtle)]"
                        aria-label={copy.edit}
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => void remove(bundle)}
                        className="rounded p-1.5 text-[var(--color-error-text)] hover:bg-[var(--color-error-bg)]"
                        aria-label={copy.deleteConfirm}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  )}
                </div>
                {bundle.description && (
                  <p className="line-clamp-3 flex-1 text-xs text-[var(--color-text-secondary)]">
                    {bundle.description}
                  </p>
                )}
                {(availableCount < bundle.template_ids.length ||
                  availableProcessCount < processIds.length) && (
                  <p className="text-xxs text-[var(--color-error-text)]">
                    {copy.unavailable}
                  </p>
                )}
                <button
                  type="button"
                  disabled={
                    (!availableCount && !availableProcessCount) ||
                    downloadingId === bundle.id
                  }
                  onClick={() => void downloadBundle(bundle)}
                  className="flex h-9 items-center justify-center gap-2 rounded-[var(--radius-sm)] border border-[var(--color-brand-primary)] text-xs font-bold text-[var(--color-brand-primary)] transition hover:bg-[var(--color-brand-primary-muted)] disabled:opacity-50"
                >
                  <Download size={15} /> {copy.download}
                </button>
              </article>
            );
          })}
        </div>
      )}

      {editing && (
        <BundleModal
          bundle={editing === "new" ? null : editing}
          templates={templates}
          processDocuments={processDocuments}
          copy={copy}
          lang={lang}
          onClose={() => setEditing(null)}
          onSave={async (payload) => {
            await (editing === "new"
              ? onCreate(payload)
              : onUpdate(editing.id, payload));
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function BundleModal({
  bundle,
  templates,
  processDocuments,
  copy,
  lang,
  onClose,
  onSave,
}: {
  bundle: FileTemplateBundle | null;
  templates: FileTemplate[];
  processDocuments: ProcessDocument[];
  copy: (typeof text)["vi"];
  lang: Language;
  onClose: () => void;
  onSave: (payload: SaveFileTemplateBundlePayload) => Promise<void>;
}) {
  const [name, setName] = useState(bundle?.name || "");
  const [description, setDescription] = useState(bundle?.description || "");
  const [selected, setSelected] = useState(
    () => new Set(bundle?.template_ids || []),
  );
  const [selectedProcesses, setSelectedProcesses] = useState(
    () => new Set(bundle?.process_document_ids || []),
  );
  const [search, setSearch] = useState("");
  const [templateCategory, setTemplateCategory] = useState<
    FileTemplateCategory | "ALL"
  >("ALL");
  const [processSearch, setProcessSearch] = useState("");
  const [processType, setProcessType] = useState<ProcessDocumentType | "ALL">(
    "ALL",
  );
  const [saving, setSaving] = useState(false);
  const filteredTemplates = useMemo(() => {
    const keyword = normalizeFileLibrarySearch(search);
    return templates.filter((template) => {
      if (
        templateCategory !== "ALL" &&
        template.category !== templateCategory
      ) {
        return false;
      }
      if (!keyword) return true;
      return normalizeFileLibrarySearch(
        [
          template.title,
          template.file_name,
          template.description || "",
          template.file_format,
          template.category,
          getProcessDocumentTypeLabel(template.category, lang),
        ].join(" "),
      ).includes(keyword);
    });
  }, [lang, search, templateCategory, templates]);
  const filteredProcesses = useMemo(() => {
    const keyword = normalizeFileLibrarySearch(processSearch);
    return processDocuments.filter((document) => {
      const documentType = document.process_type || "general";
      if (processType !== "ALL" && documentType !== processType) return false;
      if (!keyword) return true;
      return normalizeFileLibrarySearch(
        [
          document.title,
          document.file_name,
          document.description || "",
          documentType,
          getProcessDocumentTypeLabel(documentType, lang),
        ].join(" "),
      ).includes(keyword);
    });
  }, [lang, processDocuments, processSearch, processType]);

  const submit = async () => {
    if (!name.trim() || !selected.size) {
      gooeyToast.error(copy.missing);
      return;
    }
    setSaving(true);
    try {
      await gooeyToast.promise(
        onSave({
          name: name.trim(),
          description: description.trim() || null,
          template_ids: [...selected],
          process_document_ids: [...selectedProcesses],
        }),
        { loading: copy.saving, success: copy.saved, error: copy.saveError },
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9000] flex items-center justify-center bg-black/50 p-3"
      role="dialog"
      aria-modal="true"
    >
      <div className="grid max-h-[90vh] w-full max-w-2/3 gap-4 overflow-y-auto rounded-[var(--radius-lg)] bg-[var(--color-surface-elevated)] p-4 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-[var(--color-text-primary)]">
            {bundle ? copy.edit : copy.create}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-2 text-[var(--color-text-muted)]"
          >
            <X size={18} />
          </button>
        </div>
        <label className="grid gap-1 text-xs font-semibold text-[var(--color-text-secondary)]">
          {copy.name}
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={180}
            placeholder={copy.namePlaceholder}
            className="h-10 rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] px-3 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-brand-primary)]"
          />
        </label>
        <label className="grid gap-1 text-xs font-semibold text-[var(--color-text-secondary)]">
          {copy.description}
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={1000}
            rows={3}
            placeholder={copy.descriptionPlaceholder}
            className="rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-3 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-brand-primary)]"
          />
        </label>
        <div className="grid gap-2">
          <div className="flex items-center justify-between text-xs font-semibold text-[var(--color-text-secondary)]">
            <span>{copy.choose}</span>
            <span>
              {selected.size} {copy.selected}
            </span>
          </div>
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_200px]">
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={copy.search}
              className="h-10 rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] px-3 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-brand-primary)]"
            />
            <select
              value={templateCategory}
              onChange={(event) =>
                setTemplateCategory(
                  event.target.value as FileTemplateCategory | "ALL",
                )
              }
              className="h-10 rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] px-3 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-brand-primary)]"
            >
              <option value="ALL">{copy.allTemplateCategories}</option>
              {FILE_TEMPLATE_CATEGORY_OPTIONS.map((category) => (
                <option key={category} value={category}>
                  {getProcessDocumentTypeLabel(category, lang)}
                </option>
              ))}
            </select>
          </div>
          <div className="grid max-h-72 gap-1 overflow-y-auto rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] p-2 sm:grid-cols-2">
            {filteredTemplates.map((template) => (
              <label
                key={template.id}
                className="flex cursor-pointer items-start gap-2 rounded-[var(--radius-sm)] p-2 hover:bg-[var(--color-surface-subtle)]"
              >
                <input
                  type="checkbox"
                  checked={selected.has(template.id)}
                  onChange={() =>
                    setSelected((current) => {
                      const next = new Set(current);
                      next.has(template.id)
                        ? next.delete(template.id)
                        : next.add(template.id);
                      return next;
                    })
                  }
                  className="mt-0.5"
                />
                <span className="min-w-0">
                  <span className="block truncate text-xs font-semibold text-[var(--color-text-primary)]">
                    {template.title}
                  </span>
                  <span className="block truncate text-xxs text-[var(--color-text-muted)]">
                    {template.file_name}
                  </span>
                </span>
              </label>
            ))}
            {filteredTemplates.length === 0 && (
              <p className="col-span-full py-6 text-center text-xs text-[var(--color-text-muted)]">
                {copy.noResults}
              </p>
            )}
          </div>
        </div>
        <div className="grid gap-2">
          <div className="flex items-center justify-between text-xs font-semibold text-[var(--color-text-secondary)]">
            <span>{copy.chooseProcesses}</span>
            <span>
              {selectedProcesses.size} {copy.selected}
            </span>
          </div>
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_200px]">
            <input
              type="search"
              value={processSearch}
              onChange={(event) => setProcessSearch(event.target.value)}
              placeholder={copy.searchProcesses}
              className="h-10 rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] px-3 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-brand-primary)]"
            />
            <select
              value={processType}
              onChange={(event) =>
                setProcessType(
                  event.target.value as ProcessDocumentType | "ALL",
                )
              }
              className="h-10 rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] px-3 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-brand-primary)]"
            >
              <option value="ALL">{copy.allProcessTypes}</option>
              {PROCESS_DOCUMENT_TYPE_OPTIONS.map((type) => (
                <option key={type} value={type}>
                  {getProcessDocumentTypeLabel(type, lang)}
                </option>
              ))}
            </select>
          </div>
          <div className="grid max-h-64 gap-1 overflow-y-auto rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] p-2 sm:grid-cols-2">
            {filteredProcesses.map((document) => (
              <label
                key={document.id}
                className="flex cursor-pointer items-start gap-2 rounded-[var(--radius-sm)] p-2 hover:bg-[var(--color-surface-subtle)]"
              >
                <input
                  type="checkbox"
                  checked={selectedProcesses.has(document.id)}
                  onChange={() =>
                    setSelectedProcesses((current) => {
                      const next = new Set(current);
                      next.has(document.id)
                        ? next.delete(document.id)
                        : next.add(document.id);
                      return next;
                    })
                  }
                  className="mt-0.5"
                />
                <span className="min-w-0">
                  <span className="block truncate text-xs font-semibold text-[var(--color-text-primary)]">
                    {document.title}
                  </span>
                  <span className="block truncate text-xxs text-[var(--color-text-muted)]">
                    {getProcessDocumentTypeLabel(document.process_type, lang)} ·{" "}
                    {document.file_name}
                  </span>
                </span>
              </label>
            ))}
            {filteredProcesses.length === 0 && (
              <p className="col-span-full py-6 text-center text-xs text-[var(--color-text-muted)]">
                {copy.noProcessResults}
              </p>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="h-9 rounded-[var(--radius-sm)] px-3 text-sm font-semibold text-[var(--color-text-secondary)]"
          >
            {copy.cancel}
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={saving}
            className="h-9 rounded-[var(--radius-sm)] bg-[var(--color-brand-primary)] px-3 text-sm font-bold text-[var(--color-text-on-dark)] disabled:opacity-50"
          >
            {copy.save}
          </button>
        </div>
      </div>
    </div>
  );
}
