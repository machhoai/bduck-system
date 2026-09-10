export type InvoiceErrorContext =
  | "LOAD"
  | "UPDATE"
  | "PREVIEW"
  | "ISSUE"
  | "RETRY"
  | "DOWNLOAD"
  | "SAVE";

const contextTitle: Record<InvoiceErrorContext, string> = {
  LOAD: "Không thể tải dữ liệu hóa đơn",
  UPDATE: "Cập nhật dữ liệu chưa hoàn tất",
  PREVIEW: "Không thể tạo bản xem trước",
  ISSUE: "Không thể phát hành hóa đơn",
  RETRY: "Không thể gửi lại hóa đơn",
  DOWNLOAD: "Không thể mở hoặc tải hóa đơn",
  SAVE: "Không thể lưu thay đổi hóa đơn",
};

interface InvoiceApiErrorLike extends Error {
  statusCode: number;
  code: string | null;
}

const isInvoiceApiError = (error: unknown): error is InvoiceApiErrorLike =>
  error instanceof Error &&
  typeof (error as Partial<InvoiceApiErrorLike>).statusCode === "number" &&
  ((error as Partial<InvoiceApiErrorLike>).code === null ||
    typeof (error as Partial<InvoiceApiErrorLike>).code === "string");

const actionForError = (error: unknown) => {
  if (isInvoiceApiError(error)) {
    if (error.statusCode === 401 || error.statusCode === 403) {
      return "Kiểm tra quyền tại cửa hàng đang chọn hoặc đăng nhập lại. Nếu vẫn lỗi, gửi mã kỹ thuật cho IT.";
    }
    if (error.statusCode === 409) {
      return "Bấm Cập nhật dữ liệu, mở lại hóa đơn và kiểm tra số tiền trước khi thao tác lại.";
    }
    if (error.statusCode === 422) {
      return "Mở chi tiết hóa đơn hoặc cấu hình cửa hàng, sửa các trường đang thiếu rồi thử lại.";
    }
    if (error.statusCode === 429) {
      return "Không gửi lại ngay. Chờ hệ thống kiểm tra trạng thái MISA rồi bấm Cập nhật dữ liệu sau ít phút.";
    }
    if (error.statusCode >= 500) {
      return "Thử lại sau. Nếu lỗi lặp lại, gửi cửa hàng, ngày giao dịch và mã kỹ thuật cho IT.";
    }
  }
  return "Kiểm tra kết nối mạng rồi thử lại. Nếu lỗi lặp lại, gửi cửa hàng, ngày giao dịch và nội dung này cho IT.";
};

export const invoiceErrorToast = (
  error: unknown,
  context: InvoiceErrorContext,
  fallback: string,
) => {
  const cause =
    error instanceof Error && error.message ? error.message : fallback;
  const technicalCode = isInvoiceApiError(error)
    ? error.code
      ? `${error.code} · HTTP ${error.statusCode}`
      : `HTTP ${error.statusCode}`
    : null;
  return {
    title: contextTitle[context],
    description: `Nguyên nhân: ${cause} Cách xử lý: ${actionForError(error)}${
      technicalCode ? ` Mã kỹ thuật: ${technicalCode}.` : ""
    }`,
  };
};
