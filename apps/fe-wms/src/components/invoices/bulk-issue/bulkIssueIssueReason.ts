const reasons = {
  vi: {
    SOURCE_ORDER_NOT_IN_SCOPE:
      "Đơn hàng không còn thuộc cửa hàng hoặc ngày đang chọn.",
    DOCUMENT_NOT_PREPARED:
      "Chưa có hóa đơn nháp. Hãy bấm Cập nhật dữ liệu rồi kiểm tra lại.",
    DOCUMENT_NOT_READY: "Hóa đơn nháp chưa ở trạng thái có thể phát hành.",
    DOCUMENT_NOT_ELIGIBLE:
      "Hóa đơn nháp còn thiếu dữ liệu hoặc chưa vượt qua kiểm tra.",
    SOURCE_STALE: "Dữ liệu đơn hàng đã thay đổi sau khi hóa đơn nháp được tạo.",
    SOURCE_FINANCIALS_STALE:
      "Tiền hoặc thuế của đơn hàng đã thay đổi sau khi hóa đơn nháp được tính.",
    SOURCE_ALREADY_INVOICED: "Đơn hàng đã được đối chiếu với một hóa đơn.",
    ACTIVE_ISSUE_JOB: "Hóa đơn đang được gửi đến MISA.",
    BEFORE_GO_LIVE:
      "Thời điểm thanh toán trước ngày cửa hàng bắt đầu phát hành hóa đơn.",
  },
  zh: {
    SOURCE_ORDER_NOT_IN_SCOPE: "订单已不属于当前门店或所选日期。",
    DOCUMENT_NOT_PREPARED: "尚未生成发票草稿，请先更新数据。",
    DOCUMENT_NOT_READY: "发票草稿当前无法开具。",
    DOCUMENT_NOT_ELIGIBLE: "发票草稿缺少数据或未通过校验。",
    SOURCE_STALE: "创建发票草稿后，订单数据已发生变化。",
    SOURCE_FINANCIALS_STALE: "计算草稿后，订单金额或税额已发生变化。",
    SOURCE_ALREADY_INVOICED: "订单已与一张发票完成核对。",
    ACTIVE_ISSUE_JOB: "发票正在发送至 MISA。",
    BEFORE_GO_LIVE: "付款时间早于门店启用发票的日期。",
  },
} as const;

export const bulkIssueReason = (code: string, lang: "vi" | "zh") => {
  const reason = reasons[lang][code as keyof (typeof reasons)[typeof lang]];
  if (reason) return reason;
  return lang === "vi"
    ? "Hệ thống chưa thể xác định điều kiện phát hành. Hãy gửi mã kỹ thuật cho IT."
    : "系统无法确认开票条件，请将技术代码提供给 IT。";
};

export const isChangedSourceIssue = (code: string) =>
  code === "SOURCE_STALE" || code === "SOURCE_FINANCIALS_STALE";
