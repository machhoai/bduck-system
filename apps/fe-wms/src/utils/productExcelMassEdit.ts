import { ProductOrigin, ProductType } from "@bduck/shared-types";
import type { Product, ProductCategory } from "@bduck/shared-types";
import ExcelJS from "exceljs";
import type { Language } from "@/lib/i18n";

type TemplateLanguage = Language;

type ProductColumnKey =
  | "id"
  | "category_code"
  | "name"
  | "code"
  | "barcode"
  | "unit"
  | "product_type"
  | "product_material"
  | "product_origin"
  | "hs_code"
  | "technical_specifications"
  | "dimensions"
  | "manufacturer"
  | "manufacturer_address"
  | "notes"
  | "applicable_standard"
  | "unit_price"
  | "is_serialized"
  | "description";

export interface ProductMassEditPayload {
  id: string;
  category_id: string;
  name: string;
  code: string; // SKU is readonly but needed
  barcode: string | null;
  product_material: string | null;
  product_origin: ProductOrigin | null;
  hs_code: string | null;
  technical_specifications: string | null;
  dimensions: string | null;
  manufacturer: string | null;
  manufacturer_address: string | null;
  notes: string | null;
  applicable_standard: string | null;
  unit: string;
  product_type: ProductType;
  unit_price: number | null;
  is_serialized: boolean;
  description: string | null;
}

export interface ProductMassEditPreviewRow {
  rowNumber: number;
  raw: Record<string, string>;
  payload: ProductMassEditPayload | null;
  errors: string[];
  warnings: string[];
}

export interface ProductMassEditSummary {
  totalRows: number;
  validRows: number;
  errorRows: number;
  warningRows: number;
}

const TEMPLATE_TEXT = {
  vi: {
    sheets: { products: "San_pham", guide: "Huong_dan", refs: "Gia_tri_chon" },
    fileName: "sua-hang-loat-san-pham.xlsx",
    columns: {
      id: {
        label: "ID (KHÔNG SỬA) *",
        note: "Bắt buộc. KHÔNG ĐƯỢC CHỈNH SỬA",
        width: 30,
        required: true,
      },
      category_code: {
        label: "Danh mục sản phẩm *",
        note: "Bắt buộc.",
        width: 36,
        required: true,
      },
      name: {
        label: "Tên sản phẩm *",
        note: "Bắt buộc.",
        width: 32,
        required: true,
      },
      code: {
        label: "SKU/Mã sản phẩm (KHÔNG SỬA) *",
        note: "Bắt buộc. KHÔNG ĐƯỢC CHỈNH SỬA",
        width: 22,
        required: true,
      },
      barcode: { label: "Barcode", note: "Không bắt buộc.", width: 22 },
      unit: {
        label: "Đơn vị tính *",
        note: "Bắt buộc.",
        width: 16,
        required: true,
      },
      product_type: {
        label: "Loại sản phẩm *",
        note: "Bắt buộc.",
        width: 28,
        required: true,
      },
      product_material: {
        label: "Chất liệu",
        note: "Không bắt buộc.",
        width: 22,
      },
      product_origin: {
        label: "Nguồn gốc",
        note: "Không bắt buộc.",
        width: 28,
      },
      hs_code: {
        label: "Mã HS code khai quan",
        note: "Không bắt buộc.",
        width: 22,
      },
      technical_specifications: {
        label: "Đặc tính kỹ thuật",
        note: "Không bắt buộc.",
        width: 36,
      },
      dimensions: { label: "Kích thước", note: "Không bắt buộc.", width: 22 },
      manufacturer: {
        label: "Nhà sản xuất",
        note: "Không bắt buộc.",
        width: 28,
      },
      manufacturer_address: {
        label: "Địa chỉ nhà sản xuất",
        note: "Không bắt buộc.",
        width: 36,
      },
      notes: { label: "Lưu ý", note: "Không bắt buộc.", width: 30 },
      applicable_standard: {
        label: "Quy chuẩn áp dụng",
        note: "Không bắt buộc.",
        width: 28,
      },
      unit_price: { label: "Đơn giá", note: "Không bắt buộc.", width: 18 },
      is_serialized: {
        label: "Theo dõi serial *",
        note: "Bắt buộc.",
        width: 28,
        required: true,
      },
      description: { label: "Mô tả", note: "Không bắt buộc.", width: 38 },
    },
    prompts: {
      title: "J-PULSE",
      invalidTitle: "Giá trị không hợp lệ",
      invalidList: "Vui lòng chọn một giá trị trong danh sách.",
      invalidUnitPrice: "Đơn giá phải là số nguyên không âm.",
      category: "Chọn danh mục. Hệ thống lấy mã danh mục ở trước dấu '-'.",
      unit: "Chọn đơn vị phổ biến hoặc nhập đơn vị khác nếu cần.",
      type: "Chọn loại sản phẩm theo nghiệp vụ.",
      origin: "Chọn nguồn gốc sản phẩm nếu đã biết.",
      serialized: "Chọn true nếu cần quản lý serial cho từng đơn vị sản phẩm.",
    },
    refs: {
      group: "Nhóm",
      value: "Giá trị chọn",
      meaning: "Ý nghĩa",
      category: "Danh mục",
      productType: "Loại sản phẩm",
      origin: "Nguồn gốc",
      serialized: "Theo dõi serial",
      unit: "Đơn vị tính",
      noCategory: "CATEGORY_CODE - Tên danh mục",
    },
    guideHeaders: { section: "Mục", guide: "Hướng dẫn" },
    guides: [
      {
        section: "QUAN TRỌNG",
        guide:
          "Vui lòng XÓA các hàng sản phẩm KHÔNG CẦN CHỈNH SỬA khỏi file trước khi tải lên để hệ thống xử lý nhanh và tránh sai sót.",
      },
      {
        section: "Mã ID & SKU",
        guide:
          "KHÔNG ĐƯỢC sửa cột ID và SKU. Hệ thống dựa vào đây để cập nhật.",
      },
      {
        section: "Danh mục",
        guide: "Chọn giá trị dạng 'Mã danh mục - Tên danh mục'.",
      },
    ],
    typeLabels: {
      [ProductType.EQUIPMENT]: "Thiết bị",
      [ProductType.SOUVENIR_SALE]: "Quà lưu niệm để bán",
      [ProductType.SOUVENIR_GIFT]: "Quà lưu niệm để tặng",
    },
    originLabels: {
      [ProductOrigin.DOMESTIC]: "Trong nước",
      [ProductOrigin.INTERNATIONAL]: "Nhập khẩu",
    },
    serializedLabels: {
      false: "Không theo dõi serial",
      true: "Theo dõi serial",
    },
    unitOptions: ["Cái", "Bộ", "Thùng", "Hộp", "Kg", "Mét"],
  },
  zh: {
    sheets: { products: "Chan_pin", guide: "Shuo_ming", refs: "Ke_xuan_zhi" },
    fileName: "product-mass-edit.xlsx",
    columns: {
      id: {
        label: "ID (不可修改) *",
        note: "必填。不可修改",
        width: 30,
        required: true,
      },
      category_code: {
        label: "产品分类 *",
        note: "必填",
        width: 36,
        required: true,
      },
      name: { label: "产品名称 *", note: "必填", width: 32, required: true },
      code: {
        label: "SKU/产品编码 (不可修改) *",
        note: "必填。不可修改",
        width: 22,
        required: true,
      },
      barcode: { label: "条形码", note: "选填", width: 22 },
      unit: { label: "单位 *", note: "必填", width: 16, required: true },
      product_type: {
        label: "产品类型 *",
        note: "必填",
        width: 28,
        required: true,
      },
      product_material: { label: "材质", note: "选填", width: 22 },
      product_origin: { label: "来源", note: "选填", width: 28 },
      hs_code: { label: "HS code", note: "选填", width: 22 },
      technical_specifications: { label: "技术特性", note: "选填", width: 36 },
      dimensions: { label: "尺寸", note: "选填", width: 22 },
      manufacturer: { label: "制造商", note: "选填", width: 28 },
      manufacturer_address: { label: "制造商地址", note: "选填", width: 36 },
      notes: { label: "注意事项", note: "选填", width: 30 },
      applicable_standard: { label: "适用标准", note: "选填", width: 28 },
      unit_price: { label: "单价", note: "选填", width: 18 },
      is_serialized: {
        label: "序列号管理 *",
        note: "必填",
        width: 28,
        required: true,
      },
      description: { label: "描述", note: "选填", width: 38 },
    },
    prompts: {
      title: "J-PULSE",
      invalidTitle: "无效值",
      invalidList: "请从下拉列表中选择一个值。",
      invalidUnitPrice: "单价必须是非负整数。",
      category: "请选择分类",
      unit: "请选择或输入单位",
      type: "请选择类型",
      origin: "请选择来源",
      serialized: "选择 true/false",
    },
    refs: {
      group: "分组",
      value: "值",
      meaning: "说明",
      category: "分类",
      productType: "类型",
      origin: "来源",
      serialized: "序列号管理",
      unit: "单位",
      noCategory: "NO_CAT - 无分类",
    },
    guideHeaders: { section: "项目", guide: "说明" },
    guides: [
      { section: "重要", guide: "请删除不需要修改的行，以免发生错误。" },
      { section: "ID和SKU", guide: "不要修改ID和SKU。" },
    ],
    typeLabels: {
      [ProductType.EQUIPMENT]: "设备",
      [ProductType.SOUVENIR_SALE]: "销售纪念品",
      [ProductType.SOUVENIR_GIFT]: "赠品纪念品",
    },
    originLabels: {
      [ProductOrigin.DOMESTIC]: "国内",
      [ProductOrigin.INTERNATIONAL]: "进口",
    },
    serializedLabels: { false: "不管理序列号", true: "管理序列号" },
    unitOptions: ["件", "套", "箱", "盒", "Kg", "米"],
  },
};

const PRODUCT_COLUMNS: ProductColumnKey[] = [
  "id",
  "category_code",
  "name",
  "code",
  "barcode",
  "unit",
  "product_type",
  "product_material",
  "product_origin",
  "hs_code",
  "technical_specifications",
  "dimensions",
  "manufacturer",
  "manufacturer_address",
  "notes",
  "applicable_standard",
  "unit_price",
  "is_serialized",
  "description",
];

export async function downloadProductMassEditTemplate(
  products: Product[],
  categories: ProductCategory[],
  language: TemplateLanguage = "vi",
) {
  const text = TEMPLATE_TEXT[language] || TEMPLATE_TEXT.vi;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "J-PULSE";
  workbook.created = new Date();

  const productSheet = workbook.addWorksheet(text.sheets.products, {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  const guideSheet = workbook.addWorksheet(text.sheets.guide);
  const refsSheet = workbook.addWorksheet(text.sheets.refs);

  productSheet.columns = PRODUCT_COLUMNS.map((key) => ({
    header: text.columns[key].label,
    key,
    width: text.columns[key].width,
  }));

  const categoryOptions = categories.map((c) => `${c.code} - ${c.name}`);
  if (categoryOptions.length === 0) categoryOptions.push(text.refs.noCategory);

  const typeOptions = Object.values(ProductType).map(
    (t) => `${t} - ${text.typeLabels[t]}`,
  );
  const originOptions = Object.values(ProductOrigin).map(
    (o) => `${o} - ${text.originLabels[o]}`,
  );
  const serializedOptions = ["false", "true"].map(
    (v) => `${v} - ${text.serializedLabels[v as "true" | "false"]}`,
  );
  const unitOptions = text.unitOptions;

  // Add references
  addReferenceGroup(refsSheet, text.refs.category, categoryOptions);
  addReferenceGroup(refsSheet, text.refs.productType, typeOptions);
  addReferenceGroup(refsSheet, text.refs.origin, originOptions);
  addReferenceGroup(refsSheet, text.refs.serialized, serializedOptions);
  addReferenceGroup(refsSheet, text.refs.unit, unitOptions);
  // (Simplified refs loading for space)

  const catCodeToLabel = new Map(
    categories.map((c) => [c.id, `${c.code} - ${c.name}`]),
  );

  // Fill current products
  for (const product of products) {
    productSheet.addRow({
      id: product.id,
      category_code:
        catCodeToLabel.get(product.category_id) || product.category_id,
      name: product.name,
      code: product.code,
      barcode: product.barcode || "",
      unit: product.unit,
      product_type: `${product.product_type} - ${text.typeLabels[product.product_type]}`,
      product_material: product.product_material || "",
      product_origin: product.product_origin
        ? `${product.product_origin} - ${text.originLabels[product.product_origin]}`
        : "",
      hs_code: product.hs_code || "",
      technical_specifications: product.technical_specifications || "",
      dimensions: product.dimensions || "",
      manufacturer: product.manufacturer || "",
      manufacturer_address: product.manufacturer_address || "",
      notes: product.notes || "",
      applicable_standard: product.applicable_standard || "",
      unit_price: product.unit_price || "",
      is_serialized: `${String(product.is_serialized)} - ${text.serializedLabels[String(product.is_serialized) as "true" | "false"]}`,
      description: product.description || "",
    });
  }

  // Styling
  const headerRow = productSheet.getRow(1);
  headerRow.height = 34;
  PRODUCT_COLUMNS.forEach((key, index) => {
    const columnText = text.columns[key];
    const cell = headerRow.getCell(index + 1);
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.alignment = {
      vertical: "middle",
      horizontal: "center",
      wrapText: true,
    };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: {
        argb:
          "required" in columnText && columnText.required
            ? "FFDC2626"
            : "FF2563EB",
      },
    };
    cell.border = thinBorder("FFCBD5E1");
    cell.note = columnText.note;
  });

  // Hide ID column
  productSheet.getColumn(1).hidden = true;
  // Protect Code column (SKU)
  const codeCol = productSheet.getColumn(4);
  codeCol.eachCell((cell) => {
    cell.protection = { locked: true };
  });

  // Protect ID column
  const idCol = productSheet.getColumn(1);
  idCol.eachCell((cell) => {
    cell.protection = { locked: true };
  });

  for (let r = 2; r <= products.length + 1; r++) {
    productSheet.getRow(r).eachCell((cell, colNum) => {
      cell.border = thinBorder("FFE2E8F0");
      cell.alignment = { vertical: "middle", wrapText: true };
      if (colNum !== 1 && colNum !== 4) {
        cell.protection = { locked: false };
      }
    });
  }

  // Basic sheet protection to prevent editing ID/SKU if possible
  await productSheet.protect("bduck", {
    selectLockedCells: true,
    selectUnlockedCells: true,
  });

  addGuideSheet(guideSheet, text);

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = text.fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function addReferenceGroup(
  sheet: ExcelJS.Worksheet,
  group: string,
  values: string[],
) {
  for (const value of values) {
    sheet.addRow({ group, value });
  }
}

function thinBorder(color: string): Partial<ExcelJS.Borders> {
  return {
    top: { style: "thin", color: { argb: color } },
    left: { style: "thin", color: { argb: color } },
    bottom: { style: "thin", color: { argb: color } },
    right: { style: "thin", color: { argb: color } },
  };
}

function addGuideSheet(sheet: ExcelJS.Worksheet, text: any) {
  sheet.columns = [
    { header: text.guideHeaders.section, key: "section", width: 28 },
    { header: text.guideHeaders.guide, key: "guide", width: 92 },
  ];
  sheet.addRows(text.guides);
  sheet.getRow(1).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF0F172A" },
    };
  });
}

const normalizeText = (value: unknown) =>
  String(value ?? "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
const normalizeKey = (value: unknown) =>
  normalizeText(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "_")
    .replace(/^_+|_+$/g, "");
const cleanCell = (value: unknown) => String(value ?? "").trim();
const extractOptionCode = (value: string) => value.split(" - ")[0].trim();
const normalizeIdentity = (value: string | null | undefined) =>
  normalizeText(value).toLowerCase();

const HEADER_ALIASES: Record<string, string> = {
  id: "id",
  category_code: "category_code",
  name: "name",
  code: "code",
  barcode: "barcode",
  unit: "unit",
  product_type: "product_type",
  product_material: "product_material",
  product_origin: "product_origin",
  hs_code: "hs_code",
  technical_specifications: "technical_specifications",
  dimensions: "dimensions",
  manufacturer: "manufacturer",
  manufacturer_address: "manufacturer_address",
  notes: "notes",
  applicable_standard: "applicable_standard",
  unit_price: "unit_price",
  is_serialized: "is_serialized",
  description: "description",
};

// Populate HEADER_ALIASES with normalized labels from all languages
for (const lang of Object.values(TEMPLATE_TEXT)) {
  for (const [key, colDef] of Object.entries(lang.columns)) {
    const label = colDef.label;
    const norm1 = normalizeKey(label);
    const norm2 = normalizeKey(label.split("(")[0]);
    HEADER_ALIASES[norm1] = key;
    HEADER_ALIASES[norm2] = key;
  }
}

export async function parseProductMassEditFile(
  file: File,
  categories: ProductCategory[],
  products: Product[],
): Promise<ProductMassEditPreviewRow[]> {
  const buffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet =
    workbook.getWorksheet(TEMPLATE_TEXT.vi.sheets.products) ??
    workbook.getWorksheet(TEMPLATE_TEXT.zh.sheets.products) ??
    workbook.worksheets[0];

  if (!sheet) throw new Error("Tệp Excel không có sheet dữ liệu.");

  const colToKey = new Map<number, string>();
  sheet.getRow(1).eachCell((cell, colNumber) => {
    const text = cleanCell(cell.text || cell.value);
    const norm1 = normalizeKey(text);
    const norm2 = normalizeKey(text.split("(")[0]);
    const mappedKey = HEADER_ALIASES[norm1] || HEADER_ALIASES[norm2];
    if (mappedKey) {
      colToKey.set(colNumber, mappedKey);
    }
  });

  // Fallback to strict index mapping if header mapping fails completely
  if (colToKey.size < 3) {
    PRODUCT_COLUMNS.forEach((key, index) => colToKey.set(index + 1, key));
  }

  const normalizedRows: {
    rowNumber: number;
    raw: Record<string, string>;
    rawValues: Record<string, any>;
  }[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const raw: Record<string, string> = {};
    const rawValues: Record<string, any> = {};
    colToKey.forEach((key, colNumber) => {
      const cell = row.getCell(colNumber);
      raw[key] = cleanCell(cell.text || cell.value);
      rawValues[key] = cell.type === 4 /* Formula */ ? cell.result : cell.value;
    });

    if (raw.id || raw.code) {
      normalizedRows.push({ rowNumber, raw, rawValues });
    }
  });

  const productById = new Map(products.map((p) => [p.id, p]));
  const categoryByCode = new Map(
    categories.map((c) => [normalizeIdentity(c.code), c]),
  );

  return normalizedRows.map(({ rowNumber, raw, rawValues }) => {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!raw.id) {
      errors.push("Thiếu ID sản phẩm. Không được xóa cột ID.");
    }
    const existingProduct = productById.get(raw.id);
    if (raw.id && !existingProduct) {
      errors.push(`Không tìm thấy sản phẩm có ID: ${raw.id} trong hệ thống.`);
    }

    if (existingProduct && existingProduct.code !== raw.code) {
      errors.push(
        `Cảnh báo: SKU đã bị thay đổi từ ${existingProduct.code} thành ${raw.code}. Việc sửa SKU không được phép.`,
      );
    }

    const categoryCode = extractOptionCode(raw.category_code || "");
    const category = categoryByCode.get(normalizeIdentity(categoryCode));
    const productType = extractOptionCode(
      raw.product_type || "",
    ) as ProductType;
    const productOrigin = extractOptionCode(
      raw.product_origin || "",
    ) as ProductOrigin;

    let parsedSerialized = null;
    const ser = normalizeKey(extractOptionCode(raw.is_serialized || ""));
    if (["true", "1", "yes", "co"].includes(ser)) parsedSerialized = true;
    else if (["false", "0", "no", "khong"].includes(ser))
      parsedSerialized = false;

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

    if (!raw.name) errors.push("Thiếu tên sản phẩm.");
    if (!raw.category_code || !category)
      errors.push(`Không tìm thấy danh mục hợp lệ.`);
    if (!raw.unit) errors.push("Thiếu đơn vị tính.");
    if (!Object.values(ProductType).includes(productType))
      errors.push(`product_type không hợp lệ.`);
    if (
      raw.product_origin &&
      !Object.values(ProductOrigin).includes(productOrigin)
    )
      errors.push("product_origin không hợp lệ.");
    if (parsedSerialized === null) errors.push("is_serialized không hợp lệ.");
    if (
      raw.unit_price &&
      (priceNumber === null || isNaN(priceNumber) || priceNumber < 0)
    )
      errors.push("unit_price phải là số không âm.");

    const payload =
      errors.length === 0 &&
      category &&
      existingProduct &&
      parsedSerialized !== null
        ? {
            id: raw.id,
            category_id: category.id,
            name: raw.name,
            code: existingProduct.code,
            barcode: raw.barcode || null,
            product_material: raw.product_material || null,
            product_origin: raw.product_origin ? productOrigin : null,
            hs_code: raw.hs_code || null,
            technical_specifications: raw.technical_specifications || null,
            dimensions: raw.dimensions || null,
            manufacturer: raw.manufacturer || null,
            manufacturer_address: raw.manufacturer_address || null,
            notes: raw.notes || null,
            applicable_standard: raw.applicable_standard || null,
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

export function summarizeProductMassEditRows(
  rows: ProductMassEditPreviewRow[],
): ProductMassEditSummary {
  return {
    totalRows: rows.length,
    validRows: rows.filter((row) => row.payload).length,
    errorRows: rows.filter((row) => row.errors.length > 0).length,
    warningRows: rows.filter((row) => row.warnings.length > 0).length,
  };
}
