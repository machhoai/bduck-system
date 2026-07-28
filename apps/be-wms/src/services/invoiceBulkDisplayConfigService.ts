import {
  AuditAction,
  type InvoiceBulkIssueDisplayConfig,
  type InvoiceSourceOrderLine,
} from "@bduck/shared-types";
import { invoiceOrderRepository } from "../repositories/invoiceOrderRepository.js";
import { meInvoiceConfigRepository } from "../repositories/meInvoiceConfigRepository.js";
import type { AuthorizationService } from "./authorization/index.js";
import { logAudit, type AuditMetadata } from "./auditService.js";
import { invoiceLineShouldAppearInIssuedInvoice } from "./invoiceLineVisibilityPolicy.js";
import { invoiceOrderShouldAppearInList } from "./invoiceOrderVisibilityPolicy.js";

interface DisplayMappings {
  item_name_mapping: Record<string, string>;
  item_unit_mapping: Record<string, string>;
  unit_name_mapping: Record<string, string>;
}

interface DisplayMappingInput {
  item_name_mapping: Record<string, string>;
  item_unit_mapping?: Record<string, string>;
  unit_name_mapping?: Record<string, string>;
}

const mappingFrom = (value: unknown): Record<string, string> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, string>)
    : {};

const sourceLines = (
  order: Record<string, unknown>,
): InvoiceSourceOrderLine[] => {
  if (Array.isArray(order.normalized_items)) {
    return order.normalized_items as InvoiceSourceOrderLine[];
  }
  return [];
};

const loadStoredConfig = async (warehouseId: string) => {
  const stored = await meInvoiceConfigRepository.getStoreConfig(warehouseId);
  if (!stored || stored.is_deleted === true) {
    throw {
      statusCode: 422,
      messages: {
        vi: "Cửa hàng chưa có cấu hình meInvoice.",
        zh: "门店尚未配置 meInvoice。",
      },
    };
  }
  return stored;
};

const buildDisplayConfig = async (
  warehouseId: string,
  businessDate: string,
  stored: Record<string, unknown>,
): Promise<InvoiceBulkIssueDisplayConfig> => {
  const orders = (
    await invoiceOrderRepository.listOrders(warehouseId, businessDate)
  ).filter(invoiceOrderShouldAppearInList);
  const lines = orders
    .flatMap(sourceLines)
    .filter(invoiceLineShouldAppearInIssuedInvoice);
  const itemNames = new Set<string>();
  const unitNames = new Set<string>();
  const itemUnits = new Map<string, string | null>();

  for (const line of lines) {
    const itemName = line.item_name?.trim();
    const unitName = line.unit_name?.trim() || null;
    if (itemName) {
      itemNames.add(itemName);
      if (!itemUnits.has(itemName) || (!itemUnits.get(itemName) && unitName)) {
        itemUnits.set(itemName, unitName);
      }
    }
    if (unitName) unitNames.add(unitName);
  }

  const products = [...itemUnits.entries()]
    .map(([item_name, unit_name]) => ({ item_name, unit_name }))
    .sort((left, right) => left.item_name.localeCompare(right.item_name, "vi"));
  const storedItemUnitMapping = mappingFrom(stored.item_unit_mapping);
  const legacyUnitMapping = mappingFrom(stored.unit_name_mapping);
  const itemUnitMapping = Object.fromEntries(
    products.flatMap((product) => {
      const configured =
        storedItemUnitMapping[product.item_name] ??
        (product.unit_name ? legacyUnitMapping[product.unit_name] : undefined);
      return configured ? [[product.item_name, configured]] : [];
    }),
  );

  return {
    warehouse_id: warehouseId,
    business_date: businessDate,
    products,
    item_names: [...itemNames].sort((left, right) =>
      left.localeCompare(right, "vi"),
    ),
    unit_names: [...unitNames].sort((left, right) =>
      left.localeCompare(right, "vi"),
    ),
    item_name_mapping: mappingFrom(stored.item_name_mapping),
    item_unit_mapping: itemUnitMapping,
    unit_name_mapping: legacyUnitMapping,
  };
};

export const getInvoiceBulkDisplayConfig = async (
  warehouseId: string,
  businessDate: string,
  authorization: AuthorizationService,
) => {
  authorization.assert("invoices.bulk_issue", warehouseId);
  const stored = await loadStoredConfig(warehouseId);
  return buildDisplayConfig(warehouseId, businessDate, stored);
};

export const saveInvoiceBulkDisplayConfig = async (
  warehouseId: string,
  businessDate: string,
  mappings: DisplayMappingInput & { action_time: Date },
  actorId: string,
  authorization: AuthorizationService,
  auditMetadata?: AuditMetadata,
) => {
  authorization.assert("invoices.bulk_issue", warehouseId);
  const stored = await loadStoredConfig(warehouseId);
  const previous: DisplayMappings = {
    item_name_mapping: mappingFrom(stored.item_name_mapping),
    item_unit_mapping: mappingFrom(stored.item_unit_mapping),
    unit_name_mapping: mappingFrom(stored.unit_name_mapping),
  };
  const now = new Date();
  const next: DisplayMappings = {
    item_name_mapping: mappings.item_name_mapping,
    item_unit_mapping: mappings.item_unit_mapping ?? previous.item_unit_mapping,
    unit_name_mapping: mappings.unit_name_mapping ?? previous.unit_name_mapping,
  };

  await meInvoiceConfigRepository.setStoreConfig(warehouseId, {
    ...next,
    updated_by: actorId,
    updated_at: now,
    action_time: mappings.action_time,
    sync_time: now,
  });
  await logAudit({
    entity_type: "MEINVOICE_BULK_DISPLAY_CONFIG",
    entity_id: warehouseId,
    warehouse_id: warehouseId,
    action: AuditAction.UPDATE,
    user_id: actorId,
    old_value: { ...previous },
    new_value: {
      ...next,
      action_time: mappings.action_time,
      sync_time: now,
    },
    notes: "Bulk invoice product name and per-product unit mappings updated",
    ...auditMetadata,
  });
  return buildDisplayConfig(warehouseId, businessDate, {
    ...stored,
    ...next,
  });
};
