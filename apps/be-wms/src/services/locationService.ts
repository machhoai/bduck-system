import { AuditAction, LocationStatus } from "@bduck/shared-types";
import { randomUUID } from "crypto";
import type { WarehouseLocation } from "@bduck/shared-types";
import type { z } from "zod";
import { locationRepository } from "../repositories/locationRepository.js";
import { createLocationSchema } from "../utils/zodSchemas.js";
import { logAudit } from "./auditService.js";
import { fetchWarehouseById } from "./warehouseService.js";
import {
  canSetLocationQuarantine,
  type RequestUserContext,
} from "./warehouseAccess.js";

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
  user: RequestUserContext,
) => {
  if (status !== LocationStatus.QUARANTINE) return;
  if (canSetLocationQuarantine(user)) return;

  throw {
    statusCode: 403,
    messages: {
      vi: "Chỉ ADMIN hoặc WAREHOUSE_MANAGER được chuyển vị trí sang QUARANTINE.",
      zh: "只有管理员或仓库经理可以将库位设置为隔离状态。",
    },
  };
};

export const createLocation = async (
  input: CreateLocationInput,
  user: RequestUserContext,
): Promise<WarehouseLocation> => {
  await fetchWarehouseById(input.warehouse_id);
  assertCanUseStatus(input.status as LocationStatus, user);

  const existingCode = await locationRepository.findByWarehouseAndCode(
    input.warehouse_id,
    input.code,
  );
  if (existingCode) {
    throw {
      statusCode: 409,
      messages: {
        vi: `Mã vị trí "${input.code}" đã tồn tại trong kho này.`,
        zh: `库位代码 "${input.code}" 已在此仓库中存在。`,
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
  } as any);

  await logAudit({
    entity_type: "warehouse_locations",
    entity_id: id,
    action: AuditAction.CREATE,
    user_id: user.id,
    old_value: null,
    new_value: location as unknown as Record<string, unknown>,
  });

  return location;
};

export const fetchLocations = async (
  warehouseId?: string,
): Promise<WarehouseLocation[]> => {
  if (!warehouseId) {
    return locationRepository.findAll(false);
  }

  await fetchWarehouseById(warehouseId);
  return locationRepository.findByWarehouseId(warehouseId);
};

export const fetchLocationById = async (
  id: string,
): Promise<WarehouseLocation> => {
  const location = await locationRepository.findById(id);
  if (!location || location.is_deleted) {
    throw notFoundError;
  }

  return location;
};

export const updateLocation = async (
  id: string,
  input: UpdateLocationInput,
  user: RequestUserContext,
): Promise<void> => {
  const existing = await fetchLocationById(id);
  const nextWarehouseId = input.warehouse_id || existing.warehouse_id;

  if (input.warehouse_id && input.warehouse_id !== existing.warehouse_id) {
    await fetchWarehouseById(input.warehouse_id);
  }

  assertCanUseStatus(input.status as LocationStatus | undefined, user);

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
          vi: `Mã vị trí "${input.code}" đã tồn tại trong kho này.`,
          zh: `库位代码 "${input.code}" 已在此仓库中存在。`,
        },
      };
    }
  }

  await locationRepository.update(id, input as any);

  await logAudit({
    entity_type: "warehouse_locations",
    entity_id: id,
    action:
      input.status === LocationStatus.QUARANTINE
        ? AuditAction.QUARANTINE
        : AuditAction.UPDATE,
    user_id: user.id,
    old_value: existing as unknown as Record<string, unknown>,
    new_value: input as unknown as Record<string, unknown>,
  });
};

export const deleteLocation = async (
  id: string,
  userId: string,
): Promise<void> => {
  const existing = await fetchLocationById(id);

  const hasInventory = await locationRepository.hasPositiveInventory(id);
  if (hasInventory) {
    throw {
      statusCode: 400,
      messages: {
        vi: "Không thể xóa vị trí còn tồn kho dương.",
        zh: "无法删除仍有库存数量的库位。",
      },
    };
  }

  await locationRepository.softDelete(id);

  await logAudit({
    entity_type: "warehouse_locations",
    entity_id: id,
    action: AuditAction.SOFT_DELETE,
    user_id: userId,
    old_value: existing as unknown as Record<string, unknown>,
    new_value: { is_deleted: true },
  });
};
