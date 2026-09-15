import { createHash } from "crypto";

import type {
  Inventory,
  PartnerInventoryComparisonRow,
  Product,
} from "@bduck/shared-types";

import type { JoyWorldStockRow } from "./partnerInventorySchemas.js";

export const aggregatePartnerInventoryAtp = (inventory: Inventory[]) => {
  const byProduct = new Map<string, number>();
  inventory.forEach((item) => {
    byProduct.set(
      item.product_id,
      (byProduct.get(item.product_id) || 0) + item.atp_quantity,
    );
  });
  return byProduct;
};

export const buildPartnerInventoryComparisonRow = (input: {
  sku: string;
  products: Product[];
  atpByProduct: Map<string, number>;
  partnerRows: JoyWorldStockRow[];
}): PartnerInventoryComparisonRow => {
  const product = input.products.length === 1 ? input.products[0] : null;
  const partner = input.partnerRows.length === 1 ? input.partnerRows[0] : null;
  const atp = product ? input.atpByProduct.get(product.id) ?? null : null;
  const partnerAmount = partner?.amount ?? null;
  const duplicated = input.products.length > 1 || input.partnerRows.length > 1;
  const invalidAtp = atp !== null && (!Number.isFinite(atp) || atp < 0);

  let status: PartnerInventoryComparisonRow["status"] = "READY";
  if (duplicated) status = "DUPLICATE_SKU";
  else if (!partner) status = "NO_PARTNER_MATCH";
  else if (!product || atp === null) status = "NO_JPULSE_INVENTORY";
  else if (invalidAtp) status = "INVALID_ATP";
  else if (atp === partnerAmount) status = "ALREADY_MATCHED";

  const delta = atp !== null && partnerAmount !== null ? atp - partnerAmount : null;
  return {
    row_id: createHash("sha256").update(input.sku).digest("hex"),
    product_id: product?.id ?? null,
    category_id: product?.category_id ?? null,
    sku: input.sku,
    product_name: product?.name ?? partner?.giftName ?? input.sku,
    partner_gift_id: partner?.giftId ?? null,
    partner_stock_value_id: partner?.id ?? null,
    jpulse_atp: atp,
    partner_amount: partnerAmount,
    delta,
    partner_gift_price: partner?.giftPrice ?? null,
    partner_is_open_expire: false,
    status,
    eligible: status === "READY" && delta !== 0,
  };
};
