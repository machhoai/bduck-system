import { AuditAction, type WarehouseLocationSlot } from "@bduck/shared-types";
import { randomUUID } from "crypto";
import type { z } from "zod";
import {
  locationSlotProductRepository,
  locationSlotRepository,
} from "../repositories/locationSlotRepository.js";
import {
  createLocationSlotSchema,
  updateLocationSlotSchema,
} from "../utils/zodSchemas.js";
import { logAudit, type AuditMetadata } from "./auditService.js";
import type { AuthorizationService } from "./authorization/index.js";
import { loadLocationById } from "./locationService.js";
import { assertFacilityRelationship } from "./facilityRelationshipPolicy.js";

type CreateSlotInput = z.infer<typeof createLocationSlotSchema>;
type UpdateSlotInput = z.infer<typeof updateLocationSlotSchema>;

const notFoundError = {
  statusCode: 404,
  messages: {
    vi: "Giá/vị trí con không tồn tại hoặc đã bị xóa.",
    zh: "子库位不存在或已被删除。",
  },
};

export const loadLocationSlotById = async (
  id: string,
): Promise<WarehouseLocationSlot> => {
  const slot = await locationSlotRepository.findById(id);
  if (!slot || slot.is_deleted) throw notFoundError;
  return slot;
};

export const fetchLocationSlots = async (
  filters: { warehouse_id?: string; warehouse_location_id?: string },
  authorization: AuthorizationService,
): Promise<WarehouseLocationSlot[]> => {
  if (filters.warehouse_location_id) {
    const location = await loadLocationById(filters.warehouse_location_id);
    authorization.assert("locations.read", location.warehouse_id);
    if (
      filters.warehouse_id &&
      filters.warehouse_id !== location.warehouse_id
    ) {
      throw notFoundError;
    }
    return locationSlotRepository.findByLocation(filters.warehouse_location_id);
  }
  if (filters.warehouse_id) {
    authorization.assert("locations.read", filters.warehouse_id);
    return locationSlotRepository.findByWarehouse(filters.warehouse_id);
  }
  return locationSlotRepository.findScoped({
    isSystemAdmin: authorization.context.isSystemAdmin,
    facilityIds: authorization.facilityIdsFor("locations.read"),
  });
};

export const fetchLocationSlotById = async (
  id: string,
  authorization: AuthorizationService,
): Promise<WarehouseLocationSlot> => {
  const slot = await loadLocationSlotById(id);
  authorization.assert("locations.read", slot.warehouse_id);
  return slot;
};

export const createLocationSlot = async (
  input: CreateSlotInput,
  userId: string,
  authorization: AuthorizationService,
  auditMetadata?: AuditMetadata,
): Promise<WarehouseLocationSlot> => {
  authorization.assert("locations.write", input.warehouse_id);
  const location = await loadLocationById(input.warehouse_location_id);
  assertFacilityRelationship(input.warehouse_id, location.warehouse_id);
  if (
    await locationSlotRepository.findByLocationAndCode(
      input.warehouse_location_id,
      input.code,
    )
  ) {
    throw {
      statusCode: 409,
      messages: {
        vi: "Mã giá đã tồn tại trong vị trí này.",
        zh: "该子库位代码已存在。",
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
  } as WarehouseLocationSlot);
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
  authorization: AuthorizationService,
  auditMetadata?: AuditMetadata,
): Promise<void> => {
  const existing = await loadLocationSlotById(id);
  authorization.assert("locations.write", existing.warehouse_id);
  const updateData = {
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.code !== undefined ? { code: input.code } : {}),
    ...(input.sort_order !== undefined ? { sort_order: input.sort_order } : {}),
    ...(input.description !== undefined
      ? { description: input.description ?? null }
      : {}),
    ...(input.is_active !== undefined ? { is_active: input.is_active } : {}),
  };
  if (input.code && input.code !== existing.code) {
    const owner = await locationSlotRepository.findByLocationAndCode(
      existing.warehouse_location_id,
      input.code,
    );
    if (owner && owner.id !== id) {
      throw {
        statusCode: 409,
        messages: {
          vi: "Mã giá đã tồn tại trong vị trí này.",
          zh: "该子库位代码已存在。",
        },
      };
    }
  }
  await locationSlotRepository.update(id, updateData);
  await logAudit({
    entity_type: "warehouse_location_slots",
    entity_id: id,
    warehouse_id: existing.warehouse_id,
    action: AuditAction.UPDATE,
    user_id: userId,
    old_value: existing as unknown as Record<string, unknown>,
    new_value: updateData,
    ...auditMetadata,
  });
};

export const deleteLocationSlot = async (
  id: string,
  userId: string,
  authorization: AuthorizationService,
  auditMetadata?: AuditMetadata,
): Promise<void> => {
  const existing = await loadLocationSlotById(id);
  authorization.assert("locations.write", existing.warehouse_id);
  const mappings = await locationSlotProductRepository.findByLocation(
    existing.warehouse_location_id,
  );
  if (mappings.some((mapping) => mapping.warehouse_location_slot_id === id)) {
    throw {
      statusCode: 400,
      messages: {
        vi: "Không thể xóa giá đang có sản phẩm được gán.",
        zh: "无法删除已分配产品的子库位。",
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
