import {
  AuditAction,
  calculateInventoryTotalQuantity,
  type Inventory,
} from "@bduck/shared-types";
import { randomUUID } from "crypto";
import type { z } from "zod";
import * as inventoryRepository from "../repositories/inventoryRepository.js";
import {
  createInventorySchema,
  updateInventorySchema,
} from "../utils/zodSchemas.js";
import { logAudit, type AuditMetadata } from "./auditService.js";
import type { AuthorizationService } from "./authorization/index.js";
import { loadLocationById } from "./locationService.js";
import { assertFacilityRelationship } from "./facilityRelationshipPolicy.js";

export { deductAtp, upsertStock } from "./inventoryTransactionService.js";

type CreateInventoryInput = z.infer<typeof createInventorySchema>;
type UpdateInventoryInput = z.infer<typeof updateInventorySchema>;
type InventoryFilters = {
  warehouse_id?: string;
  warehouse_location_id?: string;
  product_id?: string;
};

const notFoundError = {
  statusCode: 404,
  messages: {
    vi: "Bản ghi tồn kho không tồn tại.",
    zh: "库存记录不存在。",
  },
};

export const loadInventoryById = async (id: string): Promise<Inventory> => {
  const record = await inventoryRepository.findById(id);
  if (!record || record.is_deleted) throw notFoundError;
  return record;
};

export const fetchInventory = async (
  filters: InventoryFilters,
  authorization: AuthorizationService,
): Promise<Inventory[]> => {
  if (filters.warehouse_id) {
    authorization.assert("inventory.read", filters.warehouse_id);
    return inventoryRepository.findAll(filters);
  }
  return inventoryRepository.findAllScoped(filters, {
    isSystemAdmin: authorization.context.isSystemAdmin,
    facilityIds: authorization.facilityIdsFor("inventory.read"),
  });
};

export const fetchInventoryById = async (
  id: string,
  authorization: AuthorizationService,
): Promise<Inventory> => {
  const record = await loadInventoryById(id);
  authorization.assert("inventory.read", record.warehouse_id);
  return record;
};

export const createInventory = async (
  input: CreateInventoryInput,
  userId: string,
  authorization: AuthorizationService,
  auditMetadata?: AuditMetadata,
): Promise<Inventory> => {
  authorization.assert("inventory.write", input.warehouse_id);
  const location = await loadLocationById(input.warehouse_location_id);
  assertFacilityRelationship(input.warehouse_id, location.warehouse_id);
  if (
    await inventoryRepository.findByLocationAndProduct(
      input.warehouse_location_id,
      input.product_id,
    )
  ) {
    throw {
      statusCode: 409,
      messages: {
        vi: "Đã tồn tại bản ghi tồn kho cho vị trí và sản phẩm này.",
        zh: "该库位和产品的库存记录已存在。",
      },
    };
  }

  const id = randomUUID();
  const record = await inventoryRepository.create(id, {
    id,
    warehouse_id: input.warehouse_id,
    warehouse_location_id: input.warehouse_location_id,
    product_id: input.product_id,
    atp_quantity: input.atp_quantity,
    on_hold_quantity: input.on_hold_quantity,
    in_transit_quantity: input.in_transit_quantity,
    quarantine_quantity: input.quarantine_quantity,
    total_quantity: calculateInventoryTotalQuantity(input),
    last_count_at: null,
  });
  await logAudit({
    entity_type: "inventory",
    entity_id: id,
    warehouse_id: input.warehouse_id,
    action: AuditAction.CREATE,
    user_id: userId,
    old_value: null,
    new_value: record as unknown as Record<string, unknown>,
    ...auditMetadata,
  });
  return record;
};

export const updateInventory = async (
  id: string,
  input: UpdateInventoryInput,
  userId: string,
  authorization: AuthorizationService,
  auditMetadata?: AuditMetadata,
): Promise<void> => {
  const existing = await loadInventoryById(id);
  authorization.assert("inventory.write", existing.warehouse_id);
  const quantities = {
    atp_quantity: input.atp_quantity ?? existing.atp_quantity,
    on_hold_quantity: input.on_hold_quantity ?? existing.on_hold_quantity,
    in_transit_quantity:
      input.in_transit_quantity ?? existing.in_transit_quantity,
    quarantine_quantity:
      input.quarantine_quantity ?? existing.quarantine_quantity,
  };
  const totalQuantity = calculateInventoryTotalQuantity(quantities);
  await inventoryRepository.update(id, {
    ...quantities,
    total_quantity: totalQuantity,
  });
  await logAudit({
    entity_type: "inventory",
    entity_id: id,
    warehouse_id: existing.warehouse_id,
    action: AuditAction.UPDATE,
    user_id: userId,
    old_value: existing as unknown as Record<string, unknown>,
    new_value: { ...input, total_quantity: totalQuantity },
    ...auditMetadata,
  });
};

export const deleteInventory = async (
  id: string,
  userId: string,
  authorization: AuthorizationService,
  auditMetadata?: AuditMetadata,
): Promise<void> => {
  const existing = await loadInventoryById(id);
  authorization.assert("inventory.write", existing.warehouse_id);
  if (existing.total_quantity > 0) {
    throw {
      statusCode: 400,
      messages: {
        vi: "Không thể xóa bản ghi tồn kho khi số lượng còn lớn hơn 0.",
        zh: "库存数量大于 0 时无法删除库存记录。",
      },
    };
  }
  await inventoryRepository.softDelete(id);
  await logAudit({
    entity_type: "inventory",
    entity_id: id,
    warehouse_id: existing.warehouse_id,
    action: AuditAction.SOFT_DELETE,
    user_id: userId,
    old_value: existing as unknown as Record<string, unknown>,
    new_value: { is_deleted: true },
    ...auditMetadata,
  });
};
