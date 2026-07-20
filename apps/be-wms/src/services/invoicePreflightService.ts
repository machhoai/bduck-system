import {
  InvoicePreparationStatus,
  type InvoiceCalculationResult,
  type InvoicePreflightIssue,
  type InvoicePreflightResult,
  type InvoiceSourceOrderLine,
} from "@bduck/shared-types";
import {
  compareDecimal,
  parseDecimal,
  roundDecimal,
} from "./invoiceDecimal.js";

export interface InvoicePreflightInput {
  lines: InvoiceSourceOrderLine[];
  calculation: InvoiceCalculationResult | null;
  amount_decimal_digits: number;
  source_amount_without_vat: number | null;
  source_vat_amount: number | null;
  source_total_amount: number | null;
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

const moneyMatches = (
  left: number,
  right: number,
  digits: number,
): boolean => compareDecimal(
  roundDecimal(parseDecimal(left), digits),
  roundDecimal(parseDecimal(right), digits),
) === 0;

export const preflightInvoiceSourceOrder = (
  input: InvoicePreflightInput,
): InvoicePreflightResult => {
  const issues: InvoicePreflightIssue[] = [];

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
  if (input.lines.length === 0) {
    issues.push(issue("ITEMS_EMPTY", "items", "Hóa đơn phải có ít nhất một dòng hàng."));
  }
  if (input.lines.length >= 200) {
    issues.push(issue("ITEM_LIMIT_EXCEEDED", "items", "Hóa đơn phải có ít hơn 200 dòng hàng."));
  }

  input.lines.forEach((line, index) => {
    const path = `items.${index}`;
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

  if (!input.calculation && input.lines.length > 0) {
    issues.push(issue("CALCULATION_UNAVAILABLE", "calculation", "Không thể tính hóa đơn do dữ liệu dòng hàng chưa đầy đủ."));
  }

  if (input.calculation) {
    input.calculation.lines.forEach((line, index) => {
      const source = input.lines[index];
      if (
        source.source_amount_without_vat !== null
        && !moneyMatches(source.source_amount_without_vat, line.amount_without_vat, input.amount_decimal_digits)
      ) {
        issues.push(issue("LINE_AMOUNT_MISMATCH", `items.${index}.amount_without_vat`, "Thành tiền trước thuế không khớp dữ liệu nguồn."));
      }
      if (
        source.source_vat_amount !== null
        && !moneyMatches(source.source_vat_amount, line.vat_amount, input.amount_decimal_digits)
      ) {
        issues.push(issue("LINE_VAT_MISMATCH", `items.${index}.vat_amount`, "Tiền thuế của dòng không khớp dữ liệu nguồn."));
      }
      if (
        source.source_total_amount !== null
        && !moneyMatches(source.source_total_amount, line.total_amount, input.amount_decimal_digits)
      ) {
        issues.push(issue("LINE_TOTAL_MISMATCH", `items.${index}.total_amount`, "Tổng tiền của dòng không khớp dữ liệu nguồn."));
      }
    });

    const masterComparisons: Array<[number | null, number, string, string]> = [
      [input.source_amount_without_vat, input.calculation.total_amount_without_vat, "MASTER_AMOUNT_MISMATCH", "Tổng trước thuế không khớp dữ liệu nguồn."],
      [input.source_vat_amount, input.calculation.total_vat_amount, "MASTER_VAT_MISMATCH", "Tổng tiền thuế không khớp dữ liệu nguồn."],
      [input.source_total_amount, input.calculation.total_amount, "MASTER_TOTAL_MISMATCH", "Tổng thanh toán không khớp dữ liệu nguồn."],
    ];
    for (const [source, calculated, code, message] of masterComparisons) {
      if (source !== null && !moneyMatches(source, calculated, input.amount_decimal_digits)) {
        issues.push(issue(code, "calculation", message));
      }
    }
  }

  const taxConfigurationMissing = issues.some((item) =>
    ["PRICE_VAT_MODE_UNCONFIRMED", "VAT_RATE_MISSING"].includes(item.code));
  const hasError = issues.some((item) => item.severity === "ERROR");
  return {
    status: taxConfigurationMissing
      ? InvoicePreparationStatus.NEEDS_TAX_CONFIGURATION
      : hasError
        ? InvoicePreparationStatus.NEEDS_REVIEW
        : InvoicePreparationStatus.READY_FOR_REVIEW,
    issue_eligible: !hasError,
    issues,
  };
};
