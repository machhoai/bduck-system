import { AuditAction } from "@bduck/shared-types";

import { categoryRepository } from "../repositories/categoryRepository.js";
import {
  findPartnerCategoryMapping,
  findPartnerWarehouseMapping,
  savePartnerCategoryMapping,
  savePartnerWarehouseMapping,
} from "../repositories/partnerInventoryRepository.js";

import type { AuditMetadata } from "./auditService.js";
import { logAudit } from "./auditService.js";
import type { AuthorizationService } from "./authorization/index.js";
import {
  fetchJoyWorldGiftTypes,
  fetchJoyWorldWarehouses,
  getPartnerInventoryCapability,
} from "./joyWorldInventoryClient.js";
import { loadWarehouseById } from "./warehouseService.js";

const ensureAnyPermission = (
  authorization: AuthorizationService,
  permission: string,
) => {
  if (authorization.context.isSystemAdmin) return;
  if (authorization.facilityIdsFor(permission).length === 0) {
    authorization.assert(permission, "");
  }
};

const ensureCategoryMappingPermission = (authorization: AuthorizationService) => {
  ensureAnyPermission(authorization, "partner_inventory.mapping.write");
  ensureAnyPermission(authorization, "category.update");
};

export const fetchPartnerInventoryMetadata = async () => {
  const [warehouses, giftTypes] = await Promise.all([
    fetchJoyWorldWarehouses(),
    fetchJoyWorldGiftTypes(),
  ]);
  return {
    capability: getPartnerInventoryCapability(),
    warehouses,
    gift_types: giftTypes,
  };
};

export const fetchWarehouseMapping = async (
  warehouseId: string,
  authorization: AuthorizationService,
) => {
  await loadWarehouseById(warehouseId);
  authorization.assert("partner_inventory.mapping.write", warehouseId);
  const capability = getPartnerInventoryCapability();
  return findPartnerWarehouseMapping(capability.connection_id, warehouseId);
};

export const updateWarehouseMapping = async (
  warehouseId: string,
  partnerStockId: string,
  actorId: string,
  authorization: AuthorizationService,
  auditMetadata?: AuditMetadata,
) => {
  const warehouse = await loadWarehouseById(warehouseId);
  authorization.assert("partner_inventory.mapping.write", warehouseId);
  const capability = getPartnerInventoryCapability();
  const options = await fetchJoyWorldWarehouses();
  const selected = options.find((item) => item.stock_id === partnerStockId);
  if (!selected) throw new Error("PARTNER_STOCK_NOT_FOUND");

  const result = await savePartnerWarehouseMapping({
    connectionId: capability.connection_id,
    warehouseId,
    partnerStockId,
    partnerStockName: selected.stock_name,
    actorId,
  });
  await logAudit({
    entity_type: "partner_warehouse_mappings",
    entity_id: result.after.id,
    entity_name: `${warehouse.name} → ${selected.stock_name}`,
    warehouse_id: warehouseId,
    action: result.before ? AuditAction.UPDATE : AuditAction.CREATE,
    user_id: actorId,
    old_value: result.before as unknown as Record<string, unknown> | null,
    new_value: result.after as unknown as Record<string, unknown>,
    ...auditMetadata,
  });
  return result.after;
};

export const fetchCategoryMapping = async (
  categoryId: string,
  authorization: AuthorizationService,
) => {
  ensureCategoryMappingPermission(authorization);
  const category = await categoryRepository.findById(categoryId);
  if (!category || category.is_deleted) throw new Error("CATEGORY_NOT_FOUND");
  const capability = getPartnerInventoryCapability();
  return findPartnerCategoryMapping(capability.connection_id, categoryId);
};

export const updateCategoryMapping = async (
  categoryId: string,
  partnerTypeId: string,
  actorId: string,
  authorization: AuthorizationService,
  auditMetadata?: AuditMetadata,
) => {
  ensureCategoryMappingPermission(authorization);
  const category = await categoryRepository.findById(categoryId);
  if (!category || category.is_deleted) throw new Error("CATEGORY_NOT_FOUND");
  const capability = getPartnerInventoryCapability();
  const options = await fetchJoyWorldGiftTypes();
  const selected = options.find((item) => item.type_id === partnerTypeId);
  if (!selected) throw new Error("PARTNER_GIFT_TYPE_NOT_FOUND");

  const result = await savePartnerCategoryMapping({
    connectionId: capability.connection_id,
    categoryId,
    partnerTypeId,
    partnerTypeName: selected.type_name,
    actorId,
  });
  await logAudit({
    entity_type: "partner_category_mappings",
    entity_id: result.after.id,
    entity_name: `${category.name} → ${selected.type_name}`,
    action: result.before ? AuditAction.UPDATE : AuditAction.CREATE,
    user_id: actorId,
    old_value: result.before as unknown as Record<string, unknown> | null,
    new_value: result.after as unknown as Record<string, unknown>,
    ...auditMetadata,
  });
  return result.after;
};
