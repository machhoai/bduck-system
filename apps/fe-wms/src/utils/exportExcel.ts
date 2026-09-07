/* eslint-disable @typescript-eslint/no-explicit-any -- legacy generic exporter accepts multiple domain row shapes */
import type {
  RevenueExportReportType,
  RevenueExportProductSelection,
  RevenueExportProductOption,
  RevenueDataSource,
} from "@bduck/shared-types";
import ExcelJS from "exceljs";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://api.wms.localhost";

export interface ExcelColumnConfig {
  header: string;
  key: string;
  width?: number;
  format?: (value: any, row: any) => string | number;
}

export interface ExcelColumnGroup {
  header: string;
  fromKey: string;
  toKey: string;
}

export type ExportDataKind =
  | "inventory"
  | "imports"
  | "exports"
  | "movement"
  | "dailySummary"
  | "counterDailySummary";
export type ExportDateMode = "date" | "month" | "range";

export interface ExportSelectOption {
  value: string;
  label: string;
  parentId?: string | null;
}

export interface ExportFilterOptions {
  categories?: ExportSelectOption[];
  locations?: ExportSelectOption[];
  slots?: ExportSelectOption[];
  units?: ExportSelectOption[];
  materials?: ExportSelectOption[];
}

export interface ExportRequestOptions {
  dataKind?: ExportDataKind;
  dateMode?: ExportDateMode;
  date?: string;
  month?: string;
  dateFrom?: string;
  dateTo?: string;
  productSearch?: string;
  categoryId?: string;
  productType?: string;
  productOrigin?: string;
  serialized?: "all" | "serialized" | "standard";
  productUnit?: string;
  productMaterial?: string;
  locationId?: string;
  slotId?: string;
  reportType?: RevenueExportReportType;
  products?: RevenueExportProductSelection[];
  roundMoney?: boolean;
}

export interface WarehouseExportDialogConfig {
  type: "warehouse";
  title: string;
  description?: string;
  defaultOptions?: ExportRequestOptions;
  filterOptions?: ExportFilterOptions;
}

export interface RevenueExportDialogConfig {
  type: "revenue";
  title: string;
  description?: string;
  warehouseName?: string;
  sourceLabel?: string;
  rangeLabel?: string;
  source?: RevenueDataSource;
  contextKey?: string;
  products?: RevenueExportProductOption[];
  productsLoading?: boolean;
  productsError?: string | null;
}

export type ExportDialogConfig =
  | WarehouseExportDialogConfig
  | RevenueExportDialogConfig;

export interface ExportToastConfig {
  loading: string;
  success: string;
  successDescription: string;
  error: string;
  errorDescription: string;
  retry: string;
}

export interface ExportConfig {
  filename: string;
  columns: ExcelColumnConfig[];
  columnGroups?: ExcelColumnGroup[];
  data: any[];
  entityType: string;
  warehouseId?: string;
  filters?: Record<string, any>;
  dialog?: ExportDialogConfig;
  toast?: ExportToastConfig;
  prepare?: (options: ExportRequestOptions) => Promise<ExportConfig>;
}

export interface CustomExportConfig {
  entityType: string;
  warehouseId?: string;
  dialog: RevenueExportDialogConfig;
  toast?: ExportToastConfig;
  execute: (options: ExportRequestOptions) => Promise<void>;
}

export type RegisteredExportConfig = ExportConfig | CustomExportConfig;

export function isCustomExportConfig(
  config: RegisteredExportConfig,
): config is CustomExportConfig {
  return "execute" in config;
}

export const formatExportDate = (val: any): string => {
  if (!val) return "";
  let date: Date;
  // Check if it's a serialized Firestore Timestamp
  if (typeof val === "object") {
    if (typeof val.toDate === "function") {
      date = val.toDate();
    } else if ("seconds" in val) {
      date = new Date(val.seconds * 1000);
    } else if ("_seconds" in val) {
      date = new Date(val._seconds * 1000);
    } else {
      date = new Date(val as any);
    }
  } else {
    date = new Date(val);
  }

  if (isNaN(date.getTime())) return String(val);

  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

const entityColorMap: Record<string, string> = {
  products: "FF1E3A8A", // Blue 900
  audit_logs: "FF4C1D95", // Violet 900
  inventory: "FF065F46", // Emerald 900
  default: "FF374151", // Gray 700
};

export async function exportToExcel(config: ExportConfig): Promise<void> {
  const {
    filename,
    columns,
    columnGroups,
    data,
    entityType,
    warehouseId,
    filters,
  } = config;

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Data");
  const headerColor = entityColorMap[entityType] || entityColorMap.default;

  const styleHeaderCell = (cell: ExcelJS.Cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: headerColor },
    };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.border = {
      top: { style: "thin", color: { argb: "FFE5E7EB" } },
      left: { style: "thin", color: { argb: "FFE5E7EB" } },
      bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
      right: { style: "thin", color: { argb: "FFE5E7EB" } },
    };
  };

  if (columnGroups?.length) {
    sheet.columns = columns.map((col) => ({
      key: col.key,
      width: col.width || 20,
    }));

    const groupedKeys = new Set<string>();
    for (const group of columnGroups) {
      const fromIndex = columns.findIndex(
        (column) => column.key === group.fromKey,
      );
      const toIndex = columns.findIndex((column) => column.key === group.toKey);
      if (fromIndex < 0 || toIndex < 0) continue;
      for (let index = fromIndex; index <= toIndex; index += 1) {
        groupedKeys.add(columns[index].key);
      }
      sheet.mergeCells(1, fromIndex + 1, 1, toIndex + 1);
      sheet.getRow(1).getCell(fromIndex + 1).value = group.header;
    }

    columns.forEach((column, index) => {
      const columnIndex = index + 1;
      if (groupedKeys.has(column.key)) {
        sheet.getRow(2).getCell(columnIndex).value = column.header;
      } else {
        sheet.mergeCells(1, columnIndex, 2, columnIndex);
        sheet.getRow(1).getCell(columnIndex).value = column.header;
      }
    });

    sheet.getRow(1).height = 22;
    sheet.getRow(2).height = 20;
    sheet.getRow(1).eachCell(styleHeaderCell);
    sheet.getRow(2).eachCell(styleHeaderCell);
    sheet.views = [{ state: "frozen", ySplit: 2 }];
  } else {
    // Format headers
    sheet.columns = columns.map((col) => ({
      header: col.header,
      key: col.key,
      width: col.width || 20,
    }));

    const headerRow = sheet.getRow(1);
    headerRow.eachCell(styleHeaderCell);
    sheet.views = [{ state: "frozen", ySplit: 1 }];
  }

  // Add data
  data.forEach((row) => {
    const rowData: Record<string, any> = {};
    columns.forEach((col) => {
      rowData[col.key] = col.format
        ? col.format(row[col.key], row)
        : row[col.key];
    });
    sheet.addRow(rowData);
  });

  // Call API to log export action
  try {
    await fetch(`${API_BASE_URL}/api/audit-logs/export`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        entity_type: entityType,
        warehouse_id: warehouseId,
        filters: filters || {},
      }),
    });
  } catch (error) {
    console.error("Failed to log export action to audit_logs", error);
  }

  // Download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}_${new Date().toISOString().replace(/[:.]/g, "-")}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
