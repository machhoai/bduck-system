import {
  InvoiceDocumentStatus,
  InvoiceIssueItemStatus,
} from "@bduck/shared-types";

export type InvoiceStatusLanguage = "vi" | "zh";
export type InvoiceStatusTone =
  | "neutral"
  | "info"
  | "success"
  | "warning"
  | "danger";

export interface InvoiceStatusContext {
  transactionId?: string | null;
  invoiceNumber?: string | null;
  invoiceCode?: string | null;
  errorCode?: string | null;
  retryEligible?: boolean;
}

export interface InvoiceStatusPresentation {
  label: string;
  detail: string;
  action: string | null;
  tone: InvoiceStatusTone;
}

const localized = <T>(lang: InvoiceStatusLanguage, vi: T, zh: T): T =>
  lang === "vi" ? vi : zh;

export const invoiceStatusToneClasses: Record<
  InvoiceStatusTone,
  { badge: string; panel: string; text: string }
> = {
  neutral: {
    badge: "border-slate-200 bg-slate-100 text-slate-700",
    panel: "border-slate-200 bg-white",
    text: "text-slate-700",
  },
  info: {
    badge: "border-sky-200 bg-sky-50 text-sky-800",
    panel: "border-sky-200 bg-sky-50/70",
    text: "text-sky-900",
  },
  success: {
    badge: "border-emerald-200 bg-emerald-50 text-emerald-800",
    panel: "border-emerald-200 bg-emerald-50/70",
    text: "text-emerald-900",
  },
  warning: {
    badge: "border-amber-200 bg-amber-50 text-amber-800",
    panel: "border-amber-200 bg-amber-50/70",
    text: "text-amber-950",
  },
  danger: {
    badge: "border-rose-200 bg-rose-50 text-rose-800",
    panel: "border-rose-200 bg-rose-50/70",
    text: "text-rose-900",
  },
};

export function getInvoiceStatusPresentation(
  status: InvoiceDocumentStatus | InvoiceIssueItemStatus,
  lang: InvoiceStatusLanguage,
  context: InvoiceStatusContext = {},
): InvoiceStatusPresentation {
  const hasMisaIdentity = Boolean(
    context.transactionId || context.invoiceNumber || context.invoiceCode,
  );

  switch (status) {
    case InvoiceDocumentStatus.SOURCE_SYNCED:
      return localized(
        lang,
        {
          label: "Đã đồng bộ đơn nguồn",
          detail:
            "Đơn hàng đã được tải về nhưng chưa chuẩn bị dữ liệu hóa đơn.",
          action: "Chuẩn bị và kiểm tra hóa đơn trước khi phát hành.",
          tone: "neutral",
        },
        {
          label: "来源订单已同步",
          detail: "订单已下载，但尚未准备发票数据。",
          action: "请先准备并核对发票，再提交开具。",
          tone: "neutral",
        },
      );
    case InvoiceDocumentStatus.NEEDS_TAX_CONFIGURATION:
      return localized(
        lang,
        {
          label: "Thiếu cấu hình thuế",
          detail: "Hóa đơn chưa đủ thông tin thuế để gửi sang MISA.",
          action: "Bổ sung cấu hình thuế rồi chuẩn bị lại hóa đơn.",
          tone: "warning",
        },
        {
          label: "缺少税务配置",
          detail: "发票税务信息不完整，暂不能提交至 MISA。",
          action: "请补充税务配置后重新准备发票。",
          tone: "warning",
        },
      );
    case InvoiceDocumentStatus.NEEDS_CORRECTION:
      return localized(
        lang,
        {
          label: "Cần chỉnh dữ liệu hóa đơn",
          detail: "Dữ liệu người mua, hàng hóa hoặc số tiền chưa hợp lệ.",
          action: "Mở chi tiết để xem và sửa các lỗi kiểm tra.",
          tone: "warning",
        },
        {
          label: "需要修正发票数据",
          detail: "购买方、商品或金额数据不符合要求。",
          action: "请打开详情查看并修正校验错误。",
          tone: "warning",
        },
      );
    case InvoiceDocumentStatus.NEEDS_REVIEW:
    case InvoiceDocumentStatus.NEEDS_SECOND_REVIEW:
    case InvoiceDocumentStatus.READY_TO_ISSUE:
      return localized(
        lang,
        {
          label: "Sẵn sàng phát hành",
          detail: "Dữ liệu hóa đơn đã vượt qua bước kiểm tra trước phát hành.",
          action: "Có thể chọn hóa đơn này để gửi sang MISA.",
          tone: "info",
        },
        {
          label: "可提交开具",
          detail: "发票数据已通过开具前校验。",
          action: "可选择此发票并提交至 MISA。",
          tone: "info",
        },
      );
    case InvoiceDocumentStatus.QUEUED:
    case InvoiceIssueItemStatus.QUEUED:
      return localized(
        lang,
        {
          label: "Đã xếp hàng — chưa gửi MISA",
          detail:
            "Hệ thống đã tiếp nhận yêu cầu và đang chờ đến lượt xử lý theo ký hiệu hóa đơn.",
          action: "Không thao tác phát hành lại.",
          tone: "info",
        },
        {
          label: "已排队 — 尚未提交 MISA",
          detail: "系统已接收请求，正按发票系列等待处理。",
          action: "请勿重复提交开具。",
          tone: "info",
        },
      );
    case InvoiceDocumentStatus.SUBMITTING:
    case InvoiceIssueItemStatus.SUBMITTING:
      return localized(
        lang,
        {
          label: "Đang gửi dữ liệu sang MISA",
          detail:
            "Yêu cầu phát hành đang được xử lý; kết quả cuối cùng chưa được ghi nhận.",
          action: "Không đóng hoặc tạo yêu cầu phát hành mới cho đơn này.",
          tone: "info",
        },
        {
          label: "正在向 MISA 提交数据",
          detail: "开具请求正在处理，最终结果尚未记录。",
          action: "请勿为此订单再次创建开具请求。",
          tone: "info",
        },
      );
    case InvoiceDocumentStatus.PENDING_CONFIRMATION:
    case InvoiceIssueItemStatus.PENDING_CONFIRMATION:
      if (hasMisaIdentity) {
        return localized(
          lang,
          {
            label: "MISA đã trả số hóa đơn — đang hoàn tất đối soát",
            detail: context.invoiceNumber
              ? `MISA đã trả số hóa đơn ${context.invoiceNumber}${context.transactionId ? " và TransactionID" : ""}. Hệ thống chưa hoàn tất cập nhật trạng thái nội bộ.`
              : "MISA đã trả thông tin nhận diện hóa đơn. Hệ thống chưa hoàn tất cập nhật trạng thái nội bộ.",
            action: "Không phát hành lại; chờ hệ thống đối soát thành ISSUED.",
            tone: "warning",
          },
          {
            label: "MISA 已返回发票号 — 正在完成对账",
            detail: context.invoiceNumber
              ? `MISA 已返回发票号 ${context.invoiceNumber}${context.transactionId ? " 和 TransactionID" : ""}，系统尚未完成内部状态更新。`
              : "MISA 已返回发票识别信息，系统尚未完成内部状态更新。",
            action: "请勿重复开具；等待系统对账并更新为已开具。",
            tone: "warning",
          },
        );
      }
      return localized(
        lang,
        {
          label: "Chưa nhận được kết quả phát hành từ MISA",
          detail:
            "Chưa có TransactionID hoặc số hóa đơn. Hệ thống đang kiểm tra bằng RefID để tránh xuất trùng.",
          action:
            "Không phát hành lại cho đến khi đối soát xác nhận MISA chưa có hóa đơn.",
          tone: "danger",
        },
        {
          label: "尚未收到 MISA 的开具结果",
          detail:
            "尚无 TransactionID 或发票号。系统正通过 RefID 核验，以避免重复开票。",
          action: "在确认 MISA 中不存在发票前，请勿重复开具。",
          tone: "danger",
        },
      );
    case InvoiceDocumentStatus.ISSUED:
    case InvoiceIssueItemStatus.ISSUED:
      return localized(
        lang,
        {
          label: "Đã phát hành trên MISA",
          detail: context.invoiceNumber
            ? `Hóa đơn số ${context.invoiceNumber} đã được phát hành${context.invoiceCode ? " và đã có mã CQT" : ""}.`
            : "MISA đã xác nhận hóa đơn được phát hành.",
          action: null,
          tone: "success",
        },
        {
          label: "已在 MISA 开具",
          detail: context.invoiceNumber
            ? `发票号 ${context.invoiceNumber} 已开具${context.invoiceCode ? "，并已取得税务机关代码" : ""}。`
            : "MISA 已确认发票开具成功。",
          action: null,
          tone: "success",
        },
      );
    case InvoiceDocumentStatus.RETRYABLE_ERROR:
    case InvoiceIssueItemStatus.RETRYABLE_ERROR:
      return localized(
        lang,
        {
          label: "Kết nối MISA gặp lỗi — hệ thống sẽ thử lại",
          detail: context.errorCode
            ? `Yêu cầu chưa hoàn tất (${context.errorCode}).`
            : "Yêu cầu chưa hoàn tất do lỗi tạm thời khi kết nối MISA.",
          action: "Không cần phát hành lại thủ công.",
          tone: "warning",
        },
        {
          label: "MISA 连接异常 — 系统将自动重试",
          detail: context.errorCode
            ? `请求尚未完成（${context.errorCode}）。`
            : "由于 MISA 临时连接异常，请求尚未完成。",
          action: "无需手动重复开具。",
          tone: "warning",
        },
      );
    case InvoiceDocumentStatus.MANUAL_RECONCILIATION:
    case InvoiceIssueItemStatus.MANUAL_RECONCILIATION:
      if (context.retryEligible) {
        return localized(
          lang,
          {
            label: "MISA từ chối — có thể thử lại sau khi sửa lỗi",
            detail: context.errorCode
              ? `MISA từ chối trước khi phát hành (${context.errorCode}).`
              : "MISA từ chối trước khi phát hành và chưa tạo số hóa đơn.",
            action: "Sửa nguyên nhân rồi dùng chức năng thử lại hóa đơn lỗi.",
            tone: "warning",
          },
          {
            label: "MISA 已拒绝 — 修正后可重试",
            detail: context.errorCode
              ? `MISA 在开具前拒绝了请求（${context.errorCode}）。`
              : "MISA 在开具前拒绝请求，尚未生成发票号。",
            action: "请修正原因后使用失败发票重试功能。",
            tone: "warning",
          },
        );
      }
      return localized(
        lang,
        {
          label: "Cần đối soát thủ công — không được xuất lại",
          detail:
            "Hệ thống không thể xác định chắc chắn MISA đã phát hành hay chưa.",
          action:
            "Kiểm tra RefID/TransactionID trên MISA trước khi xử lý tiếp.",
          tone: "danger",
        },
        {
          label: "需要人工对账 — 禁止重复开具",
          detail: "系统无法确定 MISA 是否已经开具发票。",
          action: "继续处理前，请先在 MISA 核验 RefID/TransactionID。",
          tone: "danger",
        },
      );
    case InvoiceDocumentStatus.POST_ISSUE_REVIEW:
      return localized(
        lang,
        {
          label: "Đã phát hành — cần kiểm tra sau phát hành",
          detail: "Hóa đơn đã phát hành nhưng có thông tin cần đối soát thêm.",
          action: "Kiểm tra trạng thái CQT và dữ liệu hóa đơn trên MISA.",
          tone: "warning",
        },
        {
          label: "已开具 — 需要开具后检查",
          detail: "发票已开具，但仍有信息需要进一步核对。",
          action: "请核验税务机关状态和 MISA 发票数据。",
          tone: "warning",
        },
      );
    case InvoiceDocumentStatus.REJECTED:
      return localized(
        lang,
        {
          label: "Bản nháp đã bị từ chối",
          detail:
            "Đây là trạng thái kiểm duyệt nội bộ; hóa đơn chưa được gửi sang MISA.",
          action: "Chỉnh sửa dữ liệu trước khi chuẩn bị lại.",
          tone: "danger",
        },
        {
          label: "草稿已被拒绝",
          detail: "这是内部审核状态；发票尚未提交至 MISA。",
          action: "请修正数据后重新准备。",
          tone: "danger",
        },
      );
    case InvoiceDocumentStatus.CANCELLED:
    case InvoiceIssueItemStatus.CANCELLED:
      return localized(
        lang,
        {
          label: "Đã hủy xử lý",
          detail: "Yêu cầu phát hành này đã bị hủy.",
          action: null,
          tone: "neutral",
        },
        {
          label: "处理已取消",
          detail: "此开具请求已取消。",
          action: null,
          tone: "neutral",
        },
      );
    case InvoiceDocumentStatus.CLOSED:
      return localized(
        lang,
        {
          label: "Đã đóng hồ sơ",
          detail: "Hồ sơ hóa đơn đã hoàn tất và được đóng.",
          action: null,
          tone: "neutral",
        },
        {
          label: "记录已关闭",
          detail: "发票记录已处理完成并关闭。",
          action: null,
          tone: "neutral",
        },
      );
    default:
      return {
        label: String(status),
        detail: localized(lang, "Chưa có mô tả trạng thái.", "暂无状态说明。"),
        action: null,
        tone: "neutral",
      };
  }
}

export function getMisaPublishStatusPresentation(
  publishStatus: number | null,
  isDeleted: boolean,
  lang: InvoiceStatusLanguage,
): InvoiceStatusPresentation {
  if (isDeleted) {
    return localized(
      lang,
      {
        label: "Đã xóa/hủy trên MISA",
        detail: "MISA ghi nhận hóa đơn đã bị xóa hoặc hủy.",
        action: "Kiểm tra lịch sử hóa đơn trước khi lập hóa đơn thay thế.",
        tone: "danger",
      },
      {
        label: "已在 MISA 删除/作废",
        detail: "MISA 记录此发票已删除或作废。",
        action: "开具替代发票前，请先核验发票历史。",
        tone: "danger",
      },
    );
  }
  if (publishStatus === 1) {
    return localized(
      lang,
      {
        label: "Đã phát hành trên MISA",
        detail: "MISA xác nhận trạng thái phát hành thành công.",
        action: null,
        tone: "success",
      },
      {
        label: "已在 MISA 开具",
        detail: "MISA 已确认发票开具成功。",
        action: null,
        tone: "success",
      },
    );
  }
  return localized(
    lang,
    {
      label:
        publishStatus === null
          ? "MISA chưa trả trạng thái phát hành"
          : `Chưa xác nhận phát hành (mã ${publishStatus})`,
      detail: "Chưa thể coi hóa đơn là đã phát hành.",
      action: "Tiếp tục đối soát trước khi xử lý lại.",
      tone: "warning",
    },
    {
      label:
        publishStatus === null
          ? "MISA 尚未返回开具状态"
          : `尚未确认开具（代码 ${publishStatus}）`,
      detail: "目前不能将此发票视为已开具。",
      action: "请继续对账后再处理。",
      tone: "warning",
    },
  );
}

export function getMisaTaxStatusLabel(
  sendTaxStatus: number | null,
  lang: InvoiceStatusLanguage,
): string | null {
  if (sendTaxStatus === null) return null;
  const labels: Record<number, { vi: string; zh: string }> = {
    0: { vi: "CQT chưa hoàn tất xử lý", zh: "税务机关尚未完成处理" },
    1: {
      vi: "Đang gửi/Cần kiểm tra kết quả CQT",
      zh: "正在发送/需核验税务机关结果",
    },
    2: { vi: "CQT đã tiếp nhận hoặc cấp mã", zh: "税务机关已接收或授码" },
    3: { vi: "CQT từ chối", zh: "税务机关已拒绝" },
    4: { vi: "Gửi CQT bị lỗi", zh: "发送至税务机关失败" },
  };
  const value = labels[sendTaxStatus];
  return value
    ? value[lang]
    : localized(
        lang,
        `Trạng thái CQT chưa xác định (${sendTaxStatus})`,
        `未知税务机关状态（${sendTaxStatus}）`,
      );
}
