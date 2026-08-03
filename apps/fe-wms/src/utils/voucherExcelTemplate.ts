import { LocationStatus } from "@bduck/shared-types";
import type { Product, WarehouseLocation } from "@bduck/shared-types";
import ExcelJS from "exceljs";
import type { Language } from "@/lib/i18n";

const TEMPLATE_ROW_COUNT = 200;

type VoucherTemplateColumnKey =
  | "sku"
  | "productName"
  | "quantity"
  | "unitPrice"
  | "location"
  | "destinationLocation"
  | "notes";

type VoucherTemplateText = {
  fileName: string;
  transferFileName: string;
  sheets: {
    data: string;
    guide: string;
    references: string;
  };
  workbookTitle: string;
  workbookSubject: string;
  sourceLocationLabel: string;
  sourceLocationNote: string;
  columns: Record<
    VoucherTemplateColumnKey,
    {
      label: string;
      note: string;
      width: number;
      required?: boolean;
      calculated?: boolean;
    }
  >;
  prompts: {
    title: string;
    invalidTitle: string;
    invalidList: string;
    chooseProduct: string;
    chooseLocation: string;
    chooseDestinationLocation: string;
    invalidQuantity: string;
    invalidUnitPrice: string;
  };
  guide: {
    title: string;
    subtitle: string;
    sectionHeader: string;
    instructionHeader: string;
    rows: Array<{ section: string; instruction: string }>;
    transferLocations: { section: string; instruction: string };
    legendTitle: string;
    required: string;
    editable: string;
    calculated: string;
    noProducts: string;
    noLocations: string;
    noDestinationLocations: string;
  };
  references: {
    productCode: string;
    productName: string;
    unit: string;
    unitPrice: string;
    locationCode: string;
    locationName: string;
    destinationLocationCode: string;
    destinationLocationName: string;
  };
};

const VOUCHER_TEMPLATE_TEXT: Record<Language, VoucherTemplateText> = {
  vi: {
    fileName: "mau-nhap-san-pham-vao-phieu.xlsx",
    transferFileName: "mau-san-pham-dieu-chuyen-kho.xlsx",
    sheets: {
      data: "Nhap_san_pham",
      guide: "Huong_dan",
      references: "Danh_muc",
    },
    workbookTitle: "Mẫu nhập sản phẩm vào phiếu",
    workbookSubject:
      "Mẫu Excel có danh sách chọn sản phẩm và vị trí kho dành cho chức năng thêm sản phẩm",
    sourceLocationLabel: "Vị trí nguồn *",
    sourceLocationNote:
      "Bắt buộc. Chọn mã vị trí lấy hàng đang hoạt động tại kho nguồn.",
    columns: {
      sku: {
        label: "SKU / Mã sản phẩm *",
        note: "Bắt buộc. Chọn mã sản phẩm trong danh sách; không nhập tên sản phẩm bằng tay.",
        width: 24,
        required: true,
      },
      productName: {
        label: "Tên sản phẩm *",
        note: "Bắt buộc nhưng được Excel tự động điền theo mã sản phẩm ở cột A. Không sửa công thức trong cột này.",
        width: 42,
        required: true,
        calculated: true,
      },
      quantity: {
        label: "Số lượng *",
        note: "Bắt buộc. Nhập số nguyên lớn hơn 0.",
        width: 16,
        required: true,
      },
      unitPrice: {
        label: "Đơn giá",
        note: "Không bắt buộc. Nhập số lớn hơn hoặc bằng 0.",
        width: 20,
      },
      location: {
        label: "Vị trí kho",
        note: "Không bắt buộc. Chọn mã vị trí đang hoạt động của kho hiện tại trong danh sách.",
        width: 24,
      },
      destinationLocation: {
        label: "Vị trí đích *",
        note: "Bắt buộc với điều chuyển kho. Chọn mã vị trí đang hoạt động tại kho đích.",
        width: 24,
        required: true,
      },
      notes: {
        label: "Ghi chú",
        note: "Không bắt buộc. Nhập nội dung ghi chú cho dòng sản phẩm.",
        width: 42,
      },
    },
    prompts: {
      title: "J-PULSE",
      invalidTitle: "Giá trị không hợp lệ",
      invalidList: "Vui lòng chọn một giá trị trong danh sách.",
      chooseProduct: "Chọn SKU / mã sản phẩm trong danh sách.",
      chooseLocation: "Chọn mã vị trí kho trong danh sách.",
      chooseDestinationLocation: "Chọn mã vị trí đích trong danh sách.",
      invalidQuantity: "Số lượng phải là số nguyên lớn hơn 0.",
      invalidUnitPrice: "Đơn giá phải là số lớn hơn hoặc bằng 0.",
    },
    guide: {
      title: "HƯỚNG DẪN NHẬP SẢN PHẨM TỪ EXCEL",
      subtitle:
        "File mẫu được tạo từ danh mục sản phẩm và vị trí kho mà bạn đang có quyền truy cập.",
      sectionHeader: "Mục",
      instructionHeader: "Hướng dẫn",
      rows: [
        {
          section: "Bắt đầu",
          instruction:
            "Nhập dữ liệu từ hàng 2 trong sheet Nhap_san_pham. Không đổi tên sheet hoặc xóa hàng tiêu đề.",
        },
        {
          section: "Cột bắt buộc",
          instruction:
            "Các cột có tiêu đề màu đỏ và dấu * là bắt buộc. Mỗi dòng phải có mã sản phẩm, tên sản phẩm tự động và số lượng.",
        },
        {
          section: "Chọn sản phẩm",
          instruction:
            "Tại cột SKU / Mã sản phẩm, mở danh sách và chọn mã. Excel sẽ tự động hiển thị tên sản phẩm ở cột kế bên.",
        },
        {
          section: "Tên sản phẩm",
          instruction:
            "Tên sản phẩm là cột công thức. Không nhập hoặc dán đè lên cột này; nếu tên chưa hiện, hãy bật chế độ tính toán tự động của Excel.",
        },
        {
          section: "Số lượng",
          instruction:
            "Nhập số nguyên lớn hơn 0. Excel sẽ cảnh báo nếu giá trị không hợp lệ.",
        },
        {
          section: "Đơn giá",
          instruction:
            "Có thể để trống. Nếu nhập, giá trị phải lớn hơn hoặc bằng 0.",
        },
        {
          section: "Vị trí kho",
          instruction:
            "Mở danh sách ở cột Vị trí kho và chọn mã vị trí. Danh sách chỉ gồm các vị trí đang hoạt động của kho được chọn khi tải mẫu.",
        },
        {
          section: "Tải lên hệ thống",
          instruction:
            "Lưu file dưới định dạng .xlsx, tải lên, chọn sheet Nhap_san_pham, đặt hàng bắt đầu là 2 và map các cột tương ứng.",
        },
        {
          section: "Sheet Danh_muc",
          instruction:
            "Sheet Danh_muc chứa dữ liệu nguồn cho các danh sách chọn và công thức. Không chỉnh sửa hoặc xóa dữ liệu trong sheet này.",
        },
      ],
      transferLocations: {
        section: "Vị trí điều chuyển",
        instruction:
          "Mỗi dòng điều chuyển phải chọn cả Vị trí nguồn và Vị trí đích. Hai danh sách được lấy lần lượt từ kho nguồn và kho đích đã chọn.",
      },
      legendTitle: "Chú giải màu",
      required: "Đỏ nhạt: ô thuộc cột bắt buộc",
      editable: "Vàng nhạt: ô có thể nhập hoặc chọn",
      calculated: "Xanh nhạt: ô do Excel tự động tính",
      noProducts:
        "Chưa có sản phẩm trong danh mục tại thời điểm tải file. Hãy tải lại mẫu sau khi danh mục sản phẩm được tải.",
      noLocations:
        "Chưa có vị trí kho đang hoạt động tại thời điểm tải file. Hãy chọn kho hoặc tạo vị trí rồi tải lại mẫu.",
      noDestinationLocations:
        "Chưa có vị trí đích đang hoạt động. Hãy chọn kho đích hoặc tạo vị trí rồi tải lại mẫu.",
    },
    references: {
      productCode: "SKU / Mã sản phẩm",
      productName: "Tên sản phẩm",
      unit: "Đơn vị tính",
      unitPrice: "Đơn giá tham khảo",
      locationCode: "Mã vị trí kho",
      locationName: "Tên vị trí kho",
      destinationLocationCode: "Mã vị trí đích",
      destinationLocationName: "Tên vị trí đích",
    },
  },
  zh: {
    fileName: "单据产品导入模板.xlsx",
    transferFileName: "仓库调拨产品导入模板.xlsx",
    sheets: {
      data: "产品导入",
      guide: "填写说明",
      references: "选项数据",
    },
    workbookTitle: "单据产品导入模板",
    workbookSubject: "用于添加产品的 Excel 模板，包含产品和库位下拉选项",
    sourceLocationLabel: "源库位 *",
    sourceLocationNote: "必填。请选择源仓库中启用的拣货库位编码。",
    columns: {
      sku: {
        label: "SKU / 产品编码 *",
        note: "必填。请从下拉列表中选择产品编码，无需手动输入产品名称。",
        width: 24,
        required: true,
      },
      productName: {
        label: "产品名称 *",
        note: "必填，但由 Excel 根据 A 列的产品编码自动填写。请勿修改本列公式。",
        width: 42,
        required: true,
        calculated: true,
      },
      quantity: {
        label: "数量 *",
        note: "必填。请输入大于 0 的整数。",
        width: 16,
        required: true,
      },
      unitPrice: {
        label: "单价",
        note: "选填。请输入大于或等于 0 的数字。",
        width: 20,
      },
      location: {
        label: "库位",
        note: "选填。请从下拉列表中选择当前仓库的启用库位编码。",
        width: 24,
      },
      destinationLocation: {
        label: "目标库位 *",
        note: "仓库调拨必填。请选择目标仓库中启用的库位编码。",
        width: 24,
        required: true,
      },
      notes: {
        label: "备注",
        note: "选填。填写该产品行的备注。",
        width: 42,
      },
    },
    prompts: {
      title: "J-PULSE",
      invalidTitle: "值无效",
      invalidList: "请从下拉列表中选择一个值。",
      chooseProduct: "请从列表中选择 SKU / 产品编码。",
      chooseLocation: "请从列表中选择库位编码。",
      chooseDestinationLocation: "请从列表中选择目标库位编码。",
      invalidQuantity: "数量必须是大于 0 的整数。",
      invalidUnitPrice: "单价必须是大于或等于 0 的数字。",
    },
    guide: {
      title: "EXCEL 产品导入填写说明",
      subtitle: "模板根据您当前有权访问的产品目录和仓库库位生成。",
      sectionHeader: "项目",
      instructionHeader: "说明",
      rows: [
        {
          section: "开始填写",
          instruction:
            "请从“产品导入”工作表第 2 行开始填写。请勿重命名工作表或删除标题行。",
        },
        {
          section: "必填列",
          instruction:
            "红色表头且带 * 的列为必填列。每行必须包含产品编码、自动生成的产品名称和数量。",
        },
        {
          section: "选择产品",
          instruction:
            "在“SKU / 产品编码”列中打开下拉列表并选择编码，Excel 会在下一列自动显示产品名称。",
        },
        {
          section: "产品名称",
          instruction:
            "产品名称列包含公式，请勿手动输入或粘贴覆盖。如果名称未显示，请启用 Excel 自动计算。",
        },
        {
          section: "数量",
          instruction: "请输入大于 0 的整数，值无效时 Excel 会显示警告。",
        },
        {
          section: "单价",
          instruction: "可留空；如填写，必须大于或等于 0。",
        },
        {
          section: "库位",
          instruction:
            "在“库位”列中选择库位编码。列表仅包含下载模板时所选仓库的启用库位。",
        },
        {
          section: "上传系统",
          instruction:
            "保存为 .xlsx 后上传，选择“产品导入”工作表，将起始行设为 2，并映射对应列。",
        },
        {
          section: "选项数据",
          instruction:
            "“选项数据”工作表保存下拉列表和公式的数据源，请勿修改或删除其中的数据。",
        },
      ],
      transferLocations: {
        section: "调拨库位",
        instruction:
          "每条调拨明细都必须选择源库位和目标库位。两个下拉列表分别来自所选的源仓库和目标仓库。",
      },
      legendTitle: "颜色说明",
      required: "浅红色：必填列单元格",
      editable: "浅黄色：可输入或选择的单元格",
      calculated: "浅蓝色：Excel 自动计算的单元格",
      noProducts: "下载时产品目录为空。产品目录加载完成后请重新下载模板。",
      noLocations: "下载时没有启用库位。请选择仓库或创建库位后重新下载模板。",
      noDestinationLocations:
        "目标仓库没有启用库位。请选择目标仓库或创建库位后重新下载模板。",
    },
    references: {
      productCode: "SKU / 产品编码",
      productName: "产品名称",
      unit: "单位",
      unitPrice: "参考单价",
      locationCode: "库位编码",
      locationName: "库位名称",
      destinationLocationCode: "目标库位编码",
      destinationLocationName: "目标库位名称",
    },
  },
};

const TEMPLATE_COLUMNS: VoucherTemplateColumnKey[] = [
  "sku",
  "productName",
  "quantity",
  "unitPrice",
  "location",
  "notes",
];

export interface VoucherExcelTemplateOptions {
  products: Product[];
  locations: WarehouseLocation[];
  destinationLocations?: WarehouseLocation[];
  language?: Language;
}

export function buildVoucherExcelTemplate({
  products,
  locations,
  destinationLocations,
  language = "vi",
}: VoucherExcelTemplateOptions): ExcelJS.Workbook {
  const text = VOUCHER_TEMPLATE_TEXT[language];
  const availableProducts = uniqueByCode(
    products.filter((product) => !product.is_deleted && product.code.trim()),
  ).sort((left, right) => left.code.localeCompare(right.code));
  const availableLocations = uniqueByCode(
    locations.filter(
      (location) =>
        !location.is_deleted &&
        location.status === LocationStatus.ACTIVE &&
        location.code.trim(),
    ),
  ).sort((left, right) => left.code.localeCompare(right.code));
  const availableDestinationLocations = destinationLocations
    ? uniqueByCode(
        destinationLocations.filter(
          (location) =>
            !location.is_deleted &&
            location.status === LocationStatus.ACTIVE &&
            location.code.trim(),
        ),
      ).sort((left, right) => left.code.localeCompare(right.code))
    : undefined;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "J-PULSE";
  workbook.company = "J-PULSE";
  workbook.title = text.workbookTitle;
  workbook.subject = text.workbookSubject;
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.calcProperties.fullCalcOnLoad = true;

  const dataSheet = workbook.addWorksheet(text.sheets.data, {
    properties: { tabColor: { argb: "FF2563EB" } },
    views: [{ state: "frozen", ySplit: 1 }],
  });
  const guideSheet = workbook.addWorksheet(text.sheets.guide, {
    properties: { tabColor: { argb: "FF16A34A" } },
  });
  const referenceSheet = workbook.addWorksheet(text.sheets.references, {
    properties: { tabColor: { argb: "FF64748B" } },
    views: [{ state: "frozen", ySplit: 1 }],
  });

  fillReferenceSheet(
    referenceSheet,
    availableProducts,
    availableLocations,
    availableDestinationLocations,
    text,
  );
  addDefinedNames(
    workbook,
    referenceSheet,
    availableProducts.length,
    availableLocations.length,
    availableDestinationLocations?.length,
  );
  fillDataSheet(
    dataSheet,
    referenceSheet,
    availableProducts.length,
    availableLocations.length,
    availableDestinationLocations?.length,
    text,
  );
  fillGuideSheet(
    guideSheet,
    availableProducts.length,
    availableLocations.length,
    availableDestinationLocations?.length,
    text,
  );

  return workbook;
}

export async function downloadVoucherExcelTemplate(
  options: VoucherExcelTemplateOptions,
) {
  const language = options.language ?? "vi";
  const workbook = buildVoucherExcelTemplate(options);
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = options.destinationLocations
    ? VOUCHER_TEMPLATE_TEXT[language].transferFileName
    : VOUCHER_TEMPLATE_TEXT[language].fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function uniqueByCode<T extends { code: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const normalizedCode = item.code.trim().toLocaleLowerCase();
    if (seen.has(normalizedCode)) return false;
    seen.add(normalizedCode);
    return true;
  });
}

function fillReferenceSheet(
  sheet: ExcelJS.Worksheet,
  products: Product[],
  locations: WarehouseLocation[],
  destinationLocations: WarehouseLocation[] | undefined,
  text: VoucherTemplateText,
) {
  sheet.columns = [
    { header: text.references.productCode, key: "productCode", width: 24 },
    { header: text.references.productName, key: "productName", width: 42 },
    { header: text.references.unit, key: "unit", width: 18 },
    { header: text.references.unitPrice, key: "unitPrice", width: 20 },
    { header: text.references.locationCode, key: "locationCode", width: 24 },
    { header: text.references.locationName, key: "locationName", width: 36 },
    ...(destinationLocations
      ? [
          {
            header: text.references.destinationLocationCode,
            key: "destinationLocationCode",
            width: 24,
          },
          {
            header: text.references.destinationLocationName,
            key: "destinationLocationName",
            width: 36,
          },
        ]
      : []),
  ];

  const maxRows = Math.max(
    products.length,
    locations.length,
    destinationLocations?.length ?? 0,
    1,
  );
  for (let index = 0; index < maxRows; index += 1) {
    const product = products[index];
    const location = locations[index];
    const destinationLocation = destinationLocations?.[index];
    sheet.addRow({
      productCode: product?.code ?? null,
      productName: product?.name ?? null,
      unit: product?.unit ?? null,
      unitPrice: product?.unit_price ?? null,
      locationCode: location?.code ?? null,
      locationName: location?.name ?? null,
      destinationLocationCode: destinationLocation?.code ?? null,
      destinationLocationName: destinationLocation?.name ?? null,
    });
  }

  styleHeaderRow(sheet.getRow(1), "FF334155");
  sheet.getColumn("A").numFmt = "@";
  sheet.getColumn("D").numFmt = "#,##0.00";
  sheet.getColumn("E").numFmt = "@";
  if (destinationLocations) sheet.getColumn("G").numFmt = "@";
  sheet.autoFilter = { from: "A1", to: destinationLocations ? "H1" : "F1" };

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    row.height = 22;
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.alignment = { vertical: "middle", wrapText: true };
      cell.border = thinBorder("FFE2E8F0");
    });
  });
}

function addDefinedNames(
  workbook: ExcelJS.Workbook,
  referenceSheet: ExcelJS.Worksheet,
  productCount: number,
  locationCount: number,
  destinationLocationCount: number | undefined,
) {
  const quotedSheet = quoteSheetName(referenceSheet.name);
  const productEndRow = Math.max(2, productCount + 1);
  const locationEndRow = Math.max(2, locationCount + 1);

  workbook.definedNames.add(
    `${quotedSheet}!$A$2:$A$${productEndRow}`,
    "VoucherProductCodes",
  );
  workbook.definedNames.add(
    `${quotedSheet}!$E$2:$E$${locationEndRow}`,
    "VoucherLocationCodes",
  );
  if (destinationLocationCount !== undefined) {
    const destinationLocationEndRow = Math.max(2, destinationLocationCount + 1);
    workbook.definedNames.add(
      `${quotedSheet}!$G$2:$G$${destinationLocationEndRow}`,
      "VoucherDestinationLocationCodes",
    );
  }
}

function fillDataSheet(
  sheet: ExcelJS.Worksheet,
  referenceSheet: ExcelJS.Worksheet,
  productCount: number,
  locationCount: number,
  destinationLocationCount: number | undefined,
  text: VoucherTemplateText,
) {
  const isTransferTemplate = destinationLocationCount !== undefined;
  const templateColumns: VoucherTemplateColumnKey[] = isTransferTemplate
    ? ["sku", "productName", "quantity", "unitPrice", "location", "destinationLocation", "notes"]
    : TEMPLATE_COLUMNS;

  sheet.columns = templateColumns.map((key) => ({
    header:
      isTransferTemplate && key === "location"
        ? text.sourceLocationLabel
        : text.columns[key].label,
    key,
    width: text.columns[key].width,
  }));

  const headerRow = sheet.getRow(1);
  headerRow.height = 36;
  templateColumns.forEach((key, index) => {
    const cell = headerRow.getCell(index + 1);
    const column = text.columns[key];
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    const isRequired =
      column.required || (isTransferTemplate && key === "location");
    cell.fill = solidFill(isRequired ? "FFDC2626" : "FF2563EB");
    cell.alignment = {
      horizontal: "center",
      vertical: "middle",
      wrapText: true,
    };
    cell.border = thinBorder("FFCBD5E1");
    cell.note =
      isTransferTemplate && key === "location"
        ? text.sourceLocationNote
        : column.note;
  });

  const quotedReferenceSheet = quoteSheetName(referenceSheet.name);
  const productEndRow = Math.max(2, productCount + 1);

  for (let rowNumber = 2; rowNumber <= TEMPLATE_ROW_COUNT + 1; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    row.height = 23;

    const cellFor = (key: VoucherTemplateColumnKey) =>
      row.getCell(templateColumns.indexOf(key) + 1);
    const skuCell = cellFor("sku");
    const productNameCell = cellFor("productName");
    const quantityCell = cellFor("quantity");
    const unitPriceCell = cellFor("unitPrice");
    const locationCell = cellFor("location");
    const destinationLocationCell = isTransferTemplate
      ? cellFor("destinationLocation")
      : null;
    const notesCell = cellFor("notes");

    productNameCell.value = {
      formula:
        `IF(A${rowNumber}="","",IFERROR(INDEX(` +
        `${quotedReferenceSheet}!$B$2:$B$${productEndRow},` +
        `MATCH(A${rowNumber},${quotedReferenceSheet}!$A$2:$A$${productEndRow},0)),""))`,
      result: "",
    };

    skuCell.dataValidation = listValidation(
      "VoucherProductCodes",
      text.prompts.chooseProduct,
      text,
      false,
      productCount > 0,
    );
    quantityCell.dataValidation = {
      type: "whole",
      operator: "between",
      formulae: [1, 999999999],
      allowBlank: false,
      showErrorMessage: true,
      showInputMessage: true,
      promptTitle: text.prompts.title,
      prompt: text.prompts.invalidQuantity,
      errorTitle: text.prompts.invalidTitle,
      error: text.prompts.invalidQuantity,
    };
    unitPriceCell.dataValidation = {
      type: "decimal",
      operator: "greaterThanOrEqual",
      formulae: [0],
      allowBlank: true,
      showErrorMessage: true,
      showInputMessage: true,
      promptTitle: text.prompts.title,
      prompt: text.prompts.invalidUnitPrice,
      errorTitle: text.prompts.invalidTitle,
      error: text.prompts.invalidUnitPrice,
    };
    locationCell.dataValidation = listValidation(
      "VoucherLocationCodes",
      text.prompts.chooseLocation,
      text,
      !isTransferTemplate,
      locationCount > 0,
    );
    if (destinationLocationCell) {
      destinationLocationCell.dataValidation = listValidation(
        "VoucherDestinationLocationCodes",
        text.prompts.chooseDestinationLocation,
        text,
        false,
        (destinationLocationCount ?? 0) > 0,
      );
    }

    [
      skuCell,
      productNameCell,
      quantityCell,
      unitPriceCell,
      locationCell,
      ...(destinationLocationCell ? [destinationLocationCell] : []),
      notesCell,
    ].forEach((cell) => {
      cell.alignment = { vertical: "middle", wrapText: true };
      cell.border = thinBorder("FFE2E8F0");
    });

    skuCell.fill = solidFill("FFFFE4E6");
    productNameCell.fill = solidFill("FFEFF6FF");
    quantityCell.fill = solidFill("FFFFE4E6");
    unitPriceCell.fill = solidFill("FFFFFBEB");
    locationCell.fill = solidFill("FFFFFBEB");
    if (destinationLocationCell) {
      destinationLocationCell.fill = solidFill("FFFFE4E6");
    }
    notesCell.fill = solidFill("FFFFFBEB");
  }

  sheet.getColumn(1).numFmt = "@";
  sheet.getColumn(3).numFmt = "#,##0";
  sheet.getColumn(4).numFmt = "#,##0.00";
  sheet.getColumn(templateColumns.indexOf("location") + 1).numFmt = "@";
  if (isTransferTemplate) {
    sheet.getColumn(templateColumns.indexOf("destinationLocation") + 1).numFmt = "@";
  }
  sheet.autoFilter = { from: "A1", to: isTransferTemplate ? "G1" : "F1" };
  sheet.pageSetup = {
    orientation: "landscape",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    paperSize: 9,
  };
  sheet.headerFooter.oddFooter = "&LJ-PULSE&C&P / &N&R&D";
}

function fillGuideSheet(
  sheet: ExcelJS.Worksheet,
  productCount: number,
  locationCount: number,
  destinationLocationCount: number | undefined,
  text: VoucherTemplateText,
) {
  sheet.columns = [{ width: 28 }, { width: 96 }];
  sheet.mergeCells("A1:B1");
  sheet.getCell("A1").value = text.guide.title;
  sheet.getCell("A1").font = {
    bold: true,
    size: 16,
    color: { argb: "FFFFFFFF" },
  };
  sheet.getCell("A1").fill = solidFill("FF0F172A");
  sheet.getCell("A1").alignment = {
    horizontal: "center",
    vertical: "middle",
  };
  sheet.getRow(1).height = 34;

  sheet.mergeCells("A2:B2");
  sheet.getCell("A2").value = text.guide.subtitle;
  sheet.getCell("A2").font = { italic: true, color: { argb: "FF475569" } };
  sheet.getCell("A2").alignment = { vertical: "middle", wrapText: true };
  sheet.getRow(2).height = 30;

  sheet.getCell("A4").value = text.guide.sectionHeader;
  sheet.getCell("B4").value = text.guide.instructionHeader;
  styleHeaderRow(sheet.getRow(4), "FF2563EB");

  const guideRows =
    destinationLocationCount === undefined
      ? text.guide.rows
      : [...text.guide.rows, text.guide.transferLocations];
  guideRows.forEach((guideRow, index) => {
    const rowNumber = index + 5;
    const row = sheet.getRow(rowNumber);
    row.getCell(1).value = guideRow.section;
    row.getCell(2).value = guideRow.instruction;
    row.getCell(1).font = { bold: true, color: { argb: "FF1E293B" } };
    row.eachCell((cell) => {
      cell.alignment = { vertical: "top", wrapText: true };
      cell.border = thinBorder("FFE2E8F0");
    });
    row.height = 42;
  });

  let nextRow = guideRows.length + 6;
  if (productCount === 0) {
    addWarningRow(sheet, nextRow, text.guide.noProducts);
    nextRow += 1;
  }
  if (locationCount === 0) {
    addWarningRow(sheet, nextRow, text.guide.noLocations);
    nextRow += 1;
  }
  if (destinationLocationCount === 0) {
    addWarningRow(sheet, nextRow, text.guide.noDestinationLocations);
    nextRow += 1;
  }

  sheet.mergeCells(`A${nextRow}:B${nextRow}`);
  const legendTitleCell = sheet.getCell(`A${nextRow}`);
  legendTitleCell.value = text.guide.legendTitle;
  legendTitleCell.font = { bold: true, color: { argb: "FFFFFFFF" } };
  legendTitleCell.fill = solidFill("FF334155");
  legendTitleCell.alignment = { vertical: "middle" };

  const legendRows = [
    { label: text.guide.required, color: "FFFFE4E6" },
    { label: text.guide.editable, color: "FFFFFBEB" },
    { label: text.guide.calculated, color: "FFEFF6FF" },
  ];
  legendRows.forEach((legend, index) => {
    const row = sheet.getRow(nextRow + index + 1);
    row.getCell(1).value = "●";
    row.getCell(1).font = { color: { argb: legend.color } };
    row.getCell(1).fill = solidFill(legend.color);
    row.getCell(2).value = legend.label;
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.border = thinBorder("FFE2E8F0");
      cell.alignment = { vertical: "middle", wrapText: true };
    });
    row.height = 24;
  });

  sheet.views = [{ state: "frozen", ySplit: 4 }];
  sheet.pageSetup = {
    orientation: "portrait",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 1,
    paperSize: 9,
  };
}

function addWarningRow(
  sheet: ExcelJS.Worksheet,
  rowNumber: number,
  message: string,
) {
  sheet.mergeCells(`A${rowNumber}:B${rowNumber}`);
  const cell = sheet.getCell(`A${rowNumber}`);
  cell.value = `⚠ ${message}`;
  cell.font = { bold: true, color: { argb: "FF92400E" } };
  cell.fill = solidFill("FFFEF3C7");
  cell.alignment = { vertical: "middle", wrapText: true };
  cell.border = thinBorder("FFF59E0B");
  sheet.getRow(rowNumber).height = 34;
}

function listValidation(
  rangeName: string,
  prompt: string,
  text: VoucherTemplateText,
  allowBlank: boolean,
  showErrorMessage: boolean,
): ExcelJS.DataValidation {
  return {
    type: "list",
    allowBlank,
    formulae: [rangeName],
    showErrorMessage,
    showInputMessage: true,
    promptTitle: text.prompts.title,
    prompt,
    errorTitle: text.prompts.invalidTitle,
    error: text.prompts.invalidList,
  };
}

function styleHeaderRow(row: ExcelJS.Row, fillColor: string) {
  row.height = 30;
  row.eachCell({ includeEmpty: true }, (cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = solidFill(fillColor);
    cell.alignment = {
      horizontal: "center",
      vertical: "middle",
      wrapText: true,
    };
    cell.border = thinBorder("FFCBD5E1");
  });
}

function solidFill(argb: string): ExcelJS.Fill {
  return {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb },
  };
}

function thinBorder(argb: string): Partial<ExcelJS.Borders> {
  const side: Partial<ExcelJS.Border> = {
    style: "thin",
    color: { argb },
  };
  return {
    top: side,
    left: side,
    bottom: side,
    right: side,
  };
}

function quoteSheetName(sheetName: string) {
  return `'${sheetName.replace(/'/g, "''")}'`;
}
