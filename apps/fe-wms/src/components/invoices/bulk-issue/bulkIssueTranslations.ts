export const bulkIssueTranslations = {
  vi: {
    title: "Xuất hóa đơn hàng loạt",
    selectedOrdersCount: (count: number) => `${count} đơn đã chọn`,
    eligibleOrdersCount: (count: number) =>
      `${count} đơn có thể kiểm tra trong ngày`,
    issueSelectedBtn: "Xuất các đơn đã chọn",
    issueAllBtn: "Xuất tất cả trong ngày",
    calculating: "Đang tính tổng…",
    retry: "Thử lại",
    noEligibleInvoices:
      "Không có hóa đơn đủ điều kiện. Hãy kiểm tra cấu hình go-live và lỗi dữ liệu.",
    noEligibleInvoicesTitle: "Không có hóa đơn có thể xuất",
    previewErrorTitle: "Không thể kiểm tra đợt xuất",
    previewErrorFallback: "Không thể xem trước đợt xuất hóa đơn.",
    queuingInvoices: "Đang đưa hóa đơn vào hàng đợi…",
    startIssueSuccess: "Đã bắt đầu xuất hóa đơn",
    startIssueError: "Không thể bắt đầu xuất",
    startIssueSuccessDesc:
      "Tiến trình MISA sẽ được cập nhật trực tiếp bên dưới.",
    issueErrorFallback: "Không thể khởi tạo tiến trình xuất hóa đơn.",
    otpTitle: "Xác thực xuất hóa đơn hàng loạt",
    otpDescription: "Nhập OTP để xác nhận gửi hóa đơn thật sang MISA.",

    // Configuration Modal
    configModalTitle: "Cấu hình xuất hóa đơn",
    configModalSubtitle: "Cấu hình tên sản phẩm và đơn vị",
    configModalDescription: "Danh sách từ toàn bộ hóa đơn trong ngày",
    productSectionTitle: "Cấu hình theo từng sản phẩm",
    productSectionSubtitle: (count: number) =>
      `${count} sản phẩm · mỗi sản phẩm có tên và đơn vị riêng`,
    originalProduct: "Sản phẩm gốc",
    renamedProduct: "Tên sau đổi",
    renamedUnit: "Đơn vị sau đổi",
    originalUnit: "Đơn vị gốc",
    keepOriginalName: "Giữ tên gốc",
    unitPlaceholder: "Đơn vị",
    loadingConfig: "Đang tải cấu hình…",
    unsavedChangesWarning: "Hãy lưu thay đổi trước khi xem danh sách xác nhận.",
    cancel: "Hủy",
    saving: "Đang lưu…",
    saveConfig: "Lưu cấu hình",
    generatingList: "Đang lập danh sách…",
    issueWithConfig: "Xuất hóa đơn theo cấu hình",

    // Confirm Modal
    confirmModalTitle: "Xác nhận xuất hóa đơn",
    confirmModalSubtitle: "Kiểm tra danh sách trước khi xuất",
    allOrdersToday: "Tất cả đơn trong ngày",
    selectedOrders: "Các đơn đã chọn",
    invoiceCount: "Số lượng hóa đơn",
    amountBeforeTax: "Tiền trước thuế",
    totalVat: "Tổng VAT",
    amountAfterTax: "Tiền sau thuế",
    paymentSummaryTitle: "Tổng tiền theo phương thức thanh toán",
    paymentSummarySubtitle: (count: number) =>
      `${count} phương thức thanh toán trong đợt xuất`,
    paymentInvoiceCount: (count: number) => `${count} hóa đơn`,
    unspecifiedPaymentMethod: "Chưa xác định",
    productSummaryTitle: "Tổng số lượng theo sản phẩm đã đổi tên",
    productSummarySubtitle: (lines: number, qty: string) =>
      `${lines} dòng sản phẩm · ${qty} sản phẩm`,
    productCol: "Sản phẩm",
    unitCol: "Đơn vị",
    quantityCol: "Số lượng",
    invoicesCol: "Hóa đơn",
    invoiceListTitle: (count: number) =>
      `Danh sách hóa đơn xác nhận (${count})`,
    productsCount: (count: number) => `${count} sản phẩm`,
    generatingPreview: "Đang tạo…",
    misaPreviewBtn: "Xem trước MISA",
    beforeTaxShort: "Trước thuế",
    excludedInvoicesWarning: (count: number) =>
      `${count} đơn không đủ điều kiện sẽ được bỏ qua. Kiểm tra go-live và chống xuất trùng vẫn được giữ.`,
    exportExcel: "Xuất Excel",
    exportingExcel: "Đang xuất Excel…",
    exportExcelSuccess: "Đã xuất file Excel",
    exportExcelSuccessDescription:
      "Danh sách hóa đơn đã được tải xuống để đối chiếu và lưu trữ.",
    exportExcelError: "Không thể xuất Excel",
    exportExcelErrorDescription: "Không thể tạo file Excel. Vui lòng thử lại.",
    back: "Quay lại",
    confirmAndContinueOtp: "Xác nhận và tiếp tục OTP",
    close: "Đóng",

    // Progress Card
    progressCompleted: "Đã hoàn tất tiến trình MISA",
    progressProcessing: "MISA đang xử lý trực tiếp",
    progressRejected: "Có hóa đơn bị MISA từ chối",
    statusIssued: "đã phát hành",
    statusSubmitting: "đang gửi",
    statusPendingMisa: "chờ MISA xác nhận",
    statusMisaReturnedIdentity:
      "MISA đã trả số hóa đơn — đang hoàn tất đối soát",
    statusPendingWithoutIdentity: "chưa nhận được kết quả phát hành từ MISA",
    statusNeedsAttention: "cần đối soát",
    statusPausedForSafety: "tạm dừng để kiểm tra",
    pendingIdentityExplanation:
      "Đã có TransactionID/số hóa đơn. Không phát hành lại; hệ thống cần hoàn tất cập nhật trạng thái ISSUED.",
    pendingWithoutIdentityExplanation:
      "Chưa có TransactionID hoặc số hóa đơn. Hệ thống phải kiểm tra RefID trước khi cho phép xử lý tiếp.",
    overduePendingWarning: (count: number) =>
      `${count} hóa đơn đã quá thời điểm kiểm tra lại dự kiến. Cần chạy recovery/đối soát, không xuất lại thủ công.`,
    allProcessed: "Tất cả hóa đơn đã được xử lý.",
    noValidInvoices: "Không tìm thấy hóa đơn hợp lệ.",
    misaRejectedTitle: (count: number) => `${count} hóa đơn đang treo`,
    misaRejectedDescription:
      "Các hóa đơn đang chờ xác nhận, gặp lỗi tạm thời hoặc cần đối soát sẽ được xử lý cùng lúc.",
    retryRejectedButton: (count: number) =>
      `Kiểm tra & gửi lại tất cả (${count})`,
    retrySafetyNote:
      "Hệ thống kiểm tra RefID và thông tin hóa đơn trên MISA; trường hợp 429, timeout hoặc nghi trùng sẽ không được gửi lại.",
    retryChecking: "Đang kiểm tra chống trùng…",
    retryStarted: "Đã bắt đầu thử lại",
    retryFailed: "Không thể thử lại hóa đơn",
    retryStartedDescription:
      "Đã phân loại toàn bộ đơn treo; chỉ những đơn không có dấu vết trùng mới được gửi lại.",
    retryOtpTitle: "Xác nhận xử lý tất cả đơn treo",
    retryOtpDescription: (count: number) =>
      `Nhập OTP để kiểm tra RefID, thông tin nghiệp vụ và xử lý ${count} hóa đơn đang treo.`,
  },
  zh: {
    title: "批量开票",
    selectedOrdersCount: (count: number) => `${count} 个已选订单`,
    eligibleOrdersCount: (count: number) => `${count} 个当日候选订单`,
    issueSelectedBtn: "开具已选订单",
    issueAllBtn: "开具当日全部订单",
    calculating: "正在计算…",
    retry: "重试",
    noEligibleInvoices: "没有符合条件的发票，请检查启用时间配置和数据错误。",
    noEligibleInvoicesTitle: "没有可开具的发票",
    previewErrorTitle: "无法校验开票批次",
    previewErrorFallback: "无法预览批量开票。",
    queuingInvoices: "正在加入开票队列…",
    startIssueSuccess: "已开始开票",
    startIssueError: "无法开始开票",
    startIssueSuccessDesc: "下方将实时显示 MISA 处理进度。",
    issueErrorFallback: "无法发起开票任务。",
    otpTitle: "验证批量开票",
    otpDescription: "输入 OTP 以确认向 MISA 提交真实发票。",

    // Configuration Modal
    configModalTitle: "批量开票配置",
    configModalSubtitle: "配置商品名称和单位",
    configModalDescription: "列表来自当天全部发票",
    productSectionTitle: "按商品配置",
    productSectionSubtitle: (count: number) =>
      `${count} 个商品 · 每个商品单独配置名称和单位`,
    originalProduct: "原商品",
    renamedProduct: "新名称",
    renamedUnit: "新单位",
    originalUnit: "原单位",
    keepOriginalName: "保留原名称",
    unitPlaceholder: "单位",
    loadingConfig: "正在加载配置…",
    unsavedChangesWarning: "请先保存更改，再查看确认列表。",
    cancel: "取消",
    saving: "保存中…",
    saveConfig: "保存配置",
    generatingList: "正在生成列表…",
    issueWithConfig: "按配置开具发票",

    // Confirm Modal
    confirmModalTitle: "确认批量开票",
    confirmModalSubtitle: "开票前核对列表",
    allOrdersToday: "当日全部订单",
    selectedOrders: "已选订单",
    invoiceCount: "发票数量",
    amountBeforeTax: "税前金额",
    totalVat: "增值税合计",
    amountAfterTax: "税后总额",
    paymentSummaryTitle: "按支付方式汇总金额",
    paymentSummarySubtitle: (count: number) =>
      `本次开票包含 ${count} 种支付方式`,
    paymentInvoiceCount: (count: number) => `${count} 张发票`,
    unspecifiedPaymentMethod: "未指定",
    productSummaryTitle: "按重命名商品汇总数量",
    productSummarySubtitle: (lines: number, qty: string) =>
      `${lines} 个商品行 · ${qty} 件商品`,
    productCol: "商品",
    unitCol: "单位",
    quantityCol: "数量",
    invoicesCol: "发票",
    invoiceListTitle: (count: number) => `待确认发票列表 (${count})`,
    productsCount: (count: number) => `${count} 个商品`,
    generatingPreview: "生成中…",
    misaPreviewBtn: "MISA 预览",
    beforeTaxShort: "税前",
    excludedInvoicesWarning: (count: number) =>
      `${count} 个不符合条件的订单将被跳过，启用时间和防重复检查仍然有效。`,
    exportExcel: "导出 Excel",
    exportingExcel: "正在导出 Excel…",
    exportExcelSuccess: "Excel 已导出",
    exportExcelSuccessDescription: "发票列表已下载，可用于核对和归档。",
    exportExcelError: "无法导出 Excel",
    exportExcelErrorDescription: "无法生成 Excel 文件，请重试。",
    back: "返回",
    confirmAndContinueOtp: "确认并继续 OTP",
    close: "关闭",

    // Progress Card
    progressCompleted: "MISA 处理已完成",
    progressProcessing: "MISA 实时处理中",
    progressRejected: "存在被 MISA 拒绝的发票",
    statusIssued: "已开具",
    statusSubmitting: "正在提交",
    statusPendingMisa: "等待 MISA 确认",
    statusMisaReturnedIdentity: "MISA 已返回发票号 — 正在完成对账",
    statusPendingWithoutIdentity: "尚未收到 MISA 的开具结果",
    statusNeedsAttention: "需要对账",
    statusPausedForSafety: "已暂停以安全检查",
    pendingIdentityExplanation:
      "已有 TransactionID/发票号。请勿重复开具；系统需要完成 ISSUED 状态更新。",
    pendingWithoutIdentityExplanation:
      "尚无 TransactionID 或发票号。继续处理前，系统必须先核验 RefID。",
    overduePendingWarning: (count: number) =>
      `${count} 张发票已超过预计复查时间。需要运行恢复/对账，请勿手动重复开具。`,
    allProcessed: "所有发票均已处理。",
    noValidInvoices: "没有找到有效的发票。",
    misaRejectedTitle: (count: number) => `${count} 张发票处于挂起状态`,
    misaRejectedDescription: "等待确认、临时失败或需要对账的发票将一起处理。",
    retryRejectedButton: (count: number) => `检查并重试全部 (${count})`,
    retrySafetyNote:
      "系统会核验 MISA RefID 和发票信息；遇到 429、超时或疑似重复时不会重发。",
    retryChecking: "正在检查重复风险…",
    retryStarted: "已开始重试",
    retryFailed: "无法重试发票",
    retryStartedDescription:
      "所有挂起发票已分类；仅无重复痕迹的发票会重新提交。",
    retryOtpTitle: "确认处理全部挂起发票",
    retryOtpDescription: (count: number) =>
      `输入 OTP，以核验 RefID、业务信息并处理 ${count} 张挂起发票。`,
  },
} as const;

export type BulkIssueLabels =
  (typeof bulkIssueTranslations)[keyof typeof bulkIssueTranslations];
