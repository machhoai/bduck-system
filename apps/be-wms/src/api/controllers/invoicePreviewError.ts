import type { BilingualMessage } from "../../utils/responseHelper.js";
import { MeInvoiceApiError } from "../../services/meInvoiceClient.js";

interface InvoicePreviewErrorResponse {
  messages: BilingualMessage;
  statusCode: number;
  data: { code: string | null };
}

const previewFailedMessages: BilingualMessage = {
  vi: "Không thể tạo bản xem trước từ MISA meInvoice.",
  zh: "无法从 MISA meInvoice 创建预览。",
};

const previewRateLimitedMessages: BilingualMessage = {
  vi: "MISA đang tạm giới hạn số lượt xem trước do thao tác quá thường xuyên. Vui lòng chờ ít phút rồi thử lại.",
  zh: "由于预览请求过于频繁，MISA 暂时限制了访问。请等待几分钟后重试。",
};

export const toInvoicePreviewErrorResponse = (
  error: MeInvoiceApiError,
): InvoicePreviewErrorResponse => {
  if (error.httpStatus === 429) {
    return {
      messages: previewRateLimitedMessages,
      statusCode: 429,
      data: { code: error.code ?? "MEINVOICE_RATE_LIMITED" },
    };
  }

  return {
    messages: previewFailedMessages,
    statusCode: error.httpStatus >= 400 && error.httpStatus < 500 ? 400 : 502,
    data: { code: error.code },
  };
};
