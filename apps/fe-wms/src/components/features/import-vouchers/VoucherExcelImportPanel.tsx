"use client";

/**
 * VoucherExcelImportPanel
 * ─────────────────────────────────────────────
 * Panel inline (không popup) cho phép đọc file XLSX,
 * map cột và thêm sản phẩm vào phiếu nhập kho.
 *
 * Phase 1: Upload file + nhập số hàng bắt đầu
 * Phase 2: Kéo thả map cột → "Đọc dữ liệu"
 * Phase 3: Preview kết quả → "Thêm X sản phẩm vào phiếu"
 */

import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  FileSpreadsheet,
  GripHorizontal,
  Loader2,
  RotateCcw,
  Upload,
  X,
} from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { gooeyToast } from "goey-toast";
import type { Product } from "@bduck/shared-types";
import {
  type SheetColumnInfo,
  type SheetPreview,
  type VoucherColumnMapping,
  type ExcelSheetInfo,
  getExcelSheets,
  parseVoucherRows,
  readSheetPreview,
  summarizeVoucherResults,
} from "@/utils/voucherExcelImport";
import type { SelectedFile } from "@/components/shared/FileUploadField";

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

interface VoucherExcelImportPanelProps {
  /** File chứng từ đã upload từ bước 1 (để gợi ý XLSX) */
  uploadedFiles: SelectedFile[];
  products: Product[];
  /** Callback khi người dùng xác nhận thêm sản phẩm */
  onImport: (
    items: { productId: string; quantity: number; unitPrice: number; notes: string; locationCode: string }[]
  ) => void;
}

type PanelPhase = "upload" | "mapping" | "preview";

const REQUIRED_SLOTS = ["productName", "quantity"] as const;
const OPTIONAL_SLOTS = ["sku", "unitPrice", "location", "notes"] as const;

const SLOT_LABELS: Record<string, { label: string; labelZh: string; required: boolean }> = {
  productName: { label: "Tên sản phẩm", labelZh: "产品名称", required: true },
  quantity: { label: "Số lượng", labelZh: "数量", required: true },
  sku: { label: "SKU / Mã SP", labelZh: "SKU", required: false },
  unitPrice: { label: "Đơn giá", labelZh: "单价", required: false },
  location: { label: "Vị trí kho", labelZh: "库位", required: false },
  notes: { label: "Ghi chú", labelZh: "备注", required: false },
};

const EMPTY_MAPPING: VoucherColumnMapping = {
  productName: null,
  sku: null,
  quantity: null,
  unitPrice: null,
  notes: null,
  location: null,
};

// ─────────────────────────────────────────────
// COLUMN CHIP (Draggable source)
// ─────────────────────────────────────────────

function ColumnChip({
  col,
  isMapped,
  onDragStart,
}: {
  col: SheetColumnInfo;
  isMapped: boolean;
  onDragStart: (key: string) => void;
}) {
  return (
    <div
      draggable
      onDragStart={() => onDragStart(col.key)}
      className={`flex cursor-grab items-center gap-1.5 rounded border px-2 py-1 text-xs transition-all active:cursor-grabbing ${
        isMapped
          ? "border-[var(--color-brand-primary)] bg-[var(--color-brand-primary-muted)] text-[var(--color-brand-primary)] opacity-50"
          : "border-[var(--color-border-subtle)] bg-white text-[var(--color-text-primary)] hover:border-[var(--color-brand-primary)]"
      }`}
    >
      <GripHorizontal size={11} className="shrink-0 opacity-50" />
      <span className="font-semibold">{col.key}</span>
      {col.sampleValue && (
        <span className="max-w-[80px] truncate text-[var(--color-text-muted)]">
          {col.sampleValue}
        </span>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// SLOT (Droppable target)
// ─────────────────────────────────────────────

function MappingSlot({
  slotKey,
  label,
  required,
  mappedCol,
  columns,
  dragOverSlot,
  onDragOver,
  onDragLeave,
  onDrop,
  onClear,
}: {
  slotKey: string;
  label: string;
  required: boolean;
  mappedCol: string | null;
  columns: SheetColumnInfo[];
  dragOverSlot: string | null;
  onDragOver: (key: string) => void;
  onDragLeave: () => void;
  onDrop: (slotKey: string) => void;
  onClear: (slotKey: string) => void;
}) {
  const mappedColInfo = mappedCol ? columns.find((c) => c.key === mappedCol) : null;
  const isOver = dragOverSlot === slotKey;

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        onDragOver(slotKey);
      }}
      onDragLeave={onDragLeave}
      onDrop={(e) => {
        e.preventDefault();
        onDrop(slotKey);
      }}
      className={`flex min-h-[52px] flex-col gap-1 rounded border-2 border-dashed px-3 py-2 transition-all ${
        isOver
          ? "border-[var(--color-brand-primary)] bg-[var(--color-brand-primary-muted)]"
          : mappedCol
          ? "border-[var(--color-accent-success)] bg-emerald-50"
          : "border-[var(--color-border-subtle)] bg-[var(--color-surface-card)]"
      }`}
    >
      <div className="flex items-center gap-1">
        <span className="text-xxs font-semibold uppercase text-[var(--color-text-muted)]">
          {label}
        </span>
        {required && (
          <span className="text-xxs font-bold text-[var(--color-accent-error)]">*</span>
        )}
      </div>

      {mappedColInfo ? (
        <div className="flex items-center gap-1.5">
          <span className="rounded bg-[var(--color-accent-success)] px-1.5 py-0.5 text-xxs font-bold text-white">
            {mappedColInfo.key}
          </span>
          <span className="max-w-[100px] truncate text-xs text-[var(--color-text-secondary)]">
            {mappedColInfo.sampleValue || "(trống)"}
          </span>
          <button
            type="button"
            onClick={() => onClear(slotKey)}
            className="ml-auto rounded-full p-0.5 text-[var(--color-text-muted)] hover:text-[var(--color-accent-error)]"
          >
            <X size={12} />
          </button>
        </div>
      ) : (
        <p className="text-xs text-[var(--color-text-muted)]">
          {isOver ? "Thả vào đây" : "Kéo cột vào đây"}
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// RESULT TABLE (Phase 3)
// ─────────────────────────────────────────────

function ResultTable({ rows }: { rows: VoucherItemParseResult[] }) {
  return (
    <div className="overflow-hidden rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)]">
      <div className="max-h-56 overflow-auto">
        <table className="w-full min-w-[600px] text-left text-xs">
          <thead className="sticky top-0 bg-[var(--color-surface-card)] text-xxs uppercase text-[var(--color-text-muted)]">
            <tr>
              <th className="px-3 py-2">Dòng</th>
              <th className="px-3 py-2">Trạng thái</th>
              <th className="px-3 py-2">Sản phẩm (catalog)</th>
              <th className="px-3 py-2">SKU</th>
              <th className="px-3 py-2">Vị trí</th>
              <th className="px-3 py-2 text-right">SL</th>
              <th className="px-3 py-2 text-right">Đơn giá</th>
              <th className="px-3 py-2">Lỗi / Cảnh báo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border-soft)]">
            {rows.map((row) => {
              const hasError = row.errors.length > 0;
              const hasWarn = row.warnings.length > 0;
              return (
                <tr
                  key={row.rowNumber}
                  className={
                    hasError ? "bg-red-50" : hasWarn ? "bg-amber-50" : "bg-white"
                  }
                >
                  <td className="px-3 py-2 font-medium text-[var(--color-text-muted)]">
                    {row.rowNumber}
                  </td>
                  <td className="px-3 py-2">
                    {hasError ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xxs font-medium text-red-700">
                        <AlertCircle size={10} /> Lỗi
                      </span>
                    ) : hasWarn ? (
                      <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xxs font-medium text-amber-700">
                        Cảnh báo
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xxs font-medium text-emerald-700">
                        <CheckCircle2 size={10} /> Hợp lệ
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span className="font-medium">
                      {row.matchedProduct?.name ?? (
                        <span className="text-[var(--color-text-muted)]">
                          {row.rawName || row.rawSku || "—"}
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-[var(--color-text-muted)]">
                    {(row.matchedProduct?.code ?? row.rawSku) || "—"}
                  </td>
                  <td className="px-3 py-2 text-[var(--color-text-muted)]">
                    {row.parsedLocationCode || "—"}
                  </td>
                  <td className="px-3 py-2 text-right">{row.parsedQuantity ?? "—"}</td>
                  <td className="px-3 py-2 text-right">
                    {row.parsedUnitPrice != null
                      ? new Intl.NumberFormat("vi-VN", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        }).format(row.parsedUnitPrice)
                      : "—"}
                  </td>
                  <td className="px-3 py-2">
                    <div className="space-y-0.5">
                      {[...row.errors, ...row.warnings].map((msg, i) => (
                        <p
                          key={i}
                          className={
                            row.errors.includes(msg) ? "text-red-600" : "text-amber-600"
                          }
                        >
                          {msg}
                        </p>
                      ))}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────

export function VoucherExcelImportPanel({
  uploadedFiles,
  products,
  onImport,
}: VoucherExcelImportPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const [phase, setPhase] = useState<PanelPhase>("upload");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [startRow, setStartRow] = useState(2);
  const [availableSheets, setAvailableSheets] = useState<ExcelSheetInfo[]>([]);
  const [selectedSheetIndex, setSelectedSheetIndex] = useState(0);
  const [preview, setPreview] = useState<SheetPreview | null>(null);
  const [mapping, setMapping] = useState<VoucherColumnMapping>(EMPTY_MAPPING);
  const [dragCol, setDragCol] = useState<string | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<string | null>(null);
  const [parseResults, setParseResults] = useState<VoucherItemParseResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Các file XLSX từ bước 1
  const xlsxFromStep1 = uploadedFiles.filter(
    (f) =>
      f.name.toLowerCase().endsWith(".xlsx") ||
      f.type ===
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );

  // ─── Bước 1: Chọn file ───

  const handleFileSelect = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      gooeyToast.error("Chỉ hỗ trợ file .xlsx", {
        description: "Vui lòng chọn file Excel định dạng .xlsx.",
      });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      gooeyToast.error("File quá lớn", {
        description: "Kích thước tối đa là 10MB.",
      });
      return;
    }
    setSelectedFile(file);
    setMapping(EMPTY_MAPPING);
    setParseResults([]);
    
    setIsLoading(true);
    try {
      const sheets = await getExcelSheets(file);
      setAvailableSheets(sheets);
      setSelectedSheetIndex(0);
    } catch (err) {
      console.error("[VoucherExcelImportPanel] getExcelSheets:", err);
      gooeyToast.error("Không thể đọc danh sách sheet", {
        description: "Vui lòng kiểm tra lại file Excel.",
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleReadColumns = useCallback(async () => {
    if (!selectedFile) return;
    setIsLoading(true);
    try {
      const p = await readSheetPreview(selectedFile, selectedSheetIndex, startRow);
      setPreview(p);
      setPhase("mapping");
      setMapping(EMPTY_MAPPING);
    } catch (err) {
      console.error("[VoucherExcelImportPanel] readSheetPreview:", err);
      gooeyToast.error("Không thể đọc file Excel", {
        description:
          err instanceof Error ? err.message : "Vui lòng kiểm tra lại file.",
      });
    } finally {
      setIsLoading(false);
    }
  }, [selectedFile, selectedSheetIndex, startRow]);

  // ─── Bước 2: Kéo thả map cột ───

  const handleDrop = useCallback(
    (slotKey: string) => {
      if (!dragCol) return;
      setMapping((prev) => ({ ...prev, [slotKey]: dragCol }));
      setDragCol(null);
      setDragOverSlot(null);
    },
    [dragCol]
  );

  const handleClearSlot = useCallback((slotKey: string) => {
    setMapping((prev) => ({ ...prev, [slotKey]: null }));
  }, []);

  const canParse =
    mapping.productName !== null && mapping.quantity !== null;

  const handleParse = useCallback(async () => {
    if (!selectedFile || !canParse) return;
    setIsLoading(true);
    try {
      const results = await parseVoucherRows(
        selectedFile,
        selectedSheetIndex,
        mapping,
        startRow,
        products
      );
      setParseResults(results);
      setPhase("preview");
    } catch (err) {
      console.error("[VoucherExcelImportPanel] parseVoucherRows:", err);
      gooeyToast.error("Lỗi khi đọc dữ liệu", {
        description:
          err instanceof Error ? err.message : "Vui lòng thử lại.",
      });
    } finally {
      setIsLoading(false);
    }
  }, [selectedFile, selectedSheetIndex, mapping, startRow, products, canParse]);

  // ─── Bước 3: Import ───

  const stats = summarizeVoucherResults(parseResults);

  const handleConfirmImport = useCallback(() => {
    const validItems = parseResults
      .filter((r) => r.errors.length === 0 && r.matchedProduct && r.parsedQuantity)
      .map((r) => ({
        productId: r.matchedProduct!.id,
        quantity: r.parsedQuantity!,
        unitPrice: r.parsedUnitPrice ?? 0,
        notes: r.rawNotes,
        locationCode: r.parsedLocationCode,
      }));

    if (validItems.length === 0) {
      gooeyToast.error("Không có dòng hợp lệ nào để thêm.");
      return;
    }

    onImport(validItems);
    gooeyToast.success(`Đã thêm ${validItems.length} sản phẩm vào phiếu`, {
      preset: "snappy",
    });
    // Reset về phase upload
    setPhase("upload");
    setSelectedFile(null);
    setAvailableSheets([]);
    setSelectedSheetIndex(0);
    setPreview(null);
    setMapping(EMPTY_MAPPING);
    setParseResults([]);
  }, [parseResults, onImport]);

  const handleReset = useCallback(() => {
    setPhase("upload");
    setSelectedFile(null);
    setAvailableSheets([]);
    setSelectedSheetIndex(0);
    setPreview(null);
    setMapping(EMPTY_MAPPING);
    setParseResults([]);
  }, []);

  const mappedKeys = Object.values(mapping).filter(Boolean) as string[];

  // ─────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────

  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)]">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-[var(--color-border-soft)] px-4 py-3">
        <FileSpreadsheet size={16} className="shrink-0 text-[var(--color-accent-success)]" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-[var(--color-text-primary)]">
            Nhập từ file Excel
          </p>
          <p className="text-xs text-[var(--color-text-muted)]">
            Đọc danh sách sản phẩm từ file .xlsx và tự động thêm vào phiếu
          </p>
        </div>
        {phase !== "upload" && (
          <button
            type="button"
            onClick={handleReset}
            className="flex h-7 items-center gap-1.5 rounded-[var(--radius-xs)] border border-[var(--color-border-subtle)] px-2.5 text-xs text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-card)]"
          >
            <RotateCcw size={12} />
            Bắt đầu lại
          </button>
        )}
      </div>

      <div className="p-4">
        {/* ───────────── PHASE 1: UPLOAD ───────────── */}
        {phase === "upload" && (
          <div className="space-y-3">
            {/* Gợi ý file từ bước 1 */}
            {xlsxFromStep1.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-[var(--color-text-secondary)]">
                  File Excel từ bước 1:
                </p>
                {xlsxFromStep1.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => void handleFileSelect(f.file)}
                    className={`flex w-full items-center gap-2 rounded-[var(--radius-xs)] border px-3 py-2 text-left text-xs transition-all hover:border-[var(--color-brand-primary)] ${
                      selectedFile?.name === f.name
                        ? "border-[var(--color-brand-primary)] bg-[var(--color-brand-primary-muted)]"
                        : "border-[var(--color-border-subtle)] bg-white"
                    }`}
                  >
                    <FileSpreadsheet
                      size={14}
                      className="shrink-0 text-[var(--color-accent-success)]"
                    />
                    <span className="flex-1 truncate font-medium">{f.name}</span>
                    {selectedFile?.name === f.name && (
                      <CheckCircle2
                        size={14}
                        className="shrink-0 text-[var(--color-brand-primary)]"
                      />
                    )}
                  </button>
                ))}
                <div className="flex items-center gap-2">
                  <div className="h-px flex-1 bg-[var(--color-border-soft)]" />
                  <span className="text-xxs text-[var(--color-text-muted)]">
                    hoặc tải file khác
                  </span>
                  <div className="h-px flex-1 bg-[var(--color-border-soft)]" />
                </div>
              </div>
            )}

            {/* Dropzone */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files[0];
                if (file) void handleFileSelect(file);
              }}
              className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[var(--radius-sm)] border-2 border-dashed border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] py-5 text-center transition-all hover:border-[var(--color-brand-primary)] hover:bg-[var(--color-brand-primary-muted)]"
              onClick={() => inputRef.current?.click()}
            >
              <Upload
                size={20}
                className={
                  selectedFile
                    ? "text-[var(--color-accent-success)]"
                    : "text-[var(--color-text-muted)]"
                }
              />
              <p className="text-xs font-medium text-[var(--color-text-secondary)]">
                {selectedFile ? (
                  <span className="text-[var(--color-accent-success)]">
                    ✓ {selectedFile.name}
                  </span>
                ) : (
                  "Kéo thả hoặc nhấn để chọn file .xlsx"
                )}
              </p>
            </div>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFileSelect(f);
                e.target.value = "";
              }}
            />

            {/* Sheet & Hàng bắt đầu */}
            {selectedFile && (
              <div className="flex flex-col gap-3">
                {availableSheets.length > 0 && (
                  <label className="flex items-center gap-2 text-xs font-medium text-[var(--color-text-secondary)]">
                    Chọn Sheet cần đọc:
                    <select
                      value={selectedSheetIndex}
                      onChange={(e) => setSelectedSheetIndex(Number(e.target.value))}
                      className="h-8 flex-1 rounded-[var(--radius-xs)] border border-[var(--color-border-subtle)] bg-white px-2 text-sm outline-none focus:border-[var(--color-border-focus)]"
                    >
                      {availableSheets.map((s) => (
                        <option key={s.index} value={s.index}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-xs font-medium text-[var(--color-text-secondary)]">
                    Dữ liệu bắt đầu từ hàng số:
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={startRow}
                      onChange={(e) =>
                        setStartRow(Math.max(1, Number(e.target.value)))
                      }
                      className="h-8 w-16 rounded-[var(--radius-xs)] border border-[var(--color-border-subtle)] bg-white px-2 text-center text-sm outline-none focus:border-[var(--color-border-focus)]"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => void handleReadColumns()}
                    disabled={isLoading}
                    className="flex h-8 items-center gap-2 rounded-[var(--radius-sm)] bg-[var(--color-brand-primary)] px-4 text-sm font-semibold text-white transition-all hover:bg-[var(--color-brand-primary-hover)] active:scale-[0.98] disabled:opacity-60"
                  >
                    {isLoading ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <ChevronRight size={14} />
                    )}
                    Đọc file
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ───────────── PHASE 2: MAPPING ───────────── */}
        {phase === "mapping" && preview && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
              <FileSpreadsheet size={13} />
              <span>
                Sheet: <strong>{preview.sheetName}</strong> ·{" "}
                {preview.totalDataRows} hàng · Hàng mẫu #{startRow}
              </span>
            </div>

            {/* Các cột từ file */}
            <div>
              <p className="mb-2 text-xs font-semibold text-[var(--color-text-secondary)]">
                Cột trong file — kéo vào slot bên dưới:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {preview.columns.map((col) => (
                  <ColumnChip
                    key={col.key}
                    col={col}
                    isMapped={mappedKeys.includes(col.key)}
                    onDragStart={setDragCol}
                  />
                ))}
              </div>
            </div>

            {/* Slots */}
            <div>
              <p className="mb-2 text-xs font-semibold text-[var(--color-text-secondary)]">
                Thông tin hệ thống cần:
              </p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {[...REQUIRED_SLOTS, ...OPTIONAL_SLOTS].map((slotKey) => (
                  <MappingSlot
                    key={slotKey}
                    slotKey={slotKey}
                    label={SLOT_LABELS[slotKey].label}
                    required={SLOT_LABELS[slotKey].required}
                    mappedCol={mapping[slotKey as keyof VoucherColumnMapping]}
                    columns={preview.columns}
                    dragOverSlot={dragOverSlot}
                    onDragOver={setDragOverSlot}
                    onDragLeave={() => setDragOverSlot(null)}
                    onDrop={handleDrop}
                    onClear={handleClearSlot}
                  />
                ))}
              </div>
            </div>

            {!canParse && (
              <p className="text-xs text-[var(--color-accent-warning)]">
                ⚠ Cần kéo ít nhất "Tên sản phẩm" và "Số lượng" vào slot.
              </p>
            )}

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => void handleParse()}
                disabled={!canParse || isLoading}
                className="flex h-8 items-center gap-2 rounded-[var(--radius-sm)] bg-[var(--color-brand-primary)] px-5 text-sm font-semibold text-white transition-all hover:bg-[var(--color-brand-primary-hover)] active:scale-[0.98] disabled:opacity-50"
              >
                {isLoading ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <ChevronRight size={14} />
                )}
                Đọc dữ liệu
              </button>
            </div>
          </div>
        )}

        {/* ───────────── PHASE 3: PREVIEW ───────────── */}
        {phase === "preview" && parseResults.length > 0 && (
          <div className="space-y-3">
            {/* Stats */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                {
                  label: "Tổng dòng đọc",
                  value: stats.totalRows,
                  tone: "neutral",
                },
                {
                  label: "Hợp lệ",
                  value: stats.validRows,
                  tone: "success",
                },
                {
                  label: "Lỗi",
                  value: stats.errorRows,
                  tone: "error",
                },
                {
                  label: "Cảnh báo",
                  value: stats.warningRows,
                  tone: "warning",
                },
              ].map((s) => (
                <div
                  key={s.label}
                  className="rounded-[var(--radius-xs)] border border-[var(--color-border-subtle)] bg-white p-3"
                >
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {s.label}
                  </p>
                  <p
                    className={`mt-0.5 text-base font-bold ${
                      s.tone === "error"
                        ? "text-[var(--color-accent-error)]"
                        : s.tone === "warning"
                        ? "text-amber-600"
                        : s.tone === "success"
                        ? "text-emerald-600"
                        : "text-[var(--color-text-primary)]"
                    }`}
                  >
                    {s.value}
                  </p>
                </div>
              ))}
            </div>

            {/* Preview table */}
            <ResultTable rows={parseResults} />

            {/* Action */}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={stats.validRows === 0}
                className="flex h-8 items-center gap-2 rounded-[var(--radius-sm)] bg-[var(--color-accent-success)] px-5 text-sm font-semibold text-white transition-all hover:brightness-95 active:scale-[0.98] disabled:opacity-50"
              >
                <CheckCircle2 size={15} />
                Thêm {stats.validRows} sản phẩm hợp lệ vào phiếu
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
