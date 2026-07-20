import { createHash } from "node:crypto";
import type {
  InvoiceCalculationResult,
  InvoiceCalculatedLine,
  InvoiceSourceOrderLine,
  InvoiceTaxRateInfo,
  MeInvoiceOptionUserDefined,
} from "@bduck/shared-types";
import {
  addDecimal,
  decimalToNumber,
  divideDecimal,
  multiplyDecimal,
  parseDecimal,
  roundDecimal,
  subtractDecimal,
  zeroDecimal,
} from "./invoiceDecimal.js";
import { canonicalJson } from "./invoiceOrderSyncUtils.js";

export const INVOICE_CALCULATION_VERSION = "meinvoice-decimal-v1";

const sum = (values: number[]) => values.reduce(
  (total, value) => addDecimal(total, parseDecimal(value)),
  zeroDecimal(),
);

const calculateDiscount = (
  amount: ReturnType<typeof parseDecimal>,
  line: InvoiceSourceOrderLine,
  digits: number,
) => {
  if (line.discount_amount !== null) {
    return roundDecimal(parseDecimal(line.discount_amount), digits);
  }
  if (line.discount_rate !== null) {
    return roundDecimal(
      divideDecimal(
        multiplyDecimal(amount, parseDecimal(line.discount_rate)),
        parseDecimal(100),
        digits + 4,
      ),
      digits,
    );
  }
  return zeroDecimal();
};

export const calculateInvoice = (
  lines: InvoiceSourceOrderLine[],
  priceIncludesVat: boolean,
  option: MeInvoiceOptionUserDefined,
): InvoiceCalculationResult | null => {
  if (
    lines.length === 0
    || lines.some((line) =>
      line.quantity === null
      || line.unit_price === null
      || line.vat_rate_name === null
      || line.vat_rate === null)
  ) {
    return null;
  }

  const amountDigits = option.amount_oc_decimal_digits;
  const calculatedLines: InvoiceCalculatedLine[] = lines.map((line) => {
    const sourceAmount = roundDecimal(
      multiplyDecimal(parseDecimal(line.quantity!), parseDecimal(line.unit_price!)),
      amountDigits,
    );
    const sourceDiscount = calculateDiscount(sourceAmount, line, amountDigits);
    const discountedSourceAmount = subtractDecimal(sourceAmount, sourceDiscount);
    const numericVatRate = parseDecimal(line.vat_rate!);
    let unitPrice = parseDecimal(line.unit_price!);
    let amount;
    let discount;
    let amountWithoutVat;
    let vatAmount;
    let totalAmount;

    if (priceIncludesVat && line.vat_rate! > 0) {
      const divisor = addDecimal(
        parseDecimal(1),
        divideDecimal(numericVatRate, parseDecimal(100), amountDigits + 8),
      );
      unitPrice = roundDecimal(
        divideDecimal(unitPrice, divisor, option.unit_price_oc_decimal_digits + 8),
        option.unit_price_oc_decimal_digits,
      );
      amount = roundDecimal(
        divideDecimal(sourceAmount, divisor, amountDigits + 8),
        amountDigits,
      );
      discount = roundDecimal(
        divideDecimal(sourceDiscount, divisor, amountDigits + 8),
        amountDigits,
      );
      amountWithoutVat = subtractDecimal(amount, discount);
      totalAmount = roundDecimal(discountedSourceAmount, amountDigits);
      vatAmount = subtractDecimal(totalAmount, amountWithoutVat);
    } else {
      amount = sourceAmount;
      discount = sourceDiscount;
      amountWithoutVat = roundDecimal(discountedSourceAmount, amountDigits);
      vatAmount = line.vat_rate! > 0
        ? roundDecimal(
            divideDecimal(
              multiplyDecimal(amountWithoutVat, numericVatRate),
              parseDecimal(100),
              amountDigits + 4,
            ),
            amountDigits,
          )
        : zeroDecimal();
      totalAmount = addDecimal(amountWithoutVat, vatAmount);
    }

    return {
      ...line,
      unit_price: decimalToNumber(unitPrice),
      amount: decimalToNumber(amount),
      calculated_discount_amount: decimalToNumber(discount),
      amount_without_vat: decimalToNumber(amountWithoutVat),
      vat_amount: decimalToNumber(vatAmount),
      total_amount: decimalToNumber(totalAmount),
    };
  });

  const groups = new Map<string, InvoiceTaxRateInfo>();
  for (const line of calculatedLines) {
    const key = line.vat_rate_name!;
    const current = groups.get(key);
    groups.set(key, {
      vat_rate_name: line.vat_rate_name!,
      amount_without_vat: decimalToNumber(sum([
        current?.amount_without_vat ?? 0,
        line.amount_without_vat,
      ])),
      vat_amount: decimalToNumber(sum([
        current?.vat_amount ?? 0,
        line.vat_amount,
      ])),
    });
  }

  const taxRateInfo = [...groups.values()].sort((left, right) =>
    left.vat_rate_name.localeCompare(right.vat_rate_name));
  const resultWithoutHash = {
    version: INVOICE_CALCULATION_VERSION,
    lines: calculatedLines,
    tax_rate_info: taxRateInfo,
    total_amount_without_vat: decimalToNumber(
      sum(calculatedLines.map((line) => line.amount_without_vat)),
    ),
    total_vat_amount: decimalToNumber(
      sum(calculatedLines.map((line) => line.vat_amount)),
    ),
    total_amount: decimalToNumber(
      sum(calculatedLines.map((line) => line.total_amount)),
    ),
  };
  return {
    ...resultWithoutHash,
    calculation_hash: createHash("sha256")
      .update(canonicalJson(resultWithoutHash))
      .digest("hex"),
  };
};
