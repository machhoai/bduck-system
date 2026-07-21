import { createHash } from "node:crypto";
import {
  type InvoiceCalculationResult,
  type MeInvoiceStoreConfig,
} from "@bduck/shared-types";
import { v5 as uuidv5 } from "uuid";
import type { StoredMeInvoiceAccount } from "../repositories/meInvoiceConfigRepository.js";
import {
  addDecimal,
  decimalToNumber,
  divideDecimal,
  multiplyDecimal,
  parseDecimal,
  roundDecimal,
  zeroDecimal,
} from "./invoiceDecimal.js";
import { canonicalJson } from "./invoiceOrderSyncUtils.js";

const REF_ID_NAMESPACE = "e9e08082-9f44-4ee0-aeb6-55a0e91c2dfc";
const REF_ID_NAMESPACE_VERSION = "meinvoice-original-v1";

const nullableString = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const asCalculation = (value: unknown): InvoiceCalculationResult | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const calculation = value as InvoiceCalculationResult;
  return Array.isArray(calculation.lines) &&
    Array.isArray(calculation.tax_rate_info) &&
    typeof calculation.calculation_hash === "string"
    ? calculation
    : null;
};

const sumMoney = (values: number[]) =>
  decimalToNumber(
    values.reduce(
      (total, value) => addDecimal(total, parseDecimal(value)),
      zeroDecimal(),
    ),
  );

const resolveDiscountRate = (
  amount: number,
  discountRate: number | null,
  discountAmount: number,
  digits: number,
): number => {
  if (discountRate !== null) return discountRate;
  if (discountAmount === 0 || amount === 0) return 0;
  return decimalToNumber(
    roundDecimal(
      divideDecimal(
        multiplyDecimal(parseDecimal(discountAmount), parseDecimal(100)),
        parseDecimal(amount),
        digits + 4,
      ),
      digits,
    ),
  );
};

const invoiceDate = (paymentTime: string): string => {
  const localDate = paymentTime.match(/^(\d{4}-\d{2}-\d{2})/u)?.[1];
  if (!localDate) throw new Error("INVOICE_PAYMENT_DATE_INVALID");
  return localDate;
};

export interface BuiltMeInvoicePayload {
  ref_id: string;
  prepared_payload_hash: string;
  payload: Record<string, unknown>;
}

export const buildMeInvoicePayload = (
  sourceOrder: Record<string, unknown>,
  storeConfig: MeInvoiceStoreConfig,
  account: StoredMeInvoiceAccount,
): BuiltMeInvoicePayload => {
  const calculation = asCalculation(sourceOrder.calculation);
  const sourceOrderId = nullableString(sourceOrder.source_order_id);
  const warehouseId = nullableString(sourceOrder.warehouse_id);
  const paymentTime = nullableString(sourceOrder.payment_time);
  if (!calculation || !sourceOrderId || !warehouseId || !paymentTime) {
    throw new Error("INVOICE_SOURCE_ORDER_NOT_PREPARED");
  }

  const refId = uuidv5(
    `${REF_ID_NAMESPACE_VERSION}:${account.legal_entity_id}:${warehouseId}:${sourceOrderId}:ORIGINAL`,
    REF_ID_NAMESPACE,
  );
  const totalSaleAmount = sumMoney(
    calculation.lines.map((line) => line.amount),
  );
  const totalDiscountAmount = sumMoney(
    calculation.lines.map((line) => line.calculated_discount_amount),
  );
  const coefficientDigits =
    storeConfig.option_user_defined.coefficient_decimal_digits;
  const buyer = asRecord(sourceOrder.buyer);
  const paymentMethodName =
    nullableString(sourceOrder.payment_method_name) ??
    nullableString(sourceOrder.mapped_payment_method) ??
    nullableString(storeConfig.default_payment_method_name);
  const sourceOrderNumber =
    nullableString(sourceOrder.source_order_number) ??
    nullableString(sourceOrder.order_number);
  const payload: Record<string, unknown> = {
    RefID: refId,
    InvSeries: storeConfig.inv_series,
    InvDate: invoiceDate(paymentTime),
    CurrencyCode: storeConfig.option_user_defined.main_currency,
    ExchangeRate: 1,
    PaymentMethodName: paymentMethodName,
    IsInvoiceSummary: false,
    IsSendEmail: false,
    ReceiverName: "",
    ReceiverEmail: "",
    SellerShopCode: storeConfig.seller_shop_code,
    SellerShopName: storeConfig.seller_shop_name,
    BuyerCode: "",
    BuyerLegalName: nullableString(buyer.legal_name) ?? "",
    BuyerTaxCode: nullableString(buyer.tax_code) ?? "",
    BuyerAddress:
      nullableString(buyer.address) ?? storeConfig.default_buyer_address,
    BuyerFullName:
      nullableString(buyer.full_name) ?? storeConfig.default_buyer_name,
    BuyerPhoneNumber: nullableString(buyer.phone_number) ?? "",
    BuyerEmail: nullableString(buyer.email) ?? "",
    BuyerBankName: "",
    BuyerBankAccount: "",
    BuyerBudgetCode: "",
    BuyerOrderCode: sourceOrderNumber ?? sourceOrderId,
    TotalSaleAmountOC: totalSaleAmount,
    TotalSaleAmount: totalSaleAmount,
    TotalDiscountAmountOC: totalDiscountAmount,
    TotalDiscountAmount: totalDiscountAmount,
    TotalAmountWithoutVATOC: calculation.total_amount_without_vat,
    TotalAmountWithoutVAT: calculation.total_amount_without_vat,
    TotalVATAmountOC: calculation.total_vat_amount,
    TotalVATAmount: calculation.total_vat_amount,
    TotalAmountOC: calculation.total_amount,
    TotalAmount: calculation.total_amount,
    OptionUserDefined: {
      MainCurrency: storeConfig.option_user_defined.main_currency,
      QuantityDecimalDigits: String(
        storeConfig.option_user_defined.quantity_decimal_digits,
      ),
      UnitPriceOCDecimalDigits: String(
        storeConfig.option_user_defined.unit_price_oc_decimal_digits,
      ),
      UnitPriceDecimalDigits: String(
        storeConfig.option_user_defined.unit_price_decimal_digits,
      ),
      AmountOCDecimalDigits: String(
        storeConfig.option_user_defined.amount_oc_decimal_digits,
      ),
      AmountDecimalDigits: String(
        storeConfig.option_user_defined.amount_decimal_digits,
      ),
      CoefficientDecimalDigits: String(coefficientDigits),
      ExchangRateDecimalDigits: String(
        storeConfig.option_user_defined.exchange_rate_decimal_digits,
      ),
    },
    OriginalInvoiceDetail: calculation.lines.map((line, index) => ({
      ItemType: 1,
      LineNumber: index + 1,
      SortOrder: index + 1,
      ItemCode: line.item_code ?? "",
      ItemName: line.item_name,
      UnitName: line.unit_name ?? storeConfig.default_unit_name ?? "",
      Quantity: line.quantity,
      UnitPrice: line.unit_price,
      AmountOC: line.amount,
      Amount: line.amount,
      DiscountRate: resolveDiscountRate(
        line.amount,
        line.discount_rate,
        line.calculated_discount_amount,
        coefficientDigits,
      ),
      DiscountAmountOC: line.calculated_discount_amount,
      DiscountAmount: line.calculated_discount_amount,
      AmountWithoutVATOC: line.amount_without_vat,
      AmountWithoutVAT: line.amount_without_vat,
      VATRateName: line.vat_rate_name,
      VATAmountOC: line.vat_amount,
      VATAmount: line.vat_amount,
    })),
    TaxRateInfo: calculation.tax_rate_info.map((item) => ({
      VATRateName: item.vat_rate_name,
      AmountWithoutVATOC: item.amount_without_vat,
      VATAmountOC: item.vat_amount,
    })),
  };

  return {
    ref_id: refId,
    prepared_payload_hash: createHash("sha256")
      .update(canonicalJson(payload))
      .digest("hex"),
    payload,
  };
};
