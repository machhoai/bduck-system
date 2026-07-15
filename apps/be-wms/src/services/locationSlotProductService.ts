import {
  AuditAction,
  type WarehouseLocationSlotProduct,
} from "@bduck/shared-types";
import { randomUUID } from "crypto";
import type { z } from "zod";
import { locationSlotProductRepository } from "../repositories/locationSlotRepository.js";
import { upsertLocationSlotProductSchema } from "../utils/zodSchemas.js";
import { logAudit, type AuditMetadata } from "./auditService.js";
import type { AuthorizationService } from "./authorization/index.js";
import { loadLocationById } from "./locationService.js";
import { loadLocationSlotById } from "./locationSlotService.js";
import { fetchProductById } from "./productService.js";
import {
  assertFacilityRelationship,
  assertLocationRelationship,
} from "./facilityRelationshipPolicy.js";

type UpsertInput = z.infer<typeof upsertLocationSlotProductSchema>;

const notFoundError = {
  statusCode: 404,
  messages: {
    vi: "Gán sản phẩm vào giá không tồn tại hoặc đã bị xóa.",
    zh: "子库位产品映射不存在或已被删除。",
  },
};

export const fetchLocationSlotProducts = async (
  filters: { warehouse_id?: string; warehouse_location_id?: string },
  authorization: AuthorizationService,
): Promise<WarehouseLocationSlotProduct[]> => {
  if (filters.warehouse_location_id) {
    const location = await loadLocationById(filters.warehouse_location_id);
    authorization.assert("locations.read", location.warehouse_id);
    if (
      filters.warehouse_id &&
      filters.warehouse_id !== location.warehouse_id
    ) {
      throw notFoundError;
    }
    return locationSlotProductRepository.findByLocation(
      filters.warehouse_location_id,
    );
  }
  if (filters.warehouse_id) {
    authorization.assert("locations.read", filters.warehouse_id);
    return locationSlotProductRepository.findByWarehouse(filters.warehouse_id);
  }
  return locationSlotProductRepository.findScoped({
    isSystemAdmin: authorization.context.isSystemAdmin,
    facilityIds: authorization.facilityIdsFor("locations.read"),
  });
};

export const upsertLocationSlotProduct = async (
  input: UpsertInput,
  userId: string,
  authorization: AuthorizationService,
  auditMetadata?: AuditMetadata,
): Promise<WarehouseLocationSlotProduct> => {
  authorization.assert("locations.write", input.warehouse_id);
  const [location, slot] = await Promise.all([
    loadLocationById(input.warehouse_location_id),
    loadLocationSlotById(input.warehouse_location_slot_id),
    fetchProductById(input.product_id),
  ]);
  assertFacilityRelationship(
    input.warehouse_id,
    location.warehouse_id,
    slot.warehouse_id,
  );
  assertLocationRelationship(
    input.warehouse_location_id,
    slot.warehouse_location_id,
  );

  const existing = await locationSlotProductRepository.findByLocationAndProduct(
    input.warehouse_location_id,
    input.product_id,
  );
  if (existing) {
    const next = {
      warehouse_location_slot_id: input.warehouse_location_slot_id,
      display_order: input.display_order ?? existing.display_order,
      is_active: input.is_active ?? true,
    };
    await locationSlotProductRepository.update(existing.id, next);
    await logAudit({
      entity_type: "warehouse_location_slot_products",
      entity_id: existing.id,
      warehouse_id: input.warehouse_id,
      action: AuditAction.UPDATE,
      user_id: userId,
      old_value: existing as unknown as Record<string, unknown>,
      new_value: next,
      ...auditMetadata,
    });
    return { ...existing, ...next };
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
  } as WarehouseLocationSlotProduct);
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
  authorization: AuthorizationService,
  auditMetadata?: AuditMetadata,
): Promise<void> => {
  const existing = await locationSlotProductRepository.findById(id);
  if (!existing || existing.is_deleted) throw notFoundError;
  authorization.assert("locations.write", existing.warehouse_id);
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
