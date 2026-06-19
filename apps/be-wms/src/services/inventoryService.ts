import {
  AuditAction,
  calculateInventoryTotalQuantity,
} from "@bduck/shared-types";
import type { Inventory } from "@bduck/shared-types";
import type { z } from "zod";
import { randomUUID } from "crypto";
import { db } from "../config/firebase.js";
import * as inventoryRepo from "../repositories/inventoryRepository.js";
import { logAudit, type AuditMetadata } from "./auditService.js";
import {
  createInventorySchema,
  updateInventorySchema,
} from "../utils/zodSchemas.js";

type CreateInventoryInput = z.infer<typeof createInventorySchema>;
type UpdateInventoryInput = z.infer<typeof updateInventorySchema>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const notFoundError = {
  statusCode: 404,
  messages: {
    vi: "Bản ghi tồn kho không tồn tại.",
    zh: "库存记录不存在。",
  },
};

// ---------------------------------------------------------------------------
// CRUD — Public API
// ---------------------------------------------------------------------------

/**
 * Create inventory record manually (Admin).
 * Enforces UNIQUE(warehouse_location_id, product_id).
 */
export const createInventory = async (
  input: CreateInventoryInput,
  userId: string,
  auditMetadata?: AuditMetadata,
): Promise<Inventory> => {
  // Unique check
  const existing = await inventoryRepo.findByLocationAndProduct(
    input.warehouse_location_id,
    input.product_id,
  );

  if (existing) {
    throw {
      statusCode: 409,
      messages: {
        vi: "Đã tồn tại bản ghi tồn kho cho vị trí và sản phẩm này.",
        zh: "该库位和产品的库存记录已存在。",
      },
    };
  }

  const id = randomUUID();
  const totalQty = calculateInventoryTotalQuantity({
    atp_quantity: input.atp_quantity,
    on_hold_quantity: input.on_hold_quantity,
    in_transit_quantity: input.in_transit_quantity,
    quarantine_quantity: input.quarantine_quantity,
  });

  const record = await inventoryRepo.create(id, {
    id,
    warehouse_id: input.warehouse_id,
    warehouse_location_id: input.warehouse_location_id,
    product_id: input.product_id,
    atp_quantity: input.atp_quantity,
    on_hold_quantity: input.on_hold_quantity,
    in_transit_quantity: input.in_transit_quantity,
    quarantine_quantity: input.quarantine_quantity,
    total_quantity: totalQty,
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

/**
 * Fetch inventory records with optional filters.
 */
export const fetchInventory = async (filters?: {
  warehouse_id?: string;
  warehouse_location_id?: string;
  product_id?: string;
}): Promise<Inventory[]> => {
  return inventoryRepo.findAll(filters);
};

/**
 * Fetch a single inventory record by ID.
 */
export const fetchInventoryById = async (id: string): Promise<Inventory> => {
  const record = await inventoryRepo.findById(id);
  if (!record) {
    throw notFoundError;
  }
  if ("is_deleted" in record && record.is_deleted) {
    throw notFoundError;
  }
  return record;
};

/**
 * Update inventory quantities (Admin manual adjustment).
 * Recalculates total_quantity automatically.
 */
export const updateInventory = async (
  id: string,
  input: UpdateInventoryInput,
  userId: string,
  auditMetadata?: AuditMetadata,
): Promise<void> => {
  const existing = await fetchInventoryById(id);

  const newAtp = input.atp_quantity ?? existing.atp_quantity;
  const newOnHold = input.on_hold_quantity ?? existing.on_hold_quantity;
  const newInTransit =
    input.in_transit_quantity ?? existing.in_transit_quantity;
  const newQuarantine =
    input.quarantine_quantity ?? existing.quarantine_quantity;

  const totalQty = calculateInventoryTotalQuantity({
    atp_quantity: newAtp,
    on_hold_quantity: newOnHold,
    in_transit_quantity: newInTransit,
    quarantine_quantity: newQuarantine,
  });

  await inventoryRepo.update(id, {
    atp_quantity: newAtp,
    on_hold_quantity: newOnHold,
    in_transit_quantity: newInTransit,
    quarantine_quantity: newQuarantine,
    total_quantity: totalQty,
  });

  await logAudit({
    entity_type: "inventory",
    entity_id: id,
    warehouse_id: existing.warehouse_id,
    action: AuditAction.UPDATE,
    user_id: userId,
    old_value: existing as unknown as Record<string, unknown>,
    new_value: { ...input, total_quantity: totalQty },
    ...auditMetadata,
  });
};

/**
 * Soft delete an inventory record.
 * Only allowed when all quantities are 0.
 */
export const deleteInventory = async (
  id: string,
  userId: string,
  auditMetadata?: AuditMetadata,
): Promise<void> => {
  const existing = await fetchInventoryById(id);

  if (existing.total_quantity > 0) {
    throw {
      statusCode: 400,
      messages: {
        vi: "Không thể xóa bản ghi tồn kho khi số lượng còn lớn hơn 0.",
        zh: "库存数量大于0时无法删除库存记录。",
      },
    };
  }

  await inventoryRepo.softDelete(id);

  await logAudit({
    entity_type: "inventory",
    entity_id: id,
    warehouse_id: existing.warehouse_id,
    action: AuditAction.SOFT_DELETE,
    user_id: userId,
    old_value: existing as unknown as Record<string, unknown>,
    new_value: null,
    ...auditMetadata,
  });
};

// ---------------------------------------------------------------------------
// Internal — Used by Import/Transfer/Export flows
// ---------------------------------------------------------------------------

/**
 * Upsert stock via transaction (used by import voucher COMPLETED, etc.).
 * Cộng dồn quantities into existing record or create new one.
 */
export const upsertStock = async (
  txn: FirebaseFirestore.Transaction,
  warehouseId: string,
  warehouseLocationId: string,
  productId: string,
  deltas: {
    atp_quantity?: number;
    on_hold_quantity?: number;
    in_transit_quantity?: number;
    quarantine_quantity?: number;
  },
): Promise<void> => {
  const newId = randomUUID();
  await inventoryRepo.upsertQuantityInTransaction(
    txn,
    warehouseId,
    warehouseLocationId,
    productId,
    deltas,
    newId,
  );
};

/**
 * Deduct ATP quantity. HARD BLOCK if result < 0.
 * Used by export/transfer flows.
 */
export const deductAtp = async (
  txn: FirebaseFirestore.Transaction,
  warehouseLocationId: string,
  productId: string,
  quantity: number,
): Promise<void> => {
  const collectionRef = db
    .collection("inventory")
    .where("warehouse_location_id", "==", warehouseLocationId)
    .where("product_id", "==", productId)
    .limit(5);

  const snapshot = await txn.get(collectionRef);
  // Filter out soft-deleted records client-side
  const activeDocs = snapshot.docs.filter((d) => d.data().is_deleted !== true);

  if (activeDocs.length === 0) {
    throw {
      statusCode: 400,
      messages: {
        vi: `Không tìm thấy tồn kho cho sản phẩm tại vị trí này.`,
        zh: `在该库位未找到该产品的库存记录。`,
      },
    };
  }

  const existing = activeDocs[0].data() as Inventory;
  const newAtp = existing.atp_quantity - quantity;

  if (newAtp < 0) {
    throw {
      statusCode: 400,
      messages: {
        vi: `Số lượng khả dụng (ATP) không đủ. Hiện tại: ${existing.atp_quantity}, Yêu cầu: ${quantity}.`,
        zh: `可用数量 (ATP) 不足。当前：${existing.atp_quantity}，请求：${quantity}。`,
      },
    };
  }

  const docRef = db.collection("inventory").doc(existing.id);
  const newTotal = calculateInventoryTotalQuantity({
    atp_quantity: newAtp,
    on_hold_quantity: existing.on_hold_quantity,
    in_transit_quantity: existing.in_transit_quantity,
    quarantine_quantity: existing.quarantine_quantity,
  });

  txn.update(docRef, {
    atp_quantity: newAtp,
    total_quantity: newTotal,
    last_updated_at: new Date(),
  });
};
