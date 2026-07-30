const vi = {
  title: "Tạo hợp đồng cùng hồ sơ",
  subtitle:
    "Hoàn thiện hồ sơ và hợp đồng trong một lần lưu. Bạn vẫn có thể bổ sung sau.",
  enable: "Thêm hợp đồng ngay",
  optional: "Không bắt buộc",
  pdfLabel: "File hợp đồng PDF",
  pdfHint: "Không bắt buộc, chỉ nhận PDF tối đa 10MB.",
  pdfSelected: "Đã chọn: {name}",
  invalidPdf: "File phải là PDF hợp lệ và không vượt quá 10MB.",
  invalidDate: "Ngày không hợp lệ hoặc khoảng thời gian không đúng.",
  required: "Vui lòng nhập đầy đủ thông tin hợp đồng bắt buộc.",
  partialFailure:
    "Hồ sơ đã được tạo. Hãy thử lại để tiếp tục bước hợp đồng còn thiếu.",
} as const;

type TranslationShape = {
  [Key in keyof typeof vi]: string;
};

const zh: TranslationShape = {
  title: "创建档案时添加合同",
  subtitle: "一次保存即可完成员工档案和合同，也可以稍后补充。",
  enable: "立即添加合同",
  optional: "可选",
  pdfLabel: "合同 PDF 文件",
  pdfHint: "可选，仅支持不超过 10MB 的 PDF。",
  pdfSelected: "已选择：{name}",
  invalidPdf: "文件必须是有效 PDF，且不得超过 10MB。",
  invalidDate: "日期无效或合同时间范围不正确。",
  required: "请填写所有必填的合同信息。",
  partialFailure: "员工档案已创建，请重试以继续完成剩余合同步骤。",
};

export const employeeInitialContractTranslations = { vi, zh } as const;
