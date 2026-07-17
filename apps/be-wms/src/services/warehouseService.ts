import {
  AuditAction,
  OFFICE_SCOPE_CONFIGS_COLLECTION,
  WarehouseType,
  type Warehouse,
} from "@bduck/shared-types";
import { randomUUID } from "crypto";
import type { z } from "zod";
import { db } from "../config/firebase.js";
import { warehouseRepository } from "../repositories/warehouseRepository.js";
import { locationRepository } from "../repositories/locationRepository.js";
import { createWarehouseSchema } from "../utils/zodSchemas.js";
import { logAudit, type AuditMetadata } from "./auditService.js";
import { fetchOrganizationById } from "./organizationService.js";
import {
  authorizationError,
  type AuthorizationService,
} from "./authorization/index.js";
import { rebuildAllActiveUserAccess } from "./userAccessRebuildService.js";
import { createInitialOfficeScopeConfig } from "./officeScopeAdministrationPolicy.js";

type CreateWarehouseInput = z.infer<typeof createWarehouseSchema>;
type UpdateWarehouseInput = Partial<CreateWarehouseInput>;

const notFoundError = {
  statusCode: 404,
  messages: {
    vi: "Kho không tồn tại hoặc đã bị xóa.",
    zh: "仓库不存在或已被删除。",
  },
};

const initializeOfficeScope = async (
  office: Warehouse,
  actorId: string,
  auditMetadata?: AuditMetadata,
): Promise<void> => {
  const actionTime = auditMetadata?.action_time ?? new Date();
  const syncTime = new Date();
  const config = createInitialOfficeScopeConfig({
    officeId: office.id,
    actorId,
    actionTime,
    syncTime,
  });
  const configRef = db
    .collection(OFFICE_SCOPE_CONFIGS_COLLECTION)
    .doc(office.id);
  const auditId = `${office.id}_scope_revision_1`;

  await db.runTransaction(async (transaction) => {
    const existing = await transaction.get(configRef);
    if (existing.exists) return;
    transaction.create(configRef, config);
    transaction.create(db.collection("audit_logs").doc(auditId), {
      id: auditId,
      entity_type: OFFICE_SCOPE_CONFIGS_COLLECTION,
      entity_id: office.id,
      warehouse_id: office.id,
      action: AuditAction.CREATE,
      user_id: actorId,
      user_name: null,
      entity_name: office.name,
      action_time: actionTime,
      sync_time: syncTime,
      old_value: null,
      new_value: {
        config,
        target_facility_ids: [],
        affected_employee_count: 0,
      },
      ip_address: auditMetadata?.ip_address ?? null,
      device_id: auditMetadata?.device_id ?? null,
      session_token: auditMetadata?.session_token ?? null,
      notes: "Initialize new office with an empty selected facility scope",
    });
  });
};

export const createWarehouse = async (
  input: CreateWarehouseInput,
  userId: string,
  authorization: AuthorizationService,
  auditMetadata?: AuditMetadata,
): Promise<Warehouse> => {
  if (!authorization.context.isSystemAdmin) {
    throw authorizationError("AUTHORIZATION_DENIED");
  }
  await fetchOrganizationById(input.organization_id);

  const existingCode = await warehouseRepository.findByCode(input.code);
  if (existingCode) {
    throw {
      statusCode: 409,
      messages: {
        vi: `Mã kho "${input.code}" đã tồn tại.`,
        zh: `仓库代码 "${input.code}" 已存在。`,
      },
    };
  }

  const id = randomUUID();
  const warehouse = await warehouseRepository.create(id, {
    id,
    organization_id: input.organization_id,
    name: input.name,
    code: input.code,
    type: input.type,
    address: input.address || null,
    manager_id: input.manager_id || null,
    status: input.status,
    warehouse_description: input.warehouse_description || null,
    warehouse_image_url: input.warehouse_image_url || null,
    coordinate: input.coordinate || null,
  } as any);

  if (warehouse.type === WarehouseType.OFFICE) {
    await initializeOfficeScope(warehouse, userId, auditMetadata);
  }

  await logAudit({
    entity_type: "warehouses",
    entity_id: id,
    warehouse_id: id,
    action: AuditAction.CREATE,
    user_id: userId,
    old_value: null,
    new_value: warehouse as unknown as Record<string, unknown>,
    ...auditMetadata,
  });
  await rebuildAllActiveUserAccess("FACILITY_CREATED", userId);

  return warehouse;
};

export const fetchWarehouses = async (
  authorization: AuthorizationService,
): Promise<Warehouse[]> => {
  return warehouseRepository.findWarehousesScoped({
    isSystemAdmin: authorization.context.isSystemAdmin,
    facilityIds: authorization.facilityIdsFor("warehouses.read"),
  });
};

export const loadWarehouseById = async (id: string): Promise<Warehouse> => {
  const warehouse = await warehouseRepository.findById(id);
  if (!warehouse || warehouse.is_deleted) {
    throw notFoundError;
  }

  return warehouse;
};

export const fetchWarehouseById = async (
  id: string,
  authorization: AuthorizationService,
): Promise<Warehouse> => {
  const warehouse = await loadWarehouseById(id);
  authorization.assert("warehouses.read", warehouse.id);
  return warehouse;
};

export const updateWarehouse = async (
  id: string,
  input: UpdateWarehouseInput,
  userId: string,
  authorization: AuthorizationService,
  auditMetadata?: AuditMetadata,
): Promise<void> => {
  const existing = await loadWarehouseById(id);
  authorization.assert("warehouses.write", existing.id);

  if (
    input.organization_id &&
    input.organization_id !== existing.organization_id
  ) {
    await fetchOrganizationById(input.organization_id);
  }

  if (input.code && input.code !== existing.code) {
    const codeOwner = await warehouseRepository.findByCode(input.code);
    if (codeOwner && codeOwner.id !== id) {
      throw {
        statusCode: 409,
        messages: {
          vi: `Mã kho "${input.code}" đã tồn tại.`,
          zh: `仓库代码 "${input.code}" 已存在。`,
        },
      };
    }
  }

  await warehouseRepository.update(id, input as any);

  await logAudit({
    entity_type: "warehouses",
    entity_id: id,
    warehouse_id: id,
    action: AuditAction.UPDATE,
    user_id: userId,
    old_value: existing as unknown as Record<string, unknown>,
    new_value: input as unknown as Record<string, unknown>,
    ...auditMetadata,
  });
  await rebuildAllActiveUserAccess("FACILITY_UPDATED", userId);
};

export const deleteWarehouse = async (
  id: string,
  userId: string,
  authorization: AuthorizationService,
  auditMetadata?: AuditMetadata,
): Promise<void> => {
  const existing = await loadWarehouseById(id);
  authorization.assert("warehouses.write", existing.id);

  const hasActiveLocations = await locationRepository.hasActiveLocations(id);
  if (hasActiveLocations) {
    throw {
      statusCode: 400,
      messages: {
        vi: "Không thể xóa kho còn vị trí ACTIVE. Hãy ngưng hoạt động hoặc xóa mềm vị trí trước.",
        zh: "无法删除仍有 ACTIVE 库位的仓库。请先停用或软删除库位。",
      },
    };
  }

  const hasInventory =
    await locationRepository.hasPositiveInventoryInWarehouse(id);
  if (hasInventory) {
    throw {
      statusCode: 400,
      messages: {
        vi: "Không thể xóa kho còn tồn kho dương.",
        zh: "无法删除仍有库存数量的仓库。",
      },
    };
  }

  await warehouseRepository.softDelete(id);

  await logAudit({
    entity_type: "warehouses",
    entity_id: id,
    warehouse_id: id,
    action: AuditAction.SOFT_DELETE,
    user_id: userId,
    old_value: existing as unknown as Record<string, unknown>,
    new_value: { is_deleted: true },
    ...auditMetadata,
  });
  await rebuildAllActiveUserAccess("FACILITY_SOFT_DELETED", userId);
};
