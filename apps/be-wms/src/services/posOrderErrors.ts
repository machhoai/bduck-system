type Messages = { vi: string; zh: string };

export class PosOrderError extends Error {
  constructor(
    readonly statusCode: number,
    readonly messages: Messages,
    readonly code: string,
  ) {
    super(code);
  }
}

const ERROR_MESSAGES: Record<string, Messages> = {
  ORDER_NOT_FOUND: { vi: "Không tìm thấy đơn hàng.", zh: "未找到订单。" },
  ORDER_VERSION_CONFLICT: {
    vi: "Đơn hàng vừa thay đổi. Vui lòng kiểm tra lại thông tin mới nhất.",
    zh: "订单刚刚发生变化，请检查最新信息。",
  },
  ORDER_SYNCING: {
    vi: "Đơn hàng đang đồng bộ. Chỉ có thể hủy sau khi đồng bộ kết thúc.",
    zh: "订单正在同步，请等待同步结束后再取消。",
  },
  INVOICE_LOCKED: {
    vi: "Đơn hàng đang hoặc đã phát hành hóa đơn MISA nên không thể hủy.",
    zh: "订单正在或已经开具 MISA 发票，无法取消。",
  },
  IMPORTED_READ_ONLY: {
    vi: "Đơn lịch sử nhập từ JoyWorld chỉ được phép xem.",
    zh: "从 JoyWorld 导入的历史订单仅供查看。",
  },
  REFUND_IN_PROGRESS: {
    vi: "Đơn hàng đang được hoàn tiền.",
    zh: "订单正在退款。",
  },
  REFUND_UNKNOWN: {
    vi: "Kết quả hoàn tiền chưa xác định; cần đối soát trước khi thử lại.",
    zh: "退款结果未知，重试前需要对账。",
  },
  REFUND_CONFIRMATION_REQUIRED: {
    vi: "Bạn phải xác nhận hoàn tiền theo phương thức thanh toán ban đầu.",
    zh: "请确认按原支付方式退款。",
  },
  CANCEL_PERMISSION_DENIED: {
    vi: "Bạn không có quyền hủy loại đơn hàng này.",
    zh: "您没有权限取消此类订单。",
  },
  REMOTE_REFUND_DISABLED: {
    vi: "Hoàn tiền JoyWorld chưa được bật.",
    zh: "JoyWorld 退款尚未启用。",
  },
  REMOTE_REFUND_SECURE_TRANSPORT_REQUIRED: {
    vi: "Hoàn tiền JoyWorld bị khóa vì chưa có đường truyền bảo mật.",
    zh: "由于尚无安全传输通道，JoyWorld 退款已锁定。",
  },
  REMOTE_REFUND_NOT_ENABLED_FOR_STORE: {
    vi: "Hoàn tiền JoyWorld chưa được bật cho cửa hàng này.",
    zh: "此门店尚未启用 JoyWorld 退款。",
  },
  REMOTE_ORDER_NOT_FOUND: {
    vi: "Không tìm thấy chính xác đơn tương ứng trên JoyWorld.",
    zh: "在 JoyWorld 中未找到准确匹配的订单。",
  },
  REMOTE_ORDER_AMBIGUOUS: {
    vi: "Có nhiều đơn JoyWorld trùng khớp; không thể hoàn tiền tự động.",
    zh: "存在多个匹配的 JoyWorld 订单，无法自动退款。",
  },
  REMOTE_REFUND_NOT_ALLOWED: {
    vi: "JoyWorld không cho phép hoàn tiền đơn hàng này.",
    zh: "JoyWorld 不允许对此订单退款。",
  },
  REMOTE_ORDER_NUMBER_MISMATCH: {
    vi: "Mã đơn JoyWorld không khớp dữ liệu local.",
    zh: "JoyWorld 订单号与本地数据不匹配。",
  },
  REMOTE_ORDER_AMOUNT_MISMATCH: {
    vi: "Số tiền JoyWorld không khớp dữ liệu local.",
    zh: "JoyWorld 金额与本地数据不匹配。",
  },
  REMOTE_ORDER_ITEMS_MISMATCH: {
    vi: "Sản phẩm có thể hoàn trên JoyWorld không khớp dữ liệu local.",
    zh: "JoyWorld 可退款商品与本地数据不匹配。",
  },
  REMOTE_PAYMENT_METHOD_MISMATCH: {
    vi: "Phương thức thanh toán JoyWorld không khớp dữ liệu local.",
    zh: "JoyWorld 支付方式与本地数据不匹配。",
  },
  JOYWORLD_NETWORK_ERROR: {
    vi: "Không thể kết nối JoyWorld để kiểm tra hoàn tiền.",
    zh: "无法连接 JoyWorld 检查退款。",
  },
  JOYWORLD_NETWORK_UNCERTAIN: {
    vi: "Mất kết nối khi gửi hoàn tiền; cần đối soát trước khi thử lại.",
    zh: "提交退款时连接中断，重试前需要对账。",
  },
  JOYWORLD_RESPONSE_INVALID: {
    vi: "JoyWorld trả về dữ liệu không hợp lệ; cần kiểm tra thủ công.",
    zh: "JoyWorld 返回的数据无效，需要人工检查。",
  },
  REMOTE_REFUND_REJECTED: {
    vi: "JoyWorld đã từ chối yêu cầu hoàn tiền.",
    zh: "JoyWorld 已拒绝退款请求。",
  },
};

export const posOrderError = (code: string, statusCode = 409): PosOrderError =>
  new PosOrderError(
    statusCode,
    ERROR_MESSAGES[code] ?? {
      vi: "Không thể xử lý đơn hàng POS.",
      zh: "无法处理 POS 订单。",
    },
    code,
  );
