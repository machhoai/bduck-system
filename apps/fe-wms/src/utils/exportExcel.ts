import ExcelJS from "exceljs";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://api.wms.localhost";

export interface ExcelColumnConfig {
  header: string;
  key: string;
  width?: number;
  format?: (value: any, row: any) => string | number;
}

export interface ExportConfig {
  filename: string;
  columns: ExcelColumnConfig[];
  data: any[];
  entityType: string;
  warehouseId?: string;
  filters?: Record<string, any>;
}

export const formatExportDate = (val: any): string => {
  if (!val) return "";
  let date: Date;
  // Check if it's a serialized Firestore Timestamp
  if (typeof val === "object" && "seconds" in val) {
    date = new Date(val.seconds * 1000);
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
  const { filename, columns, data, entityType, warehouseId, filters } = config;

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Data");

  // Format headers
  sheet.columns = columns.map((col) => ({
    header: col.header,
    key: col.key,
    width: col.width || 20,
  }));

  const headerColor = entityColorMap[entityType] || entityColorMap.default;

  const headerRow = sheet.getRow(1);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: headerColor },
    };
    cell.alignment = { vertical: "middle", horizontal: "center" };
  });

  // Add data
  data.forEach((row) => {
    const rowData: Record<string, any> = {};
    columns.forEach((col) => {
      rowData[col.key] = col.format ? col.format(row[col.key], row) : row[col.key];
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
