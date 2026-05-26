import { ProductOrigin, ProductType } from "@bduck/shared-types";
import type { ProductCategory } from "@bduck/shared-types";
import ExcelJS from "exceljs";

export async function downloadProductImportTemplate(categories: ProductCategory[]) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "BDuck WMS";
  workbook.created = new Date();

  const productSheet = workbook.addWorksheet("products", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  const guideSheet = workbook.addWorksheet("Huong_dan");
  const refsSheet = workbook.addWorksheet("refs");

  productSheet.columns = [
    { header: "category_code", key: "category_code", width: 34 },
    { header: "name", key: "name", width: 32 },
    { header: "code", key: "code", width: 20 },
    { header: "barcode", key: "barcode", width: 22 },
    { header: "unit", key: "unit", width: 14 },
    { header: "product_type", key: "product_type", width: 22 },
    { header: "product_material", key: "product_material", width: 20 },
    { header: "product_origin", key: "product_origin", width: 18 },
    { header: "min_stock_threshold", key: "min_stock_threshold", width: 20 },
    { header: "is_serialized", key: "is_serialized", width: 16 },
    { header: "description", key: "description", width: 36 },
  ];

  const refs = buildTemplateRefs(categories);
  fillRefsSheet(refsSheet, refs);
  addSampleRow(productSheet, refs.categoryOptions[0]);
  styleProductSheet(productSheet);
  addProductSheetValidations(productSheet, {
    categoryCount: refs.categoryOptions.length,
    typeCount: refs.typeOptions.length,
    originCount: refs.originOptions.length,
    serializedCount: refs.serializedOptions.length,
    unitCount: refs.unitOptions.length,
  });
  addGuideSheet(guideSheet);
  refsSheet.state = "veryHidden";

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "product-import-template.xlsx";
  link.click();
  URL.revokeObjectURL(url);
}

function buildTemplateRefs(categories: ProductCategory[]) {
  return {
    categoryOptions:
      categories.length > 0
        ? categories.map((category) => `${category.code} - ${category.name}`)
        : ["CATEGORY_CODE - Tên danh mục"],
    typeOptions: Object.values(ProductType),
    originOptions: Object.values(ProductOrigin),
    serializedOptions: ["false", "true"],
    unitOptions: ["Cái", "Bộ", "Thùng", "Hộp", "Kg", "Mét"],
  };
}

function addSampleRow(sheet: ExcelJS.Worksheet, categoryOption: string) {
  sheet.addRow({
    category_code: categoryOption,
    name: "Tên sản phẩm mẫu",
    code: "SKU-001",
    barcode: "893000000001",
    unit: "Cái",
    product_type: ProductType.EQUIPMENT,
    product_material: "Nhựa",
    product_origin: ProductOrigin.DOMESTIC,
    min_stock_threshold: 5,
    is_serialized: "false",
    description: "Mô tả tùy chọn",
  });
}

function fillRefsSheet(
  sheet: ExcelJS.Worksheet,
  refs: ReturnType<typeof buildTemplateRefs>,
) {
  const headers = ["categories", "product_types", "origins", "serialized", "units"];
  sheet.addRow(headers);
  headers.forEach((_, index) => {
    const cell = sheet.getCell(1, index + 1);
    cell.font = { bold: true };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE8F0FE" },
    };
  });

  const maxRows = Math.max(
    refs.categoryOptions.length,
    refs.typeOptions.length,
    refs.originOptions.length,
    refs.serializedOptions.length,
    refs.unitOptions.length,
  );

  for (let rowIndex = 0; rowIndex < maxRows; rowIndex += 1) {
    sheet.addRow([
      refs.categoryOptions[rowIndex] ?? "",
      refs.typeOptions[rowIndex] ?? "",
      refs.originOptions[rowIndex] ?? "",
      refs.serializedOptions[rowIndex] ?? "",
      refs.unitOptions[rowIndex] ?? "",
    ]);
  }
}

function styleProductSheet(sheet: ExcelJS.Worksheet) {
  const headerRow = sheet.getRow(1);
  headerRow.height = 26;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF2563EB" },
    };
    cell.border = thinBorder("FFCBD5E1");
  });

  [1, 2, 3, 5, 6, 10].forEach((colNumber) => {
    sheet.getCell(1, colNumber).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFDC2626" },
    };
  });

  for (let rowNumber = 2; rowNumber <= 201; rowNumber += 1) {
    sheet.getRow(rowNumber).eachCell({ includeEmpty: true }, (cell) => {
      cell.border = thinBorder("FFE2E8F0");
      cell.alignment = { vertical: "middle", wrapText: true };
    });
  }

  sheet.autoFilter = { from: "A1", to: "K1" };
}

function addProductSheetValidations(
  sheet: ExcelJS.Worksheet,
  counts: {
    categoryCount: number;
    typeCount: number;
    originCount: number;
    serializedCount: number;
    unitCount: number;
  },
) {
  for (let rowNumber = 2; rowNumber <= 201; rowNumber += 1) {
    sheet.getCell(`A${rowNumber}`).dataValidation = listValidation(
      `refs!$A$2:$A$${counts.categoryCount + 1}`,
      "Chọn danh mục từ danh sách.",
    );
    sheet.getCell(`E${rowNumber}`).dataValidation = listValidation(
      `refs!$E$2:$E$${counts.unitCount + 1}`,
      "Chọn đơn vị phổ biến hoặc nhập giá trị khác nếu cần.",
      true,
      false,
    );
    sheet.getCell(`F${rowNumber}`).dataValidation = listValidation(
      `refs!$B$2:$B$${counts.typeCount + 1}`,
      "Chọn đúng loại sản phẩm.",
    );
    sheet.getCell(`H${rowNumber}`).dataValidation = listValidation(
      `refs!$C$2:$C$${counts.originCount + 1}`,
      "Chọn nguồn gốc sản phẩm.",
      true,
    );
    sheet.getCell(`I${rowNumber}`).dataValidation = {
      type: "whole",
      operator: "greaterThanOrEqual",
      formulae: [0],
      allowBlank: true,
      showErrorMessage: true,
      errorTitle: "Giá trị không hợp lệ",
      error: "Tồn tối thiểu phải là số nguyên không âm.",
    };
    sheet.getCell(`J${rowNumber}`).dataValidation = listValidation(
      `refs!$D$2:$D$${counts.serializedCount + 1}`,
      "Chọn true nếu sản phẩm theo dõi serial.",
    );
  }
}

function listValidation(
  range: string,
  prompt: string,
  allowBlank = false,
  showErrorMessage = true,
): ExcelJS.DataValidation {
  return {
    type: "list",
    allowBlank,
    formulae: [range],
    showErrorMessage,
    showInputMessage: true,
    promptTitle: "BDuck WMS",
    prompt,
    errorTitle: "Giá trị không hợp lệ",
    error: "Vui lòng chọn một giá trị trong danh sách.",
  };
}

function addGuideSheet(sheet: ExcelJS.Worksheet) {
  sheet.columns = [
    { header: "Mục", key: "section", width: 28 },
    { header: "Hướng dẫn", key: "guide", width: 86 },
  ];

  sheet.addRows([
    {
      section: "Cột màu đỏ",
      guide: "Bắt buộc nhập: category_code, name, code, unit, product_type, is_serialized.",
    },
    {
      section: "Danh mục",
      guide: "Chọn trong dropdown ở cột category_code. File hiển thị cả mã và tên để tránh phải tra cứu thủ công.",
    },
    {
      section: "SKU và Barcode",
      guide: "SKU bắt buộc và phải duy nhất. Barcode không bắt buộc nhưng nếu nhập thì cũng phải duy nhất.",
    },
    { section: "product_type", guide: Object.values(ProductType).join(", ") },
    { section: "product_origin", guide: Object.values(ProductOrigin).join(", ") },
    {
      section: "is_serialized",
      guide: "Chọn false hoặc true. Trường này không thể đổi sau khi sản phẩm đã được tạo.",
    },
    {
      section: "min_stock_threshold",
      guide: "Nhập số nguyên không âm hoặc để trống nếu chưa cấu hình tồn tối thiểu.",
    },
  ]);

  sheet.getRow(1).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF0F172A" },
    };
    cell.alignment = { vertical: "middle", horizontal: "center" };
  });

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    row.eachCell((cell) => {
      cell.alignment = { vertical: "top", wrapText: true };
      cell.border = thinBorder("FFE2E8F0");
    });
  });
}

function thinBorder(color: string): Partial<ExcelJS.Borders> {
  return {
    top: { style: "thin", color: { argb: color } },
    left: { style: "thin", color: { argb: color } },
    bottom: { style: "thin", color: { argb: color } },
    right: { style: "thin", color: { argb: color } },
  };
}
