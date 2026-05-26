"use client";

import { CheckCircle2, Download, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { gooeyToast } from "goey-toast";
import { useMemo, useRef, useState } from "react";
import type { DragEvent } from "react";
import type { Product, ProductCategory } from "@bduck/shared-types";
import {
  parseProductImportFile,
  summarizeProductImportRows,
  type ProductImportPayload,
  type ProductImportPreviewRow,
} from "@/utils/productExcelImport";
import { downloadProductImportTemplate } from "@/utils/productExcelTemplate";
import {
  ConfirmSkipInvalidRowsModal,
  ProductImportPreviewTable,
  ProductImportStats,
} from "./ProductExcelImportPreview";

interface ProductExcelImportTabProps {
  products: Product[];
  categories: ProductCategory[];
  disabled: boolean;
  onImport: (payloads: ProductImportPayload[]) => Promise<number>;
  onImported: () => void;
}

export function ProductExcelImportTab({
  products,
  categories,
  disabled,
  onImport,
  onImported,
}: ProductExcelImportTabProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<ProductImportPreviewRow[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const summary = useMemo(() => summarizeProductImportRows(rows), [rows]);
  const validPayloads = useMemo(
    () =>
      rows
        .map((row) => row.payload)
        .filter((payload): payload is ProductImportPayload => !!payload),
    [rows],
  );

  const parseFile = async (file: File) => {
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (extension !== "xlsx") {
      gooeyToast.error("Tệp không hợp lệ", {
        description: "Chỉ hỗ trợ định dạng .xlsx.",
      });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      gooeyToast.error("Tệp vượt quá 10MB", {
        description: "Vui lòng chọn tệp Excel có dung lượng nhỏ hơn 10MB.",
      });
      return;
    }

    setIsParsing(true);
    try {
      const parsedRows = await parseProductImportFile(file, categories, products);
      setRows(parsedRows);
      setFileName(file.name);
      gooeyToast.success("Đã đọc tệp Excel", {
        description: `Đã đọc ${parsedRows.length} dòng dữ liệu sản phẩm.`,
        preset: "snappy",
      });
    } catch (error) {
      console.error("[ProductExcelImportTab] parse error:", error);
      gooeyToast.error("Không thể đọc tệp Excel", {
        description:
          error instanceof Error
            ? error.message
            : "Vui lòng kiểm tra lại định dạng tệp.",
      });
    } finally {
      setIsParsing(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleFileInput = (files: FileList | null) => {
    const file = files?.[0];
    if (file) void parseFile(file);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    handleFileInput(event.dataTransfer.files);
  };

  const handleDownloadTemplate = async () => {
    try {
      await downloadProductImportTemplate(categories);
    } catch (error) {
      console.error("[ProductExcelImportTab] template error:", error);
      gooeyToast.error("Không thể tạo tệp mẫu", {
        description:
          error instanceof Error
            ? error.message
            : "Vui lòng thử lại sau.",
      });
    }
  };

  const submitValidRows = async () => {
    if (validPayloads.length === 0 || isSubmitting) {
      gooeyToast.error("Chưa có dòng hợp lệ", {
        description: "Vui lòng kiểm tra lại tệp Excel trước khi tạo sản phẩm.",
      });
      return;
    }

    const importAction = async () => {
      setIsSubmitting(true);
      try {
        const createdCount = await onImport(validPayloads);
        onImported();
        return createdCount;
      } finally {
        setIsSubmitting(false);
        setIsConfirmOpen(false);
      }
    };

    try {
      await gooeyToast.promise(importAction(), {
        loading: "Đang tạo sản phẩm từ Excel...",
        success: "Đã tạo sản phẩm từ Excel",
        error: "Không thể tạo sản phẩm từ Excel",
        description: {
          success: `${validPayloads.length} dòng hợp lệ đã được xử lý.`,
          error: "Vui lòng kiểm tra lại dữ liệu và thử lại.",
        },
        action: {
          error: {
            label: "Thử lại",
            onClick: () => void submitValidRows(),
          },
        },
      });
    } catch (error) {
      console.error("[ProductExcelImportTab] import error:", error);
    }
  };

  const handleCreateClick = () => {
    if (summary.errorRows > 0) {
      setIsConfirmOpen(true);
      return;
    }
    void submitValidRows();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="text-[17px] font-semibold text-[var(--color-text-primary)]">
            Tạo sản phẩm bằng tệp Excel
          </h3>
          <p className="text-sm text-[var(--color-text-muted)]">
            Dữ liệu phải khớp các thuộc tính sản phẩm và mã danh mục hiện có.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void handleDownloadTemplate()}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-[var(--color-brand-primary)] px-4 text-sm font-normal text-[var(--color-brand-primary)] transition-all hover:bg-[var(--color-surface-card)] active:scale-95"
        >
          <Download size={16} />
          Tải tệp mẫu
        </button>
      </div>

      <div
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleDrop}
        className="flex min-h-44 flex-col items-center justify-center rounded-[var(--radius-lg)] border-2 border-dashed border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] px-4 py-8 text-center transition-colors hover:border-[var(--color-brand-primary)]"
      >
        <FileSpreadsheet
          size={36}
          className="mb-3 text-[var(--color-brand-primary)]"
        />
        <p className="text-[17px] font-semibold text-[var(--color-text-primary)]">
          {fileName || "Kéo tệp Excel vào đây"}
        </p>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          Hỗ trợ .xlsx và dung lượng tối đa 10MB.
        </p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isParsing || disabled}
          className="mt-4 inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-[var(--color-brand-primary)] px-4 text-sm font-normal text-white transition-all hover:bg-[var(--color-brand-primary-hover)] active:scale-95 disabled:opacity-50"
        >
          {isParsing ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Upload size={16} />
          )}
          Chọn tệp
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx"
          className="hidden"
          onChange={(event) => handleFileInput(event.target.files)}
        />
      </div>

      {rows.length > 0 && (
        <>
          <ProductImportStats summary={summary} />
          <ProductImportPreviewTable rows={rows} />
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleCreateClick}
              disabled={disabled || isSubmitting || summary.validRows === 0}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[var(--color-brand-primary)] px-5 text-[15px] font-normal text-white transition-all hover:bg-[var(--color-brand-primary-hover)] active:scale-95 disabled:opacity-50"
            >
              {isSubmitting ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <CheckCircle2 size={18} />
              )}
              Tạo {summary.validRows} sản phẩm hợp lệ
            </button>
          </div>
        </>
      )}

      {isConfirmOpen && (
        <ConfirmSkipInvalidRowsModal
          validCount={summary.validRows}
          errorCount={summary.errorRows}
          isSubmitting={isSubmitting}
          onCancel={() => setIsConfirmOpen(false)}
          onConfirm={() => void submitValidRows()}
        />
      )}
    </div>
  );
}
