import { AuditAction } from "@bduck/shared-types";
import type {
  WarehouseLocationSlot,
  WarehouseLocationSlotProduct,
} from "@bduck/shared-types";
import { randomUUID } from "crypto";
import type { z } from "zod";
import {
  locationSlotProductRepository,
  locationSlotRepository,
} from "../repositories/locationSlotRepository.js";
import {
  createLocationSlotSchema,
  updateLocationSlotSchema,
  upsertLocationSlotProductSchema,
} from "../utils/zodSchemas.js";
import { logAudit, type AuditMetadata } from "./auditService.js";
import { fetchLocationById } from "./locationService.js";
import { fetchProductById } from "./productService.js";

type CreateSlotInput = z.infer<typeof createLocationSlotSchema>;
type UpdateSlotInput = z.infer<typeof updateLocationSlotSchema>;
type UpsertSlotProductInput = z.infer<typeof upsertLocationSlotProductSchema>;

const notFoundError = {
  statusCode: 404,
  messages: {
    vi: "Giá»£i/vá»‹ trÃ­ con khÃ´ng tá»“n táº¡i hoáº·c Ä‘Ã£ bá»‹ xÃ³a.",
    zh: "å­åº“ä½ä¸å­˜åœ¨æˆ–å·²è¢«åˆ é™¤ã€‚",
  },
};

export const fetchLocationSlots = async (filters: {
  warehouse_id?: string;
  warehouse_location_id?: string;
}): Promise<WarehouseLocationSlot[]> => {
  if (filters.warehouse_location_id) {
    return locationSlotRepository.findByLocation(filters.warehouse_location_id);
  }
  if (filters.warehouse_id) {
    return locationSlotRepository.findByWarehouse(filters.warehouse_id);
  }
  return locationSlotRepository.findAll(false);
};

export const fetchLocationSlotById = async (
  id: string,
): Promise<WarehouseLocationSlot> => {
  const slot = await locationSlotRepository.findById(id);
  if (!slot || slot.is_deleted) throw notFoundError;
  return slot;
};

export const createLocationSlot = async (
  input: CreateSlotInput,
  userId: string,
  auditMetadata?: AuditMetadata,
): Promise<WarehouseLocationSlot> => {
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

  const codeOwner = await locationSlotRepository.findByLocationAndCode(
    input.warehouse_location_id,
    input.code,
  );
  if (codeOwner) {
    throw {
      statusCode: 409,
      messages: {
        vi: "MÃ£ giá»£i Ä‘Ã£ tá»“n táº¡i trong vá»‹ trÃ­ nÃ y.",
        zh: "è¯¥å­åº“ä½ä»£ç å·²å­˜åœ¨ã€‚",
      },
    };
  }

  const id = randomUUID();
  const slot = await locationSlotRepository.create(id, {
    id,
    warehouse_id: input.warehouse_id,
    warehouse_location_id: input.warehouse_location_id,
    name: input.name,
    code: input.code,
    sort_order: input.sort_order ?? 0,
    description: input.description ?? null,
    is_active: input.is_active ?? true,
  } as any);

  await logAudit({
    entity_type: "warehouse_location_slots",
    entity_id: id,
    warehouse_id: input.warehouse_id,
    action: AuditAction.CREATE,
    user_id: userId,
    old_value: null,
    new_value: slot as unknown as Record<string, unknown>,
    ...auditMetadata,
  });

  return slot;
};

export const updateLocationSlot = async (
  id: string,
  input: UpdateSlotInput,
  userId: string,
  auditMetadata?: AuditMetadata,
): Promise<void> => {
  const existing = await fetchLocationSlotById(id);

  if (input.code && input.code !== existing.code) {
    const codeOwner = await locationSlotRepository.findByLocationAndCode(
      existing.warehouse_location_id,
      input.code,
    );
    if (codeOwner && codeOwner.id !== id) {
      throw {
        statusCode: 409,
        messages: {
          vi: "MÃ£ giá»£i Ä‘Ã£ tá»“n táº¡i trong vá»‹ trÃ­ nÃ y.",
          zh: "è¯¥å­åº“ä½ä»£ç å·²å­˜åœ¨ã€‚",
        },
      };
    }
  }

  await locationSlotRepository.update(id, input as any);
  await logAudit({
    entity_type: "warehouse_location_slots",
    entity_id: id,
    warehouse_id: existing.warehouse_id,
    action: AuditAction.UPDATE,
    user_id: userId,
    old_value: existing as unknown as Record<string, unknown>,
    new_value: input as unknown as Record<string, unknown>,
    ...auditMetadata,
  });
};

export const deleteLocationSlot = async (
  id: string,
  userId: string,
  auditMetadata?: AuditMetadata,
): Promise<void> => {
  const existing = await fetchLocationSlotById(id);
  const mappings = await locationSlotProductRepository.findByLocation(
    existing.warehouse_location_id,
  );
  if (mappings.some((mapping) => mapping.warehouse_location_slot_id === id)) {
    throw {
      statusCode: 400,
      messages: {
        vi: "KhÃ´ng thá»ƒ xÃ³a giá»£i Ä‘ang cÃ³ sáº£n pháº©m Ä‘Æ°á»£c gÃ¡n.",
        zh: "æ— æ³•åˆ é™¤å·²åˆ†é…äº§å“çš„å­åº“ä½ã€‚",
      },
    };
  }

  await locationSlotRepository.softDelete(id);
  await logAudit({
    entity_type: "warehouse_location_slots",
    entity_id: id,
    warehouse_id: existing.warehouse_id,
    action: AuditAction.SOFT_DELETE,
    user_id: userId,
    old_value: existing as unknown as Record<string, unknown>,
    new_value: { is_deleted: true },
    ...auditMetadata,
  });
};

export const fetchLocationSlotProducts = async (filters: {
  warehouse_id?: string;
  warehouse_location_id?: string;
}): Promise<WarehouseLocationSlotProduct[]> => {
  if (filters.warehouse_location_id) {
    return locationSlotProductRepository.findByLocation(
      filters.warehouse_location_id,
    );
  }
  if (filters.warehouse_id) {
    return locationSlotProductRepository.findByWarehouse(filters.warehouse_id);
  }
  return locationSlotProductRepository.findAll(false);
};

export const upsertLocationSlotProduct = async (
  input: UpsertSlotProductInput,
  userId: string,
  auditMetadata?: AuditMetadata,
): Promise<WarehouseLocationSlotProduct> => {
  const [location, slot] = await Promise.all([
    fetchLocationById(input.warehouse_location_id),
    fetchLocationSlotById(input.warehouse_location_slot_id),
    fetchProductById(input.product_id),
  ]);

  if (
    location.warehouse_id !== input.warehouse_id ||
    slot.warehouse_id !== input.warehouse_id ||
    slot.warehouse_location_id !== input.warehouse_location_id
  ) {
    throw {
      statusCode: 400,
      messages: {
        vi: "Dá»¯ liá»‡u kho, vá»‹ trÃ­ vÃ  giá»£i khÃ´ng khá»›p nhau.",
        zh: "ä»“åº“ã€åº“ä½å’Œå­åº“ä½æ•°æ®ä¸åŒ¹é…ã€‚",
      },
    };
  }

  const existing = await locationSlotProductRepository.findByLocationAndProduct(
    input.warehouse_location_id,
    input.product_id,
  );

  if (existing) {
    await locationSlotProductRepository.update(existing.id, {
      warehouse_location_slot_id: input.warehouse_location_slot_id,
      display_order: input.display_order ?? existing.display_order,
      is_active: input.is_active ?? true,
    } as any);

    const next = {
      ...existing,
      warehouse_location_slot_id: input.warehouse_location_slot_id,
      display_order: input.display_order ?? existing.display_order,
      is_active: input.is_active ?? true,
    };

    await logAudit({
      entity_type: "warehouse_location_slot_products",
      entity_id: existing.id,
      warehouse_id: input.warehouse_id,
      action: AuditAction.UPDATE,
      user_id: userId,
      old_value: existing as unknown as Record<string, unknown>,
      new_value: next as unknown as Record<string, unknown>,
      ...auditMetadata,
    });

    return next;
  }

  const id = randomUUID();
  const mapping = await locationSlotProductRepository.create(id, {
    id,
    warehouse_id: input.warehouse_id,
    warehouse_location_id: input.warehouse_location_id,
    warehouse_location_slot_id: input.warehouse_location_slot_id,
    product_id: input.product_id,
    display_order: input.display_order ?? null,
    is_active: input.is_active ?? true,
  } as any);

  await logAudit({
    entity_type: "warehouse_location_slot_products",
    entity_id: id,
    warehouse_id: input.warehouse_id,
    action: AuditAction.CREATE,
    user_id: userId,
    old_value: null,
    new_value: mapping as unknown as Record<string, unknown>,
    ...auditMetadata,
  });

  return mapping;
};

export const deleteLocationSlotProduct = async (
  id: string,
  userId: string,
  auditMetadata?: AuditMetadata,
): Promise<void> => {
  const existing = await locationSlotProductRepository.findById(id);
  if (!existing || existing.is_deleted) throw notFoundError;

  await locationSlotProductRepository.softDelete(id);
  await logAudit({
    entity_type: "warehouse_location_slot_products",
    entity_id: id,
    warehouse_id: existing.warehouse_id,
    action: AuditAction.SOFT_DELETE,
    user_id: userId,
    old_value: existing as unknown as Record<string, unknown>,
    new_value: { is_deleted: true },
    ...auditMetadata,
  });
};
