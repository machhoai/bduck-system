import { ProductOrigin, ProductType } from "@bduck/shared-types";
import type { ProductCategory } from "@bduck/shared-types";
import ExcelJS from "exceljs";
import type { Language } from "@/lib/i18n";

type TemplateLanguage = Language;

type ProductColumnKey =
  | "category_code"
  | "name"
  | "code"
  | "barcode"
  | "unit"
  | "product_type"
  | "product_material"
  | "product_origin"
  | "unit_price"
  | "is_serialized"
  | "description";

type TemplateText = {
  sheets: {
    products: string;
    guide: string;
    refs: string;
  };
  fileName: string;
  columns: Record<
    ProductColumnKey,
    {
      label: string;
      note: string;
      width: number;
      required?: boolean;
    }
  >;
  sample: Record<ProductColumnKey, string | number>;
  prompts: {
    title: string;
    invalidTitle: string;
    invalidList: string;
    invalidUnitPrice: string;
    category: string;
    unit: string;
    type: string;
    origin: string;
    serialized: string;
  };
  refs: {
    group: string;
    value: string;
    meaning: string;
    category: string;
    productType: string;
    origin: string;
    serialized: string;
    unit: string;
    noCategory: string;
  };
  guideHeaders: {
    section: string;
    guide: string;
  };
  guides: Array<{ section: string; guide: string }>;
  typeLabels: Record<ProductType, string>;
  originLabels: Record<ProductOrigin, string>;
  serializedLabels: Record<"false" | "true", string>;
  unitOptions: string[];
};

const TEMPLATE_TEXT: Record<TemplateLanguage, TemplateText> = {
  vi: {
    sheets: {
      products: "San_pham",
      guide: "Huong_dan",
      refs: "Gia_tri_chon",
    },
    fileName: "mau-import-san-pham.xlsx",
    columns: {
      category_code: {
        label: "Danh mục sản phẩm *",
        note: "Bắt buộc. Chọn danh mục trong danh sách; hệ thống dùng mã trước dấu '-'.",
        width: 36,
        required: true,
      },
      name: {
        label: "Tên sản phẩm *",
        note: "Bắt buộc. Tên hiển thị của sản phẩm.",
        width: 32,
        required: true,
      },
      code: {
        label: "SKU/Mã sản phẩm *",
        note: "Bắt buộc và không được trùng trong hệ thống hoặc trong cùng file.",
        width: 22,
        required: true,
      },
      barcode: {
        label: "Barcode",
        note: "Không bắt buộc. Nếu nhập thì barcode phải là duy nhất.",
        width: 22,
      },
      unit: {
        label: "Đơn vị tính *",
        note: "Bắt buộc. Có thể chọn gợi ý hoặc nhập đơn vị khác.",
        width: 16,
        required: true,
      },
      product_type: {
        label: "Loại sản phẩm *",
        note: "Bắt buộc. Chọn theo danh sách ở sheet Gia_tri_chon.",
        width: 28,
        required: true,
      },
      product_material: {
        label: "Chất liệu",
        note: "Không bắt buộc. Ví dụ: Nhựa, kim loại, vải.",
        width: 22,
      },
      product_origin: {
        label: "Nguồn gốc",
        note: "Không bắt buộc. DOMESTIC là trong nước, INTERNATIONAL là nhập khẩu.",
        width: 28,
      },
      unit_price: {
        label: "Đơn giá",
        note: "Không bắt buộc. Nhập số nguyên không âm để làm đơn giá cơ sở.",
        width: 18,
      },
      is_serialized: {
        label: "Theo dõi serial *",
        note: "Bắt buộc. Chọn true nếu mỗi sản phẩm cần quản lý theo serial riêng.",
        width: 28,
        required: true,
      },
      description: {
        label: "Mô tả",
        note: "Không bắt buộc. Ghi chú nội bộ cho sản phẩm.",
        width: 38,
      },
    },
    sample: {
      category_code: "CATEGORY_CODE - Tên danh mục",
      name: "Tên sản phẩm mẫu",
      code: "SKU-001",
      barcode: "893000000001",
      unit: "Cái",
      product_type: "EQUIPMENT - Thiết bị",
      product_material: "Nhựa",
      product_origin: "DOMESTIC - Trong nước",
      unit_price: 10000,
      is_serialized: "false - Không theo dõi serial",
      description: "Mô tả tùy chọn",
    },
    prompts: {
      title: "BDuck WMS",
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
      value: "Giá trị chọn trong file",
      meaning: "Ý nghĩa",
      category: "Danh mục",
      productType: "Loại sản phẩm",
      origin: "Nguồn gốc",
      serialized: "Theo dõi serial",
      unit: "Đơn vị tính",
      noCategory: "CATEGORY_CODE - Tên danh mục",
    },
    guideHeaders: {
      section: "Mục",
      guide: "Hướng dẫn",
    },
    guides: [
      {
        section: "Cách nhập dữ liệu",
        guide:
          "Nhập từ dòng 2 trở xuống. Các cột có dấu * và nền đỏ là bắt buộc.",
      },
      {
        section: "Danh mục sản phẩm",
        guide:
          "Chọn giá trị dạng 'Mã danh mục - Tên danh mục'. Khi import, hệ thống chỉ dùng mã danh mục.",
      },
      {
        section: "SKU và barcode",
        guide:
          "SKU bắt buộc và phải duy nhất. Barcode không bắt buộc, nhưng nếu nhập thì cũng phải duy nhất.",
      },
      {
        section: "Loại sản phẩm",
        guide:
          "EQUIPMENT: thiết bị; SOUVENIR_SALE: quà lưu niệm để bán; SOUVENIR_GIFT: quà lưu niệm để tặng.",
      },
      {
        section: "Nguồn gốc",
        guide:
          "DOMESTIC: hàng trong nước. INTERNATIONAL: hàng nhập khẩu. Có thể để trống nếu chưa xác định.",
      },
      {
        section: "Theo dõi serial",
        guide:
          "false: quản lý theo số lượng thông thường. true: mỗi đơn vị có serial riêng và khó thay đổi sau khi tạo sản phẩm.",
      },
      {
        section: "Đơn giá",
        guide:
          "Nhập số nguyên không âm (ví dụ: 10000 cho 10,000đ); để trống nếu chưa có đơn giá.",
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
    sheets: {
      products: "Chan_pin",
      guide: "Shuo_ming",
      refs: "Ke_xuan_zhi",
    },
    fileName: "product-import-template.xlsx",
    columns: {
      category_code: {
        label: "产品分类 *",
        note: "必填。请选择分类，系统会使用 '-' 前面的分类编码。",
        width: 36,
        required: true,
      },
      name: {
        label: "产品名称 *",
        note: "必填。产品在系统中的显示名称。",
        width: 32,
        required: true,
      },
      code: {
        label: "SKU/产品编码 *",
        note: "必填。不能与系统内或本文件内其他产品重复。",
        width: 22,
        required: true,
      },
      barcode: {
        label: "条形码",
        note: "选填。如填写，条形码必须唯一。",
        width: 22,
      },
      unit: {
        label: "单位 *",
        note: "必填。可选择常用单位，也可以输入其他单位。",
        width: 16,
        required: true,
      },
      product_type: {
        label: "产品类型 *",
        note: "必填。请按业务含义选择。",
        width: 28,
        required: true,
      },
      product_material: {
        label: "材质",
        note: "选填。例如：塑料、金属、布料。",
        width: 22,
      },
      product_origin: {
        label: "来源",
        note: "选填。DOMESTIC 为国内，INTERNATIONAL 为进口。",
        width: 28,
      },
      unit_price: {
        label: "单价",
        note: "选填。请输入非负整数，作为基础单价。",
        width: 18,
      },
      is_serialized: {
        label: "序列号管理 *",
        note: "必填。每件商品需要单独序列号时选择 true。",
        width: 28,
        required: true,
      },
      description: {
        label: "描述",
        note: "选填。产品内部备注。",
        width: 38,
      },
    },
    sample: {
      category_code: "CATEGORY_CODE - 分类名称",
      name: "示例产品",
      code: "SKU-001",
      barcode: "893000000001",
      unit: "件",
      product_type: "EQUIPMENT - 设备",
      product_material: "塑料",
      product_origin: "DOMESTIC - 国内",
      unit_price: 10000,
      is_serialized: "false - 不管理序列号",
      description: "选填描述",
    },
    prompts: {
      title: "BDuck WMS",
      invalidTitle: "无效值",
      invalidList: "请从下拉列表中选择一个值。",
      invalidUnitPrice: "单价必须是非负整数。",
      category: "请选择分类。系统会读取 '-' 前面的分类编码。",
      unit: "请选择常用单位，或按需要输入其他单位。",
      type: "请选择产品类型。",
      origin: "如已知来源，请选择产品来源。",
      serialized: "每件产品需要单独序列号时请选择 true。",
    },
    refs: {
      group: "分组",
      value: "文件中可选择的值",
      meaning: "说明",
      category: "产品分类",
      productType: "产品类型",
      origin: "来源",
      serialized: "序列号管理",
      unit: "单位",
      noCategory: "CATEGORY_CODE - 分类名称",
    },
    guideHeaders: {
      section: "项目",
      guide: "说明",
    },
    guides: [
      {
        section: "填写方式",
        guide: "请从第 2 行开始填写。带 * 且红色表头的列为必填。",
      },
      {
        section: "产品分类",
        guide:
          "请选择 '分类编码 - 分类名称'。导入时系统只使用分类编码。",
      },
      {
        section: "SKU 与条形码",
        guide:
          "SKU 必填且必须唯一。条形码选填，如填写也必须唯一。",
      },
      {
        section: "产品类型",
        guide:
          "EQUIPMENT: 设备；SOUVENIR_SALE: 销售纪念品；SOUVENIR_GIFT: 赠品纪念品。",
      },
      {
        section: "来源",
        guide:
          "DOMESTIC: 国内。INTERNATIONAL: 进口。未知时可留空。",
      },
      {
        section: "序列号管理",
        guide:
          "false: 按数量管理。true: 每件单独管理序列号，产品创建后不建议更改。",
      },
      {
        section: "单价",
        guide:
          "请输入非负整数（例如：10000）；暂无单价时可留空。",
      },
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
    serializedLabels: {
      false: "不管理序列号",
      true: "管理序列号",
    },
    unitOptions: ["件", "套", "箱", "盒", "Kg", "米"],
  },
};

const PRODUCT_COLUMNS: ProductColumnKey[] = [
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
];

export async function downloadProductImportTemplate(
  categories: ProductCategory[],
  language: TemplateLanguage = "vi",
) {
  const text = TEMPLATE_TEXT[language];
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "BDuck WMS";
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

  const refs = buildTemplateRefs(categories, text);
  fillRefsSheet(refsSheet, refs, text);
  addSampleRow(productSheet, refs.categoryOptions[0] ?? text.refs.noCategory, text);
  styleProductSheet(productSheet, text);
  addProductSheetValidations(productSheet, {
    categoryCount: refs.categoryOptions.length,
    typeCount: refs.typeOptions.length,
    originCount: refs.originOptions.length,
    serializedCount: refs.serializedOptions.length,
    unitCount: refs.unitOptions.length,
    refsSheetName: text.sheets.refs,
    text,
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

function buildTemplateRefs(categories: ProductCategory[], text: TemplateText) {
  return {
    categoryOptions:
      categories.length > 0
        ? categories.map((category) => `${category.code} - ${category.name}`)
        : [text.refs.noCategory],
    typeOptions: Object.values(ProductType).map(
      (type) => `${type} - ${text.typeLabels[type]}`,
    ),
    originOptions: Object.values(ProductOrigin).map(
      (origin) => `${origin} - ${text.originLabels[origin]}`,
    ),
    serializedOptions: (["false", "true"] as const).map(
      (value) => `${value} - ${text.serializedLabels[value]}`,
    ),
    unitOptions: text.unitOptions,
  };
}

function addSampleRow(
  sheet: ExcelJS.Worksheet,
  categoryOption: string,
  text: TemplateText,
) {
  sheet.addRow({
    ...text.sample,
    category_code: categoryOption,
  });
}

function fillRefsSheet(
  sheet: ExcelJS.Worksheet,
  refs: ReturnType<typeof buildTemplateRefs>,
  text: TemplateText,
) {
  sheet.columns = [
    { header: text.refs.group, key: "group", width: 22 },
    { header: text.refs.value, key: "value", width: 44 },
    { header: text.refs.meaning, key: "meaning", width: 72 },
    { header: "_categories", key: "_categories", width: 1 },
    { header: "_types", key: "_types", width: 1 },
    { header: "_origins", key: "_origins", width: 1 },
    { header: "_serialized", key: "_serialized", width: 1 },
    { header: "_units", key: "_units", width: 1 },
  ];

  sheet.getRow(1).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF0F172A" },
    };
    cell.alignment = { vertical: "middle", horizontal: "center" };
  });

  addReferenceGroup(sheet, text.refs.category, refs.categoryOptions);
  addReferenceGroup(sheet, text.refs.productType, refs.typeOptions);
  addReferenceGroup(sheet, text.refs.origin, refs.originOptions);
  addReferenceGroup(sheet, text.refs.serialized, refs.serializedOptions);
  addReferenceGroup(sheet, text.refs.unit, refs.unitOptions);

  const maxRows = Math.max(
    refs.categoryOptions.length,
    refs.typeOptions.length,
    refs.originOptions.length,
    refs.serializedOptions.length,
    refs.unitOptions.length,
  );

  for (let rowIndex = 0; rowIndex < maxRows; rowIndex += 1) {
    const rowNumber = rowIndex + 2;
    sheet.getCell(rowNumber, 4).value = refs.categoryOptions[rowIndex] ?? "";
    sheet.getCell(rowNumber, 5).value = refs.typeOptions[rowIndex] ?? "";
    sheet.getCell(rowNumber, 6).value = refs.originOptions[rowIndex] ?? "";
    sheet.getCell(rowNumber, 7).value = refs.serializedOptions[rowIndex] ?? "";
    sheet.getCell(rowNumber, 8).value = refs.unitOptions[rowIndex] ?? "";
  }

  [4, 5, 6, 7, 8].forEach((columnNumber) => {
    sheet.getColumn(columnNumber).hidden = true;
  });

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    row.eachCell((cell) => {
      cell.alignment = { vertical: "top", wrapText: true };
      cell.border = thinBorder("FFE2E8F0");
    });
  });
}

function addReferenceGroup(
  sheet: ExcelJS.Worksheet,
  group: string,
  values: string[],
) {
  for (const value of values) {
    const [code, meaning] = splitOption(value);
    sheet.addRow({
      group,
      value,
      meaning: meaning || code,
    });
  }
}

function splitOption(value: string) {
  const [code, ...rest] = value.split(" - ");
  return [code.trim(), rest.join(" - ").trim()];
}

function styleProductSheet(sheet: ExcelJS.Worksheet, text: TemplateText) {
  const headerRow = sheet.getRow(1);
  headerRow.height = 34;
  PRODUCT_COLUMNS.forEach((key, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: {
        argb: text.columns[key].required ? "FFDC2626" : "FF2563EB",
      },
    };
    cell.border = thinBorder("FFCBD5E1");
    cell.note = text.columns[key].note;
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
  config: {
    categoryCount: number;
    typeCount: number;
    originCount: number;
    serializedCount: number;
    unitCount: number;
    refsSheetName: string;
    text: TemplateText;
  },
) {
  const refsName = quoteSheetName(config.refsSheetName);
  for (let rowNumber = 2; rowNumber <= 201; rowNumber += 1) {
    sheet.getCell(`A${rowNumber}`).dataValidation = listValidation(
      `${refsName}!$D$2:$D$${config.categoryCount + 1}`,
      config.text.prompts.category,
      config.text,
    );
    sheet.getCell(`E${rowNumber}`).dataValidation = listValidation(
      `${refsName}!$H$2:$H$${config.unitCount + 1}`,
      config.text.prompts.unit,
      config.text,
      true,
      false,
    );
    sheet.getCell(`F${rowNumber}`).dataValidation = listValidation(
      `${refsName}!$E$2:$E$${config.typeCount + 1}`,
      config.text.prompts.type,
      config.text,
    );
    sheet.getCell(`H${rowNumber}`).dataValidation = listValidation(
      `${refsName}!$F$2:$F$${config.originCount + 1}`,
      config.text.prompts.origin,
      config.text,
      true,
    );
    sheet.getCell(`I${rowNumber}`).dataValidation = {
      type: "whole",
      operator: "greaterThanOrEqual",
      formulae: [0],
      allowBlank: true,
      showErrorMessage: true,
      errorTitle: config.text.prompts.invalidTitle,
      error: config.text.prompts.invalidUnitPrice,
    };
    sheet.getCell(`J${rowNumber}`).dataValidation = listValidation(
      `${refsName}!$G$2:$G$${config.serializedCount + 1}`,
      config.text.prompts.serialized,
      config.text,
    );
  }
}

function quoteSheetName(sheetName: string) {
  return `'${sheetName.replace(/'/g, "''")}'`;
}

function listValidation(
  range: string,
  prompt: string,
  text: TemplateText,
  allowBlank = false,
  showErrorMessage = true,
): ExcelJS.DataValidation {
  return {
    type: "list",
    allowBlank,
    formulae: [range],
    showErrorMessage,
    showInputMessage: true,
    promptTitle: text.prompts.title,
    prompt,
    errorTitle: text.prompts.invalidTitle,
    error: text.prompts.invalidList,
  };
}

function addGuideSheet(sheet: ExcelJS.Worksheet, text: TemplateText) {
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
