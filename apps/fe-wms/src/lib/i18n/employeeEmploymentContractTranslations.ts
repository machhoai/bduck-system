const vi = {
  title: "Tạo hợp đồng chính thức",
  subtitle:
    "Bổ sung hợp đồng ngay trong lệnh chuyển trạng thái để hoàn tất hồ sơ trong một lần.",
  enable: "Thêm hợp đồng",
  currentContract: "Hợp đồng đang xung đột",
  cancel:
    "Hợp đồng {number} chưa hiệu lực và sẽ được hủy trước khi tạo hợp đồng mới.",
  terminate:
    "Hợp đồng {number} sẽ được chấm dứt ngày {date} trước khi hợp đồng mới có hiệu lực.",
  shorten:
    "Ngày kết thúc hợp đồng {number} sẽ được điều chỉnh thành {date} để không chồng lấn.",
  blocked:
    "Không thể tự động xử lý hợp đồng {number}. Hãy đổi ngày hiệu lực hoặc xử lý hợp đồng này trước.",
  missingLifecyclePermission:
    "Bạn thiếu quyền hủy/chấm dứt hợp đồng cũ nên chưa thể hoàn tất lệnh này.",
  loading: "Đang kiểm tra hợp đồng hiện có...",
  loadError: "Không thể kiểm tra hợp đồng hiện có.",
  partialFailure:
    "Lệnh chuyển trạng thái đã được tạo. Hãy thử lại để hoàn tất phần hợp đồng còn thiếu.",
  resolving: "Đang xử lý hợp đồng cũ và tạo hợp đồng chính thức...",
  invalidPdf: "File phải là PDF hợp lệ và không vượt quá 10MB.",
  invalidDate: "Ngày hợp đồng không hợp lệ hoặc khoảng thời gian không đúng.",
  required: "Vui lòng nhập đầy đủ thông tin hợp đồng bắt buộc.",
  reason:
    "Điều chỉnh hợp đồng khi chuyển trạng thái nhân viên từ thử việc lên chính thức.",
} as const;

type TranslationShape = { [Key in keyof typeof vi]: string };

const zh: TranslationShape = {
  title: "创建正式劳动合同",
  subtitle: "在状态转换指令中同时补充合同，一次完成员工档案。",
  enable: "添加合同",
  currentContract: "存在冲突的合同",
  cancel: "尚未生效的合同 {number} 将在创建新合同前取消。",
  terminate: "合同 {number} 将于 {date} 终止，之后新合同生效。",
  shorten: "合同 {number} 的结束日期将调整为 {date}，以避免日期重叠。",
  blocked: "无法自动处理合同 {number}。请修改生效日期或先处理该合同。",
  missingLifecyclePermission: "您没有取消或终止旧合同的权限，无法完成此操作。",
  loading: "正在检查现有合同...",
  loadError: "无法检查现有合同。",
  partialFailure: "状态转换指令已创建，请重试以完成剩余合同步骤。",
  resolving: "正在处理旧合同并创建正式合同...",
  invalidPdf: "文件必须是有效 PDF，且不得超过 10MB。",
  invalidDate: "合同日期无效或日期范围不正确。",
  required: "请填写所有必填的合同信息。",
  reason: "员工从试用期转为正式员工时调整劳动合同。",
};

export const employeeEmploymentContractTranslations = { vi, zh } as const;
