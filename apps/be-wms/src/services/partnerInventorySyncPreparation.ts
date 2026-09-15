import type {
  PartnerInventoryComparisonRow,
  PartnerInventorySyncItemResult,
  PartnerWarehouseMappingDto,
} from "@bduck/shared-types";

import { findByWarehouse } from "../repositories/inventoryRepository.js";
import { productRepository } from "../repositories/productRepository.js";

import { fetchJoyWorldStock } from "./joyWorldInventoryClient.js";
import type { JoyWorldStockRow } from "./partnerInventorySchemas.js";
import {
  createPartnerInventoryItemResult,
  type PreparedPartnerInventoryMutation,
} from "./partnerInventorySyncPolicy.js";

const aggregateSelectedAtp = async (
  warehouseId: string,
  productIds: string[],
) => {
  const selected = new Set(productIds);
  const inventory = await findByWarehouse(warehouseId);
  const atp = new Map<string, number>();
  inventory.forEach((item) => {
    if (!selected.has(item.product_id)) return;
    atp.set(item.product_id, (atp.get(item.product_id) || 0) + item.atp_quantity);
  });
  return atp;
};

export const preparePartnerInventoryMutations = async (input: {
  warehouseId: string;
  productIds: string[];
  selectedRows: PartnerInventoryComparisonRow[];
  mapping: PartnerWarehouseMappingDto;
}): Promise<{
  prepared: PreparedPartnerInventoryMutation[];
  results: PartnerInventorySyncItemResult[];
}> => {
  const [atpByProduct, products, currentPartnerRows] = await Promise.all([
    aggregateSelectedAtp(input.warehouseId, input.productIds),
    productRepository.findByIds(input.productIds),
    fetchJoyWorldStock(input.mapping.partner_stock_id),
  ]);
  const productById = new Map(products.map((product) => [product.id, product]));
  const partnerByGiftId = new Map<string, JoyWorldStockRow[]>();
  currentPartnerRows.forEach((row) => {
    partnerByGiftId.set(row.giftId, [
      ...(partnerByGiftId.get(row.giftId) || []),
      row,
    ]);
  });

  const prepared: PreparedPartnerInventoryMutation[] = [];
  const results: PartnerInventorySyncItemResult[] = [];
  input.selectedRows.forEach((row) => {
    const productId = row.product_id!;
    const currentRows = row.partner_gift_id
      ? partnerByGiftId.get(row.partner_gift_id) || []
      : [];
    const targetAtp = atpByProduct.get(productId);
    const product = productById.get(productId);
    const fallbackCurrent: JoyWorldStockRow = {
      id: row.partner_stock_value_id || "missing",
      stockId: input.mapping.partner_stock_id,
      stockName: input.mapping.partner_stock_name,
      giftId: row.partner_gift_id || "missing",
      giftNo: row.sku,
      giftName: row.product_name,
      amount: row.partner_amount || 0,
      giftPrice: row.partner_gift_price || 0,
      isEnabled: true,
      updateTime: "",
    };
    const mutation: PreparedPartnerInventoryMutation = {
      row,
      current: currentRows[0] || fallbackCurrent,
      targetAtp: targetAtp ?? -1,
      delta:
        targetAtp === undefined
          ? 0
          : targetAtp - (currentRows[0]?.amount ?? 0),
    };
    const stale =
      !product ||
      targetAtp === undefined ||
      targetAtp < 0 ||
      currentRows.length !== 1 ||
      product.code !== row.sku ||
      currentRows[0].giftNo !== row.sku ||
      targetAtp !== row.jpulse_atp ||
      currentRows[0].amount !== row.partner_amount;
    if (stale) {
      results.push(
        createPartnerInventoryItemResult(
          mutation,
          "STALE",
          currentRows[0]?.amount ?? null,
        ),
      );
    } else if (mutation.delta === 0) {
      results.push(
        createPartnerInventoryItemResult(
          mutation,
          "ALREADY_MATCHED",
          currentRows[0].amount,
        ),
      );
    } else {
      prepared.push(mutation);
    }
  });
  return { prepared, results };
};
