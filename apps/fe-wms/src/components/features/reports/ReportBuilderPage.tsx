"use client";

import type {
  ExcelCellMapping,
  ReportExcelMapping,
  ReportFieldInstance,
  ReportTemplate,
  ReportTemplateVisibility,
} from "@bduck/shared-types";
import { FileSpreadsheet, Save, Upload, Wand2 } from "lucide-react";
import { useMemo, useState } from "react";
import { gooeyToast } from "goey-toast";
import { useReportTemplates } from "@/hooks/useReportTemplates";
import {
  downloadBlob,
  fileToBase64,
  parseWorkbookGrid,
  type ExcelGridSheet,
} from "@/utils/reportExcelClient";
import ReportExcelGrid from "./ReportExcelGrid";
import InventoryFieldPanel from "./InventoryFieldPanel";

export default function ReportBuilderPage() {
  const {
    templates,
    loading,
    createExcelTemplate,
    updateExcelTemplate,
    previewExcelTemplate,
    exportExcelTemplate,
    fetchTemplateDetail,
    fetchTemplateFile,
  } = useReportTemplates();
  const [templateId, setTemplateId] = useState("");
  const [templateName, setTemplateName] = useState("Mẫu báo cáo Excel");
  const [visibility, setVisibility] =
    useState<ReportTemplateVisibility>("private");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [sheets, setSheets] = useState<ExcelGridSheet[]>([]);
  const [activeSheetName, setActiveSheetName] = useState("");
  const [selectedCell, setSelectedCell] = useState<string | null>(null);
  const [fieldInstances, setFieldInstances] = useState<ReportFieldInstance[]>([]);
  const [cellMappings, setCellMappings] = useState<ExcelCellMapping[]>([]);
  const [previewValues, setPreviewValues] = useState<Record<string, unknown>>({});
  const [submitting, setSubmitting] = useState(false);

  const activeSheet = useMemo(
    () => sheets.find((sheet) => sheet.name === activeSheetName) || null,
    [activeSheetName, sheets],
  );

  const currentMapping: ReportExcelMapping = {
    field_instances: fieldInstances,
    cell_mappings: cellMappings,
  };

  const handleFileChange = async (file: File | null) => {
    if (!file) return;
    setUploadedFile(file);
    const parsedSheets = await parseWorkbookGrid(file);
    setSheets(parsedSheets);
    setActiveSheetName(parsedSheets[0]?.name || "");
    setTemplateId("");
    setTemplateName(file.name.replace(/\.xlsx$/i, ""));
    setFieldInstances([]);
    setCellMappings([]);
    setPreviewValues({});
  };

  const loadTemplate = async (template: ReportTemplate) => {
    setSubmitting(true);
    try {
      const detail = await fetchTemplateDetail(template.id);
      const blob = await fetchTemplateFile(template.id);
      const file = new File([blob], detail.version.original_file_name);
      const parsedSheets = await parseWorkbookGrid(file);
      setTemplateId(template.id);
      setTemplateName(template.name);
      setVisibility(template.visibility);
      setUploadedFile(file);
      setSheets(parsedSheets);
      setActiveSheetName(parsedSheets[0]?.name || "");
      setFieldInstances(detail.version.mapping.field_instances);
      setCellMappings(detail.version.mapping.cell_mappings);
      setPreviewValues({});
    } finally {
      setSubmitting(false);
    }
  };

  const addFieldToSelectedCell = (field: ReportFieldInstance) => {
    if (!selectedCell || !activeSheetName) return;
    setFieldInstances((items) => [...items, field]);
    setCellMappings((items) => [
      ...items.filter(
        (item) => !(item.sheet_name === activeSheetName && item.cell === selectedCell),
      ),
      {
        id: `map_${Date.now()}`,
        sheet_name: activeSheetName,
        cell: selectedCell,
        field_instance_id: field.id,
        write_mode: "value",
      },
    ]);
  };

  const saveTemplate = async () => {
    if (!uploadedFile && !templateId) return;
    setSubmitting(true);
    try {
      await gooeyToast.promise(
        (async () => {
          if (templateId) {
            return updateExcelTemplate(templateId, {
              name: templateName,
              visibility,
              mapping: currentMapping,
            });
          }
          if (!uploadedFile) throw new Error("Missing Excel file");
          return createExcelTemplate({
            name: templateName,
            original_file_name: uploadedFile.name,
            file_base64: await fileToBase64(uploadedFile),
            visibility,
            mapping: currentMapping,
          });
        })(),
        {
          loading: "Đang lưu mẫu báo cáo...",
          success: "Đã lưu mẫu báo cáo",
          error: "Không thể lưu mẫu báo cáo",
          description: {
            success: "Mapping Excel đã được lưu để dùng lại lần sau.",
            error: "Kiểm tra file, mapping và quyền chia sẻ rồi thử lại.",
          },
        },
      );
    } finally {
      setSubmitting(false);
    }
  };

  const previewTemplate = async () => {
    if (!templateId) return;
    setSubmitting(true);
    try {
      await gooeyToast.promise(
        previewExcelTemplate(templateId, currentMapping).then((rows) => {
          const values: Record<string, unknown> = {};
          for (const row of rows) values[`${row.sheet_name}!${row.cell}`] = row.value;
          setPreviewValues(values);
          return rows;
        }),
        {
          loading: "Đang preview dữ liệu...",
          success: "Đã preview dữ liệu",
          error: "Không thể preview báo cáo",
          description: {
            success: "Các ô đã mapping được resolve theo quyền hiện tại.",
            error: "Một field có thể thiếu quyền hoặc chưa hỗ trợ snapshot.",
          },
        },
      );
    } finally {
      setSubmitting(false);
    }
  };

  const exportTemplate = async () => {
    if (!templateId) return;
    setSubmitting(true);
    try {
      await gooeyToast.promise(
        exportExcelTemplate(templateId, currentMapping).then((blob) => {
          downloadBlob(blob, `${templateName}.xlsx`);
        }),
        {
          loading: "Đang xuất Excel...",
          success: "Đã xuất báo cáo",
          error: "Không thể xuất báo cáo",
          description: {
            success: "File Excel đã được tạo từ template và mapping hiện tại.",
            error: "Kiểm tra quyền dữ liệu hoặc cấu hình field.",
          },
        },
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100dvh-80px)] flex-col gap-3 bg-[var(--color-surface-subtle)] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-border-subtle)] bg-white p-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center bg-[var(--color-brand-primary-muted)] text-[var(--color-brand-primary)]">
            <FileSpreadsheet size={18} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-[var(--color-text-primary)]">
              Phân hệ báo cáo Excel
            </h1>
            <p className="text-xs text-[var(--color-text-muted)]">
              Upload mẫu Excel, map field tồn kho vào ô và lưu để xuất lại.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex h-8 w-fit cursor-pointer items-center gap-1 bg-white px-3 text-sm font-semibold text-[var(--color-brand-primary)] ring-1 ring-[var(--color-border-subtle)]">
            <Upload size={14} />
            Upload .xlsx
            <input
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={(event) => void handleFileChange(event.target.files?.[0] || null)}
            />
          </label>
          <button
            type="button"
            disabled={submitting || !uploadedFile}
            onClick={() => void saveTemplate()}
            className="flex h-8 w-fit items-center gap-1 bg-[var(--color-brand-primary)] px-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            <Save size={14} />
            Lưu mẫu
          </button>
          <button
            type="button"
            disabled={submitting || !templateId}
            onClick={() => void previewTemplate()}
            className="flex h-8 w-fit items-center gap-1 bg-white px-3 text-sm font-semibold text-[var(--color-text-primary)] ring-1 ring-[var(--color-border-subtle)] disabled:opacity-50"
          >
            Preview
          </button>
          <button
            type="button"
            disabled={submitting || !templateId}
            onClick={() => void exportTemplate()}
            className="flex h-8 w-fit items-center gap-1 bg-[var(--color-status-export-icon)] px-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            <Wand2 size={14} />
            Xuất Excel
          </button>
        </div>
      </div>

      <div className="grid flex-1 grid-cols-1 gap-3 lg:grid-cols-[240px_1fr_300px]">
        <aside className="flex flex-col gap-2 overflow-hidden bg-white p-3">
          <input
            value={templateName}
            onChange={(event) => setTemplateName(event.target.value)}
            className="h-8 border border-[var(--color-border-subtle)] px-2 text-sm"
          />
          <select
            value={visibility}
            onChange={(event) =>
              setVisibility(event.target.value as ReportTemplateVisibility)
            }
            className="h-8 border border-[var(--color-border-subtle)] bg-white px-2 text-sm"
          >
            <option value="private">Riêng tư</option>
            <option value="shared">Dùng chung</option>
          </select>
          <div className="border-t border-[var(--color-border-subtle)] pt-2">
            <p className="mb-1 text-xs font-semibold">Mẫu đã lưu</p>
            <div className="flex flex-col gap-1">
              {loading ? (
                <div className="h-20 animate-pulse bg-[var(--color-surface-subtle)]" />
              ) : (
                templates.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => void loadTemplate(template)}
                    className="w-full border border-[var(--color-border-subtle)] px-2 py-1.5 text-left text-xs hover:bg-[var(--color-surface-subtle)]"
                  >
                    <span className="block font-semibold">{template.name}</span>
                    <span className="text-micro text-[var(--color-text-muted)]">
                      {template.visibility}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </aside>

        <main className="flex min-h-[520px] flex-col gap-2 overflow-hidden">
          <div className="flex gap-1 overflow-x-auto">
            {sheets.map((sheet) => (
              <button
                key={sheet.name}
                type="button"
                onClick={() => setActiveSheetName(sheet.name)}
                className={`h-8 w-fit px-3 text-xs font-semibold ${
                  activeSheetName === sheet.name
                    ? "bg-[var(--color-brand-primary)] text-white"
                    : "bg-white text-[var(--color-text-secondary)]"
                }`}
              >
                {sheet.name}
              </button>
            ))}
          </div>
          <ReportExcelGrid
            sheet={activeSheet}
            selectedCell={selectedCell}
            mappings={cellMappings.filter(
              (mapping) => mapping.sheet_name === activeSheetName,
            )}
            onSelectCell={setSelectedCell}
          />
        </main>

        <aside className="flex flex-col gap-2 overflow-auto">
          <InventoryFieldPanel
            disabled={!selectedCell || !activeSheetName}
            onAddField={addFieldToSelectedCell}
          />
          <div className="border border-[var(--color-border-subtle)] bg-white p-3">
            <h2 className="text-base font-semibold">Ô đã mapping</h2>
            <div className="mt-2 flex flex-col gap-1">
              {cellMappings.map((mapping) => {
                const field = fieldInstances.find(
                  (item) => item.id === mapping.field_instance_id,
                );
                const previewKey = `${mapping.sheet_name}!${mapping.cell}`;
                return (
                  <div
                    key={mapping.id}
                    className="border border-[var(--color-border-subtle)] p-2 text-xs"
                  >
                    <div className="font-semibold">
                      {mapping.sheet_name}!{mapping.cell}
                    </div>
                    <div className="text-[var(--color-text-muted)]">
                      {field?.label || mapping.field_instance_id}
                    </div>
                    {previewKey in previewValues && (
                      <div className="mt-1 text-[var(--color-brand-primary)]">
                        = {String(previewValues[previewKey])}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
