import { AuditAction, StockPolicyScope } from "@bduck/shared-types";
import type { InventoryStockPolicy } from "@bduck/shared-types";
import { randomUUID } from "crypto";
import type { z } from "zod";
import { stockPolicyRepository } from "../repositories/stockPolicyRepository.js";
import { upsertStockPolicySchema } from "../utils/zodSchemas.js";
import { logAudit, type AuditMetadata } from "./auditService.js";
import { fetchLocationById } from "./locationService.js";
import { fetchLocationSlotById } from "./locationSlotService.js";
import { fetchProductById } from "./productService.js";
import { fetchWarehouseById } from "./warehouseService.js";

type UpsertStockPolicyInput = z.infer<typeof upsertStockPolicySchema>;

const notFoundError = {
  statusCode: 404,
  messages: {
    vi: "ChÃ­nh sÃ¡ch tá»“n kho khÃ´ng tá»“n táº¡i.",
    zh: "åº“å­˜ç­–ç•¥ä¸å­˜åœ¨ã€‚",
  },
};

const normalizePolicyInput = (input: UpsertStockPolicyInput) => {
  const warehouseLocationId = input.warehouse_location_id ?? null;
  const warehouseLocationSlotId = input.warehouse_location_slot_id ?? null;

  if (input.scope === StockPolicyScope.WAREHOUSE) {
    return {
      ...input,
      warehouse_location_id: null,
      warehouse_location_slot_id: null,
    };
  }

  if (input.scope === StockPolicyScope.LOCATION) {
    if (!warehouseLocationId) {
      throw {
        statusCode: 400,
        messages: {
          vi: "ChÃ­nh sÃ¡ch cáº¥p vá»‹ trÃ­ cáº§n warehouse_location_id.",
          zh: "åº“ä½çº§ç­–ç•¥éœ€è¦ warehouse_location_idã€‚",
        },
      };
    }
    return {
      ...input,
      warehouse_location_id: warehouseLocationId,
      warehouse_location_slot_id: null,
    };
  }

  if (!warehouseLocationId || !warehouseLocationSlotId) {
    throw {
      statusCode: 400,
      messages: {
        vi: "ChÃ­nh sÃ¡ch cáº¥p giá»£i cáº§n warehouse_location_id vÃ  warehouse_location_slot_id.",
        zh: "å­åº“ä½çº§ç­–ç•¥éœ€è¦ warehouse_location_id å’Œ warehouse_location_slot_idã€‚",
      },
    };
  }

  return {
    ...input,
    warehouse_location_id: warehouseLocationId,
    warehouse_location_slot_id: warehouseLocationSlotId,
  };
};

export const fetchStockPolicies = async (filters: {
  warehouse_id?: string;
  warehouse_location_id?: string;
  warehouse_location_slot_id?: string;
  product_id?: string;
  scope?: StockPolicyScope;
}): Promise<InventoryStockPolicy[]> => {
  return stockPolicyRepository.findByFilters(filters);
};

export const upsertStockPolicy = async (
  rawInput: UpsertStockPolicyInput,
  userId: string,
  auditMetadata?: AuditMetadata,
): Promise<InventoryStockPolicy> => {
  const input = normalizePolicyInput(rawInput);

  await Promise.all([
    fetchWarehouseById(input.warehouse_id),
    fetchProductById(input.product_id),
  ]);

  if (input.warehouse_location_id) {
    const location = await fetchLocationById(input.warehouse_location_id);
    if (location.warehouse_id !== input.warehouse_id) {
      throw {
        statusCode: 400,
        messages: {
          vi: "Vá»‹ trÃ­ khÃ´ng thuá»™c kho Ä‘Ã£ chá»n.",
          zh: "åº“ä½ä¸å±žäºŽæ‰€é€‰ä»“åº“ã€‚",
        },
      };
    }
  }

  if (input.warehouse_location_slot_id) {
    const slot = await fetchLocationSlotById(input.warehouse_location_slot_id);
    if (
      slot.warehouse_id !== input.warehouse_id ||
      slot.warehouse_location_id !== input.warehouse_location_id
    ) {
      throw {
        statusCode: 400,
        messages: {
          vi: "Giá»£i khÃ´ng thuá»™c vá»‹ trÃ­ Ä‘Ã£ chá»n.",
          zh: "å­åº“ä½ä¸å±žäºŽæ‰€é€‰åº“ä½ã€‚",
        },
      };
    }
  }

  const existing = await stockPolicyRepository.findExisting({
    scope: input.scope as StockPolicyScope,
    warehouse_id: input.warehouse_id,
    warehouse_location_id: input.warehouse_location_id,
    warehouse_location_slot_id: input.warehouse_location_slot_id,
    product_id: input.product_id,
  });

  if (existing) {
    const next = {
      min_stock_quantity: input.min_stock_quantity,
      max_stock_quantity: input.max_stock_quantity ?? null,
      reorder_point_quantity: input.reorder_point_quantity ?? null,
      reorder_quantity: input.reorder_quantity ?? null,
      is_active: input.is_active ?? true,
    };

    await stockPolicyRepository.update(existing.id, next as any);

    await logAudit({
      entity_type: "inventory_stock_policies",
      entity_id: existing.id,
      warehouse_id: existing.warehouse_id,
      action: AuditAction.UPDATE,
      user_id: userId,
      old_value: existing as unknown as Record<string, unknown>,
      new_value: next as unknown as Record<string, unknown>,
      ...auditMetadata,
    });

    return { ...existing, ...next };
  }

  const id = randomUUID();
  const policy = await stockPolicyRepository.create(id, {
    id,
    scope: input.scope as StockPolicyScope,
    warehouse_id: input.warehouse_id,
    warehouse_location_id: input.warehouse_location_id,
    warehouse_location_slot_id: input.warehouse_location_slot_id,
    product_id: input.product_id,
    min_stock_quantity: input.min_stock_quantity,
    max_stock_quantity: input.max_stock_quantity ?? null,
    reorder_point_quantity: input.reorder_point_quantity ?? null,
    reorder_quantity: input.reorder_quantity ?? null,
    is_active: input.is_active ?? true,
  } as any);

  await logAudit({
    entity_type: "inventory_stock_policies",
    entity_id: id,
    warehouse_id: input.warehouse_id,
    action: AuditAction.CREATE,
    user_id: userId,
    old_value: null,
    new_value: policy as unknown as Record<string, unknown>,
    ...auditMetadata,
  });

  return policy;
};

export const deleteStockPolicy = async (
  id: string,
  userId: string,
  auditMetadata?: AuditMetadata,
): Promise<void> => {
  const existing = await stockPolicyRepository.findById(id);
  if (!existing || existing.is_deleted) throw notFoundError;

  await stockPolicyRepository.softDelete(id);
  await logAudit({
    entity_type: "inventory_stock_policies",
    entity_id: id,
    warehouse_id: existing.warehouse_id,
    action: AuditAction.SOFT_DELETE,
    user_id: userId,
    old_value: existing as unknown as Record<string, unknown>,
    new_value: { is_deleted: true },
    ...auditMetadata,
  });
};
