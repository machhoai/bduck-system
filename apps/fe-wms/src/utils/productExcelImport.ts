import { ProductOrigin, ProductType } from "@bduck/shared-types";
import type { Product, ProductCategory } from "@bduck/shared-types";
import ExcelJS from "exceljs";

export interface ProductImportPayload {
  category_id: string;
  name: string;
  code: string;
  barcode: string | null;
  product_image_url: string[] | null;
  product_material: string | null;
  product_origin: ProductOrigin | null;
  unit: string;
  product_type: ProductType;
  unit_price: number | null;
  is_serialized: boolean;
  description: string | null;
}

export interface ProductImportPreviewRow {
  rowNumber: number;
  raw: Record<string, string>;
  payload: ProductImportPayload | null;
  errors: string[];
  warnings: string[];
}

export interface ProductImportSummary {
  totalRows: number;
  validRows: number;
  errorRows: number;
  warningRows: number;
}

const PRODUCT_TEMPLATE_HEADERS = [
  "category_code",
  "name",
  "code",
  "barcode",
  "unit",
  "product_type",
  "product_material",
  "product_origin",
  "unit_price",
  "is_serialized",
  "description",
] as const;

const HEADER_ALIASES: Record<string, (typeof PRODUCT_TEMPLATE_HEADERS)[number]> =
  {
    category_code: "category_code",
    category: "category_code",
    ma_danh_muc: "category_code",
    danh_muc: "category_code",
    danh_muc_san_pham: "category_code",
    产品分类: "category_code",
    name: "name",
    product_name: "name",
    ten: "name",
    ten_san_pham: "name",
    产品名称: "name",
    code: "code",
    sku: "code",
    ma_sku: "code",
    ma_san_pham: "code",
    sku_ma_san_pham: "code",
    sku_产品编码: "code",
    barcode: "barcode",
    ma_vach: "barcode",
    条形码: "barcode",
    unit: "unit",
    don_vi: "unit",
    don_vi_tinh: "unit",
    单位: "unit",
    product_type: "product_type",
    loai: "product_type",
    loai_san_pham: "product_type",
    产品类型: "product_type",
    product_material: "product_material",
    chat_lieu: "product_material",
    材质: "product_material",
    product_origin: "product_origin",
    nguon_goc: "product_origin",
    来源: "product_origin",
    unit_price: "unit_price",
    don_gia: "unit_price",
    单价: "unit_price",
    is_serialized: "is_serialized",
    serial: "is_serialized",
    theo_doi_serial: "is_serialized",
    序列号管理: "is_serialized",
    description: "description",
    mo_ta: "description",
    描述: "description",
  };

const normalizeText = (value: unknown) =>
  String(value ?? "")
    .trim()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");

const normalizeKey = (value: unknown) =>
  normalizeText(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "_")
    .replace(/^_+|_+$/g, "");

const cleanCell = (value: unknown) => String(value ?? "").trim();
const extractOptionCode = (value: string) => value.split(" - ")[0].trim();

const parseBoolean = (value: string): boolean | null => {
  const normalized = normalizeKey(extractOptionCode(value));
  if (!normalized) return null;
  if (["true", "1", "yes", "y", "co", "c", "serialized"].includes(normalized)) {
    return true;
  }
  if (["false", "0", "no", "n", "khong", "k", "standard"].includes(normalized)) {
    return false;
  }
  return null;
};

const countBy = <T,>(items: T[], getKey: (item: T) => string | null) => {
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = getKey(item);
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
};

const normalizeIdentity = (value: string | null | undefined) =>
  normalizeText(value).toLowerCase();

const extractCategoryCode = extractOptionCode;

function normalizeRow(row: Record<string, unknown>): Record<string, any> {
  const normalized: Record<string, any> = {};

  for (const [key, value] of Object.entries(row)) {
    const normalizedKey = normalizeKey(key);
    const mappedKey =
      HEADER_ALIASES[normalizedKey] ||
      HEADER_ALIASES[normalizeKey(key.split("(")[0])];

    if (mappedKey) {
      normalized[mappedKey] = value;
    }
  }

  return normalized;
}

export async function parseProductImportFile(
  file: File,
  categories: ProductCategory[],
  products: Product[],
): Promise<ProductImportPreviewRow[]> {
  const buffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.getWorksheet("products") ?? workbook.worksheets[0];

  if (!sheet) {
    throw new Error("Tệp Excel không có sheet dữ liệu.");
  }

  const headers: string[] = [];
  sheet.getRow(1).eachCell((cell, colNumber) => {
    headers[colNumber - 1] = cleanCell(cell.value);
  });

  const rows: { raw: Record<string, string>, rawValues: Record<string, any> }[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const rowData: Record<string, string> = {};
    const rawValuesData: Record<string, any> = {};
    headers.forEach((header, index) => {
      const cell = row.getCell(index + 1);
      rowData[header] = cleanCell(cell.text || cell.value);
      rawValuesData[header] = cell.type === 4 /* Formula */ ? cell.result : cell.value;
    });
    rows.push({ raw: rowData, rawValues: rawValuesData });
  });

  const normalizedRows = rows
    .map((row, index) => ({ rowNumber: index + 2, raw: normalizeRow(row.raw) as Record<string, string>, rawValues: normalizeRow(row.rawValues) }))
    .filter(({ raw }) => Object.values(raw).some((value) => value && String(value).trim()));

  const categoryByCode = new Map(
    categories.map((category) => [normalizeIdentity(category.code), category]),
  );
  const existingCodeSet = new Set(
    products.map((product) => normalizeIdentity(product.code)),
  );
  const existingBarcodeSet = new Set(
    products
      .map((product) => normalizeIdentity(product.barcode))
      .filter(Boolean),
  );
  const existingNameSet = new Set(
    products.map((product) => normalizeIdentity(product.name)),
  );

  const codeCounts = countBy(normalizedRows, ({ raw }) =>
    normalizeIdentity(raw.code),
  );
  const barcodeCounts = countBy(normalizedRows, ({ raw }) =>
    raw.barcode ? normalizeIdentity(raw.barcode) : null,
  );
  const nameCounts = countBy(normalizedRows, ({ raw }) =>
    normalizeIdentity(raw.name),
  );

  return normalizedRows.map(({ rowNumber, raw, rawValues }) => {
    const errors: string[] = [];
    const warnings: string[] = [];
    const categoryCode = extractCategoryCode(raw.category_code);
    const category = categoryByCode.get(normalizeIdentity(categoryCode));
    const productType = extractOptionCode(raw.product_type) as ProductType;
    const productOrigin = extractOptionCode(raw.product_origin) as ProductOrigin;
    const parsedSerialized = parseBoolean(raw.is_serialized);
    
    let priceNumber: number | null = null;
    const rawPrice = rawValues.unit_price;
    if (rawPrice !== undefined && rawPrice !== null && rawPrice !== "") {
        if (typeof rawPrice === "number") {
            priceNumber = Math.round(rawPrice);
        } else {
            const priceText = String(rawPrice).trim();
            const priceNormalized = priceText.replace(/\./g, "").replace(",", ".");
            const parsed = Number(priceNormalized);
            priceNumber = !isNaN(parsed) ? Math.round(parsed) : null;
        }
    }

    if (!raw.category_code) errors.push("Thiếu category_code.");
    if (raw.category_code && !category) {
      errors.push(`Không tìm thấy danh mục "${raw.category_code}".`);
    }
    if (!raw.name) errors.push("Thiếu tên sản phẩm.");
    if (!raw.code) errors.push("Thiếu mã SKU.");
    if (!raw.unit) errors.push("Thiếu đơn vị tính.");
    if (!raw.product_type) errors.push("Thiếu loại sản phẩm.");
    if (
      raw.product_type &&
      !Object.values(ProductType).includes(productType)
    ) {
      errors.push(
        `product_type không hợp lệ. Dùng: ${Object.values(ProductType).join(", ")}.`,
      );
    }
    if (
      raw.product_origin &&
      !Object.values(ProductOrigin).includes(productOrigin)
    ) {
      errors.push("product_origin không hợp lệ. Dùng DOMESTIC hoặc INTERNATIONAL.");
    }
    if (parsedSerialized === null) {
      errors.push("is_serialized phải là true/false, yes/no hoặc 1/0.");
    }
    if (
      raw.unit_price &&
      (priceNumber === null ||
        isNaN(priceNumber) ||
        priceNumber < 0)
    ) {
      errors.push("unit_price phải là số không âm.");
    }

    const codeKey = normalizeIdentity(raw.code);
    const barcodeKey = normalizeIdentity(raw.barcode);
    const nameKey = normalizeIdentity(raw.name);

    if (codeKey && existingCodeSet.has(codeKey)) {
      errors.push(`SKU "${raw.code}" đã tồn tại trong hệ thống.`);
    }
    if (codeKey && (codeCounts.get(codeKey) ?? 0) > 1) {
      errors.push(`SKU "${raw.code}" bị trùng trong tệp.`);
    }
    if (barcodeKey && existingBarcodeSet.has(barcodeKey)) {
      errors.push(`Barcode "${raw.barcode}" đã tồn tại trong hệ thống.`);
    }
    if (barcodeKey && (barcodeCounts.get(barcodeKey) ?? 0) > 1) {
      errors.push(`Barcode "${raw.barcode}" bị trùng trong tệp.`);
    }
    if (nameKey && existingNameSet.has(nameKey)) {
      warnings.push(`Tên "${raw.name}" có thể trùng với sản phẩm hiện có.`);
    }
    if (nameKey && (nameCounts.get(nameKey) ?? 0) > 1) {
      warnings.push(`Tên "${raw.name}" xuất hiện nhiều lần trong tệp.`);
    }

    const payload =
      errors.length === 0 && category && parsedSerialized !== null
        ? {
            category_id: category.id,
            name: raw.name,
            code: raw.code,
            barcode: raw.barcode || null,
            product_image_url: null,
            product_material: raw.product_material || null,
            product_origin: raw.product_origin ? productOrigin : null,
            unit: raw.unit,
            product_type: productType,
            unit_price: priceNumber,
            is_serialized: parsedSerialized,
            description: raw.description || null,
          }
        : null;

    return { rowNumber, raw, payload, errors, warnings };
  });
}

export function summarizeProductImportRows(
  rows: ProductImportPreviewRow[],
): ProductImportSummary {
  return {
    totalRows: rows.length,
    validRows: rows.filter((row) => row.payload).length,
    errorRows: rows.filter((row) => row.errors.length > 0).length,
    warningRows: rows.filter((row) => row.warnings.length > 0).length,
  };
}
