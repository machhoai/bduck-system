import {
  InvoicePreparationStatus,
  type InvoiceCalculationResult,
  type InvoicePreflightIssue,
  type InvoicePreflightResult,
  type InvoiceSourceOrderLine,
} from "@bduck/shared-types";
import { invoiceLineShouldAppearInIssuedInvoice } from "./invoiceLineVisibilityPolicy.js";

export interface InvoicePreflightInput {
  lines: InvoiceSourceOrderLine[];
  calculation: InvoiceCalculationResult | null;
  payment_time: Date | null;
  mapped_payment_method: string | null;
  store_config_exists: boolean;
  store_config_enabled: boolean;
  price_includes_vat: boolean | null;
  inv_series: string | null;
  go_live_at: Date | null;
  account_exists: boolean;
  account_enabled: boolean;
  account_last_test_succeeded: boolean;
}

const issue = (
  code: string,
  path: string,
  message: string,
  severity: "ERROR" | "WARNING" = "ERROR",
): InvoicePreflightIssue => ({ code, path, message, severity });

export const preflightInvoiceSourceOrder = (
  input: InvoicePreflightInput,
): InvoicePreflightResult => {
  const issues: InvoicePreflightIssue[] = [];
  const invoiceLines = input.lines
    .map((line, sourceIndex) => ({ line, sourceIndex }))
    .filter(({ line }) => invoiceLineShouldAppearInIssuedInvoice(line));

  if (!input.store_config_exists) {
    issues.push(issue("STORE_CONFIG_MISSING", "store_config", "Cửa hàng chưa có cấu hình meInvoice."));
  } else if (!input.store_config_enabled) {
    issues.push(issue("STORE_CONFIG_DISABLED", "store_config.enabled", "Cấu hình meInvoice của cửa hàng chưa được bật."));
  }
  if (input.price_includes_vat === null) {
    issues.push(issue("PRICE_VAT_MODE_UNCONFIRMED", "store_config.price_includes_vat", "Chưa xác nhận giá nguồn có bao gồm VAT hay không."));
  }
  if (!input.inv_series) {
    issues.push(issue("INVOICE_SERIES_MISSING", "store_config.inv_series", "Chưa cấu hình ký hiệu hóa đơn."));
  }
  if (!input.account_exists) {
    issues.push(issue("MEINVOICE_ACCOUNT_MISSING", "meinvoice_account", "Không tìm thấy tài khoản meInvoice."));
  } else {
    if (!input.account_enabled) {
      issues.push(issue("MEINVOICE_ACCOUNT_DISABLED", "meinvoice_account.enabled", "Tài khoản meInvoice chưa được bật."));
    }
    if (!input.account_last_test_succeeded) {
      issues.push(issue("MEINVOICE_CONNECTION_NOT_VERIFIED", "meinvoice_account.last_test_succeeded", "Kết nối meInvoice chưa được kiểm tra thành công."));
    }
  }
  if (!input.payment_time) {
    issues.push(issue("PAYMENT_TIME_MISSING", "payment_time", "Đơn hàng chưa có thời điểm thanh toán thành công."));
  } else if (!input.go_live_at) {
    issues.push(issue("GO_LIVE_NOT_SET", "store_config.go_live_at", "Chưa đặt thời điểm go-live nên đơn chưa thể phát hành."));
  } else if (input.payment_time < input.go_live_at) {
    issues.push(issue("BEFORE_GO_LIVE", "payment_time", "Đơn phát sinh trước thời điểm go-live, chỉ được dùng để đối chiếu."));
  }
  if (!input.mapped_payment_method) {
    issues.push(issue("PAYMENT_METHOD_UNMAPPED", "payment_method", "Phương thức thanh toán nguồn chưa được ánh xạ sang meInvoice."));
  }
  if (invoiceLines.length === 0) {
    issues.push(issue("ITEMS_EMPTY", "items", "Hóa đơn phải có ít nhất một dòng hàng."));
  }
  if (invoiceLines.length >= 200) {
    issues.push(issue("ITEM_LIMIT_EXCEEDED", "items", "Hóa đơn phải có ít hơn 200 dòng hàng."));
  }

  invoiceLines.forEach(({ line, sourceIndex }) => {
    const path = `items.${sourceIndex}`;
    if (!line.item_code) issues.push(issue("ITEM_CODE_MISSING", `${path}.item_code`, "Dòng hàng thiếu mã hàng."));
    if (!line.item_name) issues.push(issue("ITEM_NAME_MISSING", `${path}.item_name`, "Dòng hàng thiếu tên hàng."));
    if (!line.unit_name) issues.push(issue("ITEM_UNIT_MISSING", `${path}.unit_name`, "Dòng hàng thiếu đơn vị tính."));
    if (line.quantity === null || line.quantity <= 0) {
      issues.push(issue("ITEM_QUANTITY_INVALID", `${path}.quantity`, "Số lượng phải lớn hơn 0."));
    }
    if (line.unit_price === null || line.unit_price < 0) {
      issues.push(issue("ITEM_UNIT_PRICE_INVALID", `${path}.unit_price`, "Đơn giá không hợp lệ."));
    }
    if (!line.vat_rate_name) {
      issues.push(issue("VAT_RATE_MISSING", `${path}.vat_rate_name`, "Dòng hàng chưa có ánh xạ thuế suất."));
    }
  });

  if (!input.calculation && invoiceLines.length > 0) {
    issues.push(issue("CALCULATION_UNAVAILABLE", "calculation", "Không thể tính hóa đơn do dữ liệu dòng hàng chưa đầy đủ."));
  }

  const taxConfigurationMissing = issues.some((item) =>
    ["PRICE_VAT_MODE_UNCONFIRMED", "VAT_RATE_MISSING"].includes(item.code));
  const hasError = issues.some((item) => item.severity === "ERROR");
  return {
    status: taxConfigurationMissing
      ? InvoicePreparationStatus.NEEDS_TAX_CONFIGURATION
      : hasError
        ? InvoicePreparationStatus.NEEDS_CORRECTION
        : InvoicePreparationStatus.READY_TO_ISSUE,
    issue_eligible: !hasError,
    issues,
  };
};
