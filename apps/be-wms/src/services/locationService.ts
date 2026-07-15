import {
  AuditAction,
  LocationStatus,
  type WarehouseLocation,
} from "@bduck/shared-types";
import { randomUUID } from "crypto";
import type { z } from "zod";
import { locationRepository } from "../repositories/locationRepository.js";
import { createLocationSchema } from "../utils/zodSchemas.js";
import { logAudit, type AuditMetadata } from "./auditService.js";
import type { AuthorizationService } from "./authorization/index.js";
import { loadWarehouseById } from "./warehouseService.js";

type CreateLocationInput = z.infer<typeof createLocationSchema>;
type UpdateLocationInput = Partial<CreateLocationInput>;

const notFoundError = {
  statusCode: 404,
  messages: {
    vi: "Vị trí kho không tồn tại hoặc đã bị xóa.",
    zh: "库位不存在或已被删除。",
  },
};

const assertCanUseStatus = (
  status: LocationStatus | undefined,
  warehouseId: string,
  authorization: AuthorizationService,
) => {
  if (status === LocationStatus.QUARANTINE) {
    authorization.assert("locations.quarantine", warehouseId);
  }
};

export const loadLocationById = async (
  id: string,
): Promise<WarehouseLocation> => {
  const location = await locationRepository.findById(id);
  if (!location || location.is_deleted) throw notFoundError;
  return location;
};

export const fetchLocations = async (
  authorization: AuthorizationService,
  warehouseId?: string,
): Promise<WarehouseLocation[]> => {
  if (warehouseId) {
    authorization.assert("locations.read", warehouseId);
    await loadWarehouseById(warehouseId);
    return locationRepository.findByWarehouseId(warehouseId);
  }
  return locationRepository.findScoped({
    isSystemAdmin: authorization.context.isSystemAdmin,
    facilityIds: authorization.facilityIdsFor("locations.read"),
  });
};

export const fetchLocationById = async (
  id: string,
  authorization: AuthorizationService,
): Promise<WarehouseLocation> => {
  const location = await loadLocationById(id);
  authorization.assert("locations.read", location.warehouse_id);
  return location;
};

export const createLocation = async (
  input: CreateLocationInput,
  userId: string,
  authorization: AuthorizationService,
  auditMetadata?: AuditMetadata,
): Promise<WarehouseLocation> => {
  authorization.assert("locations.write", input.warehouse_id);
  await loadWarehouseById(input.warehouse_id);
  assertCanUseStatus(
    input.status as LocationStatus,
    input.warehouse_id,
    authorization,
  );

  const existingCode = await locationRepository.findByWarehouseAndCode(
    input.warehouse_id,
    input.code,
  );
  if (existingCode) {
    throw {
      statusCode: 409,
      messages: {
        vi: `Mã vị trí "${input.code}" đã tồn tại trong cơ sở này.`,
        zh: `库位代码 "${input.code}" 已存在于该设施。`,
      },
    };
  }

  const id = randomUUID();
  const location = await locationRepository.create(id, {
    id,
    warehouse_id: input.warehouse_id,
    name: input.name,
    code: input.code,
    warehouse_location_description:
      input.warehouse_location_description || null,
    warehouse_location_image_url: input.warehouse_location_image_url || null,
    type: input.type,
    status: input.status,
  } as WarehouseLocation);

  await logAudit({
    entity_type: "warehouse_locations",
    entity_id: id,
    warehouse_id: input.warehouse_id,
    action: AuditAction.CREATE,
    user_id: userId,
    old_value: null,
    new_value: location as unknown as Record<string, unknown>,
    ...auditMetadata,
  });
  return location;
};

export const updateLocation = async (
  id: string,
  input: UpdateLocationInput,
  userId: string,
  authorization: AuthorizationService,
  auditMetadata?: AuditMetadata,
): Promise<void> => {
  const existing = await loadLocationById(id);
  const nextWarehouseId = input.warehouse_id || existing.warehouse_id;
  authorization.assert("locations.write", existing.warehouse_id);
  authorization.assert("locations.write", nextWarehouseId);

  if (nextWarehouseId !== existing.warehouse_id) {
    await loadWarehouseById(nextWarehouseId);
  }
  assertCanUseStatus(
    input.status as LocationStatus | undefined,
    nextWarehouseId,
    authorization,
  );

  if (
    input.code &&
    (input.code !== existing.code || nextWarehouseId !== existing.warehouse_id)
  ) {
    const codeOwner = await locationRepository.findByWarehouseAndCode(
      nextWarehouseId,
      input.code,
    );
    if (codeOwner && codeOwner.id !== id) {
      throw {
        statusCode: 409,
        messages: {
          vi: `Mã vị trí "${input.code}" đã tồn tại trong cơ sở này.`,
          zh: `库位代码 "${input.code}" 已存在于该设施。`,
        },
      };
    }
  }

  await locationRepository.update(id, input as Partial<WarehouseLocation>);
  await logAudit({
    entity_type: "warehouse_locations",
    entity_id: id,
    warehouse_id: nextWarehouseId,
    action:
      input.status === LocationStatus.QUARANTINE
        ? AuditAction.QUARANTINE
        : AuditAction.UPDATE,
    user_id: userId,
    old_value: existing as unknown as Record<string, unknown>,
    new_value: input as unknown as Record<string, unknown>,
    ...auditMetadata,
  });
};

export const deleteLocation = async (
  id: string,
  userId: string,
  authorization: AuthorizationService,
  auditMetadata?: AuditMetadata,
): Promise<void> => {
  const existing = await loadLocationById(id);
  authorization.assert("locations.write", existing.warehouse_id);
  if (await locationRepository.hasPositiveInventory(id)) {
    throw {
      statusCode: 400,
      messages: {
        vi: "Không thể xóa vị trí còn tồn kho dương.",
        zh: "无法删除仍有正库存的库位。",
      },
    };
  }

  await locationRepository.softDelete(id);
  await logAudit({
    entity_type: "warehouse_locations",
    entity_id: id,
    warehouse_id: existing.warehouse_id,
    action: AuditAction.SOFT_DELETE,
    user_id: userId,
    old_value: existing as unknown as Record<string, unknown>,
    new_value: { is_deleted: true },
    ...auditMetadata,
  });
};
