import type {
  InvoiceSkuMapping,
  InvoiceSourceOrderLine,
  InvoiceTaxRateSource,
  InvoiceVatRateName,
} from "@bduck/shared-types";
import {
  decimalToNumber,
  divideDecimal,
  parseDecimal,
} from "./invoiceDecimal.js";

type JsonRecord = Record<string, unknown>;

export interface InvoiceOrderAdapterOptions {
  price_includes_vat: boolean | null;
  tax_rate_source: InvoiceTaxRateSource;
  default_vat_rate_name: string | null;
  sku_mapping: Record<string, InvoiceSkuMapping>;
  category_vat_mapping: Record<string, InvoiceVatRateName>;
  unit_price_decimal_digits: number;
}

const asRecord = (value: unknown): JsonRecord =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};

const firstValue = (record: JsonRecord, names: string[]): unknown => {
  for (const name of names) {
    if (record[name] !== null && record[name] !== undefined && record[name] !== "") {
      return record[name];
    }
  }
  return null;
};

const nullableString = (value: unknown): string | null => {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
};

const nullableNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const normalizeVatRateName = (value: unknown): InvoiceVatRateName | null => {
  if (typeof value === "number" && [0, 5, 8, 10].includes(value)) {
    return `${value}%` as InvoiceVatRateName;
  }
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  if (["KCT", "KKKNT"].includes(normalized)) return normalized as InvoiceVatRateName;
  const numeric = normalized.replace(/%$/, "");
  return ["0", "5", "8", "10"].includes(numeric)
    ? (`${numeric}%` as InvoiceVatRateName)
    : null;
};

const selectFallbackGoods = (
  detail: JsonRecord,
  goods: JsonRecord[],
  index: number,
): JsonRecord => {
  const sourceId = nullableString(firstValue(detail, ["goodsId", "itemId", "id"]));
  if (sourceId) {
    const byId = goods.find((item) =>
      nullableString(firstValue(item, ["goodsId", "itemId", "id"])) === sourceId);
    if (byId) return byId;
  }
  const name = nullableString(firstValue(detail, ["goodsName", "itemName", "name"]));
  if (name) {
    const byName = goods.find((item) =>
      nullableString(firstValue(item, ["goodsName", "itemName", "name"])) === name);
    if (byName) return byName;
  }
  return goods[index] ?? {};
};

const resolveVatRateName = (
  row: JsonRecord,
  fallback: JsonRecord,
  sourceItemId: string | null,
  categoryCode: string | null,
  options: InvoiceOrderAdapterOptions,
): InvoiceVatRateName | null => {
  const sku = sourceItemId ? options.sku_mapping[sourceItemId] : undefined;
  let result: InvoiceVatRateName | null = null;
  if (options.tax_rate_source === "SOURCE") {
    result = normalizeVatRateName(firstValue(row, ["taxRate", "vatRate"]))
      ?? normalizeVatRateName(firstValue(fallback, ["taxRate", "vatRate"]));
  } else if (options.tax_rate_source === "SKU") {
    result = sku?.vat_rate_name ?? null;
  } else if (options.tax_rate_source === "CATEGORY" && categoryCode) {
    result = options.category_vat_mapping[categoryCode] ?? null;
  }
  return result ?? normalizeVatRateName(options.default_vat_rate_name);
};

const deriveGrossUnitPrice = (
  total: number | null,
  quantity: number | null,
  digits: number,
): number | null => {
  if (total === null || quantity === null || quantity === 0) return null;
  return decimalToNumber(
    divideDecimal(parseDecimal(total), parseDecimal(quantity), digits),
  );
};

export const adaptJoyworldOrderItems = (
  detailGoodsValue: unknown,
  goods: JsonRecord[],
  options: InvoiceOrderAdapterOptions,
): InvoiceSourceOrderLine[] => {
  const detailGoods = Array.isArray(detailGoodsValue)
    ? detailGoodsValue.map(asRecord)
    : [];
  const rows = detailGoods.length > 0 ? detailGoods : goods;

  return rows.map((row, index) => {
    const fallback = detailGoods.length > 0
      ? selectFallbackGoods(row, goods, index)
      : {};
    const sourceItemId = nullableString(
      firstValue(row, ["goodsId", "itemId", "id"])
        ?? firstValue(fallback, ["goodsId", "itemId", "id"]),
    );
    const mapping = sourceItemId ? options.sku_mapping[sourceItemId] : undefined;
    const categoryCode = nullableString(
      firstValue(row, ["category", "subCategory", "categoryId"])
        ?? firstValue(fallback, ["category", "subCategory", "categoryId"]),
    );
    const quantity = nullableNumber(
      firstValue(row, ["qty", "quantity", "realQty"])
        ?? firstValue(fallback, ["qty", "quantity", "realQty"]),
    );
    const sourceTotal = nullableNumber(
      firstValue(row, ["realMoney", "totalMoney", "amount"])
        ?? firstValue(fallback, ["realMoney", "totalMoney", "amount"]),
    );
    const sourceVat = nullableNumber(
      firstValue(row, ["taxMoney", "vatMoney", "vatAmount"])
        ?? firstValue(fallback, ["taxMoney", "vatMoney", "vatAmount"]),
    );
    const sourceBeforeTax = sourceTotal !== null && sourceVat !== null
      ? sourceTotal - sourceVat
      : null;
    const rawPrice = nullableNumber(
      firstValue(row, ["price", "unitPrice"])
        ?? firstValue(fallback, ["price", "unitPrice"]),
    );
    const unitPrice = options.price_includes_vat === true
      ? deriveGrossUnitPrice(sourceTotal, quantity, options.unit_price_decimal_digits)
        ?? rawPrice
      : rawPrice;
    const vatRateName = resolveVatRateName(
      row,
      fallback,
      sourceItemId,
      categoryCode,
      options,
    );

    return {
      line_number: index + 1,
      source_item_id: sourceItemId,
      item_code: mapping?.item_code ?? sourceItemId,
      item_name: mapping?.item_name
        ?? nullableString(firstValue(row, ["goodsName", "itemName", "name"]))
        ?? nullableString(firstValue(fallback, ["goodsName", "itemName", "name"])),
      category_code: categoryCode,
      category_name: nullableString(
        firstValue(row, ["goodsCategoryName", "showCategoryName", "categoryName"])
          ?? firstValue(fallback, ["goodsCategoryName", "showCategoryName", "categoryName"]),
      ),
      unit_name: mapping?.unit_name
        ?? nullableString(firstValue(row, ["unitName", "unit", "unitCode"]))
        ?? nullableString(firstValue(fallback, ["unitName", "unit", "unitCode"])),
      quantity,
      unit_price: unitPrice,
      discount_rate: nullableNumber(firstValue(row, ["discountRate"])),
      discount_amount: nullableNumber(firstValue(row, ["discountMoney", "discountAmount"]))
        ?? nullableNumber(firstValue(fallback, ["discountMoney", "discountAmount"])),
      vat_rate_name: vatRateName,
      vat_rate: vatRateName && /^\d+%$/.test(vatRateName)
        ? Number(vatRateName.slice(0, -1))
        : 0,
      source_amount_without_vat: sourceBeforeTax,
      source_vat_amount: sourceVat,
      source_total_amount: sourceTotal,
    };
  });
};
