import type { ISOTimestamped, SoftDeletable } from "./utility.js";

export type ReportTemplateType = "EXCEL" | "EMAIL";

export type ReportTemplateVisibility = "private" | "shared";

export type ReportTemplateStatus = "draft" | "active" | "archived";

export type ReportFieldKey = "inventory.stock_by_product";

export type ReportDateMode =
  | "today"
  | "specific_date"
  | "date_range"
  | "month"
  | "year";

export type InventoryReportQuantityBucket =
  | "total_quantity"
  | "atp_quantity"
  | "on_hold_quantity"
  | "in_transit_quantity"
  | "quarantine_quantity";

export interface InventoryStockByProductParams {
  product_id?: string;
  product_code: string;
  warehouse_scope: "all_accessible" | "specific_warehouse";
  warehouse_id?: string | null;
  quantity_bucket: InventoryReportQuantityBucket;
  date_mode: ReportDateMode;
  date?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  month?: string | null;
  year?: string | null;
  output_format: "number" | "with_unit" | "detailed";
}

export interface ReportFieldInstance {
  id: string;
  field_key: ReportFieldKey;
  label: string;
  params: InventoryStockByProductParams;
}

export interface ExcelCellMapping {
  id: string;
  sheet_name: string;
  cell: string;
  field_instance_id: string;
  write_mode: "value";
}

export interface ReportExcelMapping {
  field_instances: ReportFieldInstance[];
  cell_mappings: ExcelCellMapping[];
}

export interface ReportWorkbookSheetMeta {
  name: string;
  row_count: number;
  column_count: number;
  merged_cells: string[];
}

export interface ReportTemplate extends SoftDeletable, ISOTimestamped {
  id: string;
  name: string;
  type: ReportTemplateType;
  visibility: ReportTemplateVisibility;
  owner_id: string;
  active_version_id: string | null;
  status: ReportTemplateStatus;
}

export interface ReportTemplateVersion extends SoftDeletable, ISOTimestamped {
  id: string;
  template_id: string;
  version: number;
  original_file_name: string;
  storage_path: string;
  workbook_meta: {
    sheets: ReportWorkbookSheetMeta[];
  };
  mapping: ReportExcelMapping;
  status: ReportTemplateStatus;
  created_by: string;
}

export interface ReportExportRecord extends SoftDeletable, ISOTimestamped {
  id: string;
  template_id: string;
  template_version_id: string;
  requested_by: string;
  status: "done" | "failed";
  output_file_name: string | null;
  storage_path: string | null;
  error_message: string | null;
}
