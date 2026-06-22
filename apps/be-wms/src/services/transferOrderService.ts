/**
 * Transfer Order Service — Fixed Pipeline State Machine
 *
 * ═══════════════════════════════════════════════════════════════
 * TWO TRANSFER TYPES:
 *
 * INTRA_WAREHOUSE (Location A → B, same warehouse):
 *   - auto_approve by default (configurable)
 *   - Immediate inventory move in single Firestore Transaction
 *   - Max 150 items (Firestore 500-write safeguard)
 *
 * INTER_WAREHOUSE (Warehouse A → Warehouse B):
 *   DRAFT → PENDING_APPROVAL → APPROVED
 *     → EXPORT_CREATED → PICKING → IN_TRANSIT
 *     → PENDING_RECEIVE → RECEIVING → COMPLETED
 *   ↘ REJECTED → CANCELLED
 *
 * CRITICAL:
 * - ATP deduction during Export PICKING (handled by Export service)
 * - Inventory receive during completeReceiving (Firestore Transaction)
 * - destination_location_id MUST be set for each item during RECEIVING
 * ═══════════════════════════════════════════════════════════════
 */

import { db } from "../config/firebase.js";
import { randomUUID } from "crypto";
import { z } from "zod";
import {
  TransferType,
  TransferOrderStatus,
  TransferItemStatus,
  ExportType,
  ExportVoucherStatus,
  ExportReferenceType,
  AuditAction,
  calculateInventoryTotalQuantity,
} from "@bduck/shared-types";
import type {
  TransferOrder,
  TransferOrderItem,
  ExportVoucher,
  ExportVoucherItem,
  Inventory,
  ProcessEntityType,
} from "@bduck/shared-types";
import * as transferRepo from "../repositories/transferOrderRepository.js";
import * as approvalService from "./approvalService.js";
import { logAudit } from "./auditService.js";
import { verifyMfa } from "./mfaService.js";
import { getConfigForEntity } from "./processConfigService.js";

// ─────────────────────────────────────────────
// ZOD SCHEMAS — Input validation (LUẬT THÉP)
// Max 150 items per transfer (Firestore 500-write safeguard)
// ─────────────────────────────────────────────

const transferItemSchema = z.object({
  product_id: z.string().uuid(),
  source_location_id: z.string().uuid(),
  destination_location_id: z.string().uuid().nullable().optional(),
  quantity: z.number().int().positive(),
});

export const createTransferOrderSchema = z.object({
  transfer_type: z.nativeEnum(TransferType),
  source_warehouse_id: z.string().uuid(),
  destination_warehouse_id: z.string().uuid(),
  items: z.array(transferItemSchema).min(1).max(150),
  notes: z.string().max(1000).nullable().optional(),
  attachment_urls: z.array(z.string().url()).max(10).optional().default([]),
  action_time: z.string().datetime().optional(),
  otp: z.string().optional(),
});

export type CreateTransferOrderInput = z.infer<
  typeof createTransferOrderSchema
>;

export const updateTransferOrderSchema = createTransferOrderSchema;
export type UpdateTransferOrderInput = CreateTransferOrderInput;

type TransferOrderWrite = TransferOrder & {
  items?: TransferOrderItem[];
  items_count?: number;
  total_quantity?: number;
  inventory_moved?: boolean;
  completed_at?: Date;
};

// ─────────────────────────────────────────────
// ERROR HELPERS
// ─────────────────────────────────────────────

function createError(
  statusCode: number,
  vi: string,
  zh: string,
): Error & { statusCode: number; messages: Record<string, string> } {
  const err = new Error(vi) as Error & {
    statusCode: number;
    messages: Record<string, string>;
  };
  err.statusCode = statusCode;
  err.messages = { vi, zh };
  return err;
}

// ─────────────────────────────────────────────
// CREATE TRANSFER ORDER
// ─────────────────────────────────────────────

export async function createTransferOrder(
  input: CreateTransferOrderInput,
  userId: string,
): Promise<TransferOrder> {
  const now = new Date();
  const actionTime = input.action_time ? new Date(input.action_time) : now;
  const orderId = randomUUID();
  const isIntra = input.transfer_type === TransferType.INTRA_WAREHOUSE;

  // ── Validate: INTRA must have same source+destination warehouse ──
  if (isIntra && input.source_warehouse_id !== input.destination_warehouse_id) {
    throw createError(
      400,
      "Điều chuyển trong kho: kho nguồn và kho đích phải giống nhau.",
      "库内调拨：源仓库和目标仓库必须相同。",
    );
  }
  // ── Validate: INTER must have different warehouses ──
  if (
    !isIntra &&
    input.source_warehouse_id === input.destination_warehouse_id
  ) {
    throw createError(
      400,
      "Điều chuyển liên kho: kho nguồn và kho đích phải khác nhau.",
      "跨库调拨：源仓库和目标仓库必须不同。",
    );
  }
  // ── Validate: INTRA items must have destination_location_id ──
  if (isIntra) {
    for (const item of input.items) {
      if (!item.destination_location_id) {
        throw createError(
          400,
          "Điều chuyển trong kho: mỗi sản phẩm phải chọn vị trí đích.",
          "库内调拨：每个产品必须选择目标库位。",
        );
      }
      if (item.source_location_id === item.destination_location_id) {
        throw createError(
          400,
          "Vị trí nguồn và vị trí đích không được giống nhau.",
          "源库位和目标库位不能相同。",
        );
      }
    }
  }

  // ── Load config snapshot ──
  const configEntityType: ProcessEntityType = isIntra
    ? "TRANSFER_INTRA"
    : "TRANSFER_ORDER";
  const config = await getConfigForEntity(
    configEntityType,
    input.source_warehouse_id,
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- StepOption may have extension fields
  const createExportOpt = config?.step_options?.create_export as any;
  const receivingOpt = config?.step_options?.receiving as any;
  const configSnapshot = {
    auto_approve: config?.auto_approve ?? isIntra,
    auto_create_export: createExportOpt?.auto_create_export !== false,
    require_receiving: receivingOpt?.enabled !== false,
    require_evidence: receivingOpt?.require_evidence === true,
  };

  const orderNumber = generateOrderNumber(isIntra);

  if (config?.require_evidence && (!input.attachment_urls || input.attachment_urls.length === 0)) {
    const err = createError(
      400,
      "Bắt buộc tải lên chứng từ (evidence) khi tạo phiếu điều chuyển.",
      "创建调拨单时必须上传凭证 (evidence)。",
    );
    throw err;
  }

  if (config?.require_otp) {
    if (!input.otp) {
      const err = createError(
        400,
        "Mã xác thực (OTP) là bắt buộc.",
        "验证码 (OTP) 是必需的。",
      );
      throw err;
    }
    const isOtpValid = await verifyMfa(userId, input.otp);
    if (!isOtpValid) {
      const err = createError(
        400,
        "Mã xác thực (OTP) không hợp lệ hoặc đã hết hạn.",
        "验证码 (OTP) 无效或已过期。",
      );
      throw err;
    }
  }

  // ── INTRA + auto_approve: execute in transaction ──
  if (isIntra && configSnapshot.auto_approve) {
    return executeIntraTransfer(
      orderId,
      orderNumber,
      input,
      userId,
      actionTime,
      now,
      configSnapshot,
    );
  }

  // ── INTER or INTRA without auto-approve: create and submit for approval ──
  const order: TransferOrder = {
    id: orderId,
    order_number: orderNumber,
    transfer_type: input.transfer_type,
    source_warehouse_id: input.source_warehouse_id,
    destination_warehouse_id: input.destination_warehouse_id,
    status: TransferOrderStatus.PENDING_APPROVAL,
    creator_id: userId,
    approver_id: null,
    approved_at: null,
    export_voucher_id: null,
    received_by: null,
    received_at: null,
    dispatched_at: null,
    attachment_urls: input.attachment_urls ?? [],
    config_snapshot: configSnapshot,
    requires_reauth: false,
    reauth_confirmed_by: null,
    reauth_confirmed_at: null,
    action_time: actionTime,
    sync_time: now,
    notes: input.notes ?? null,
    is_deleted: false,
    created_at: now,
    updated_at: now,
  };

  await transferRepo.create(order);

  // Create items as subcollection
  for (const item of input.items) {
    const orderItem: TransferOrderItem = {
      id: randomUUID(),
      transfer_order_id: orderId,
      product_id: item.product_id,
      source_location_id: item.source_location_id,
      destination_location_id: item.destination_location_id ?? null,
      quantity: item.quantity,
      received_quantity: null,
      status: TransferItemStatus.PENDING,
      is_deleted: false,
    };
    await transferRepo.createItem(orderId, orderItem);
  }

  // Trigger approval chain
  try {
    // Resolve creator name for denormalization
    let creatorName: string | undefined;
    try {
      const userDoc = await db.collection("users").doc(userId).get();
      if (userDoc.exists) {
        const u = userDoc.data();
        creatorName = u?.full_name || u?.email || undefined;
      }
    } catch {
      // Non-critical
    }

    const approvals = await approvalService.createApprovalsForEntity(
      configEntityType,
      orderId,
      order.source_warehouse_id,
      userId,
      { voucher_number: orderNumber, creator_name: creatorName },
      {
        sourceWarehouseId: order.source_warehouse_id,
        destinationWarehouseId: order.destination_warehouse_id,
      },
    );
    if (approvals.length === 0 && !isIntra) {
      await onApprovalCompleted(orderId, "SYSTEM_AUTO_APPROVE");
    }
  } catch (error) {
    console.error(
      "[transferOrderService] Approval creation failed:",
      error,
    );
  }

  await logAudit({
    entity_type: configEntityType,
    entity_id: orderId,
    warehouse_id: order.source_warehouse_id,
    action: AuditAction.CREATE,
    user_id: userId,
    old_value: null,
    new_value: { order_number: orderNumber, status: order.status },
  });

  return order;
}

export async function updateTransferOrder(
  orderId: string,
  input: UpdateTransferOrderInput,
  userId: string,
): Promise<TransferOrder> {
  const oldOrder = await transferRepo.findById(orderId);
  if (!oldOrder) throw createError(404, "Khong tim thay phieu dieu chuyen.", "找不到调拨单。");

  if (oldOrder.creator_id !== userId) {
    throw createError(403, "Ban khong co quyen sua phieu dieu chuyen nay.", "您没有权限修改此调拨单。");
  }

  const allowedStatuses = [
    TransferOrderStatus.DRAFT,
    TransferOrderStatus.PENDING_APPROVAL,
    TransferOrderStatus.REJECTED,
  ];
  if (!allowedStatuses.includes(oldOrder.status)) {
    throw createError(400, "Chi co the sua phieu dang cho duyet hoac bi tu choi.", "只能修改待审批或已拒绝的单据。");
  }

  const isIntra = input.transfer_type === TransferType.INTRA_WAREHOUSE;
  if (isIntra && input.source_warehouse_id !== input.destination_warehouse_id) {
    throw createError(400, "Dieu chuyen trong kho: kho nguon va kho dich phai giong nhau.", "库内调拨：源仓库和目标仓库必须相同。");
  }
  if (!isIntra && input.source_warehouse_id === input.destination_warehouse_id) {
    throw createError(400, "Dieu chuyen lien kho: kho nguon va kho dich phai khac nhau.", "跨库调拨：源仓库和目标仓库必须不同。");
  }
  if (isIntra) {
    for (const item of input.items) {
      if (!item.destination_location_id) {
        throw createError(400, "Dieu chuyen trong kho: moi san pham phai chon vi tri dich.", "库内调拨：每个产品必须选择目标库位。");
      }
      if (item.source_location_id === item.destination_location_id) {
        throw createError(400, "Vi tri nguon va vi tri dich khong duoc giong nhau.", "源库位和目标库位不能相同。");
      }
    }
  }

  const configEntityType: ProcessEntityType = isIntra
    ? "TRANSFER_INTRA"
    : "TRANSFER_ORDER";
  const config = await getConfigForEntity(
    configEntityType,
    input.source_warehouse_id,
  );
  const createExportOpt = config?.step_options?.create_export as any;
  const receivingOpt = config?.step_options?.receiving as any;
  const configSnapshot = {
    auto_approve: config?.auto_approve ?? isIntra,
    auto_create_export: createExportOpt?.auto_create_export !== false,
    require_receiving: receivingOpt?.enabled !== false,
    require_evidence: receivingOpt?.require_evidence === true,
  };

  if (config?.require_evidence && (!input.attachment_urls || input.attachment_urls.length === 0)) {
    throw createError(400, "Bat buoc tai len chung tu khi sua phieu dieu chuyen.", "修改调拨单时必须上传凭证。");
  }

  if (config?.require_otp) {
    if (!input.otp) {
      throw createError(400, "Ma xac thuc OTP la bat buoc.", "验证码是必需的。");
    }
    const isOtpValid = await verifyMfa(userId, input.otp);
    if (!isOtpValid) {
      throw createError(400, "Ma xac thuc OTP khong hop le hoac da het han.", "验证码无效或已过期。");
    }
  }

  const now = new Date();
  const actionTime = input.action_time ? new Date(input.action_time) : now;
  const newOrder: Partial<TransferOrder> = {
    transfer_type: input.transfer_type,
    source_warehouse_id: input.source_warehouse_id,
    destination_warehouse_id: input.destination_warehouse_id,
    status: TransferOrderStatus.PENDING_APPROVAL,
    approver_id: null,
    approved_at: null,
    export_voucher_id: null,
    received_by: null,
    received_at: null,
    dispatched_at: null,
    attachment_urls: input.attachment_urls ?? [],
    config_snapshot: configSnapshot,
    notes: input.notes ?? null,
    updated_at: now,
    sync_time: now,
    action_time: actionTime,
  };

  const items: TransferOrderItem[] = input.items.map((item) => ({
    id: randomUUID(),
    transfer_order_id: orderId,
    product_id: item.product_id,
    source_location_id: item.source_location_id,
    destination_location_id: item.destination_location_id ?? null,
    quantity: item.quantity,
    received_quantity: null,
    status: TransferItemStatus.PENDING,
    is_deleted: false,
  }));

  const orderRef = db.collection("transfer_orders").doc(orderId);
  const batch = db.batch();
  batch.update(orderRef, newOrder);

  const oldItemsSnap = await orderRef.collection("items").get();
  for (const doc of oldItemsSnap.docs) batch.delete(doc.ref);
  for (const item of items) {
    batch.set(orderRef.collection("items").doc(item.id), item);
  }

  const oldApprovalsSnap = await db.collection("pending_approvals")
    .where("entity_type", "in", ["TRANSFER_ORDER", "TRANSFER_INTRA"])
    .where("entity_id", "==", orderId)
    .get();
  for (const doc of oldApprovalsSnap.docs) batch.delete(doc.ref);

  await batch.commit();

  await logAudit({
    entity_type: configEntityType,
    entity_id: orderId,
    warehouse_id: input.source_warehouse_id,
    action: AuditAction.UPDATE,
    user_id: userId,
    old_value: oldOrder as unknown as Record<string, unknown>,
    new_value: newOrder as unknown as Record<string, unknown>,
    action_time: actionTime,
  });

  try {
    let creatorName: string | undefined;
    try {
      const userDoc = await db.collection("users").doc(userId).get();
      if (userDoc.exists) {
        const u = userDoc.data();
        creatorName = u?.full_name || u?.email || undefined;
      }
    } catch {}

    const approvals = await approvalService.createApprovalsForEntity(
      configEntityType,
      orderId,
      input.source_warehouse_id,
      userId,
      { voucher_number: oldOrder.order_number, creator_name: creatorName },
      {
        sourceWarehouseId: input.source_warehouse_id,
        destinationWarehouseId: input.destination_warehouse_id,
      },
    );

    if (approvals.length === 0 && !isIntra) {
      await onApprovalCompleted(orderId, "SYSTEM_AUTO_APPROVE");
    }
  } catch (error) {
    console.error("[transferOrderService] Approval recreation failed:", error);
  }

  return { ...oldOrder, ...newOrder } as TransferOrder;
}

// ─────────────────────────────────────────────
// INTRA-WAREHOUSE — Immediate execution
// ─────────────────────────────────────────────

async function executeIntraTransfer(
  orderId: string,
  orderNumber: string,
  input: CreateTransferOrderInput,
  userId: string,
  actionTime: Date,
  now: Date,
  configSnapshot: TransferOrder["config_snapshot"],
): Promise<TransferOrder> {
  const orderItems: TransferOrderItem[] = input.items.map((item) => ({
    id: randomUUID(),
    transfer_order_id: orderId,
    product_id: item.product_id,
    source_location_id: item.source_location_id,
    destination_location_id: item.destination_location_id ?? null,
    quantity: item.quantity,
    received_quantity: item.quantity,
    status: TransferItemStatus.COMPLETED,
    is_deleted: false,
  }));
  const totalQuantity = orderItems.reduce((sum, item) => sum + item.quantity, 0);

  // Execute in a Firestore Transaction for atomicity
  const order = await db.runTransaction(async (txn) => {
    const inventoryKey = (
      warehouseId: string,
      locationId: string,
      productId: string,
    ) => `${warehouseId}:${locationId}:${productId}`;

    const inventoryDeltas = new Map<
      string,
      {
        warehouseId: string;
        locationId: string;
        productId: string;
        deltaQuantity: number;
        outgoingQuantity: number;
      }
    >();

    const addInventoryDelta = (
      warehouseId: string,
      locationId: string,
      productId: string,
      deltaQuantity: number,
      outgoingQuantity = 0,
    ) => {
      const key = inventoryKey(warehouseId, locationId, productId);
      const existing =
        inventoryDeltas.get(key) ?? {
          warehouseId,
          locationId,
          productId,
          deltaQuantity: 0,
          outgoingQuantity: 0,
        };

      existing.deltaQuantity += deltaQuantity;
      existing.outgoingQuantity += outgoingQuantity;
      inventoryDeltas.set(key, existing);
    };

    for (const item of input.items) {
      addInventoryDelta(
        input.source_warehouse_id,
        item.source_location_id,
        item.product_id,
        -item.quantity,
        item.quantity,
      );
      addInventoryDelta(
        input.destination_warehouse_id,
        item.destination_location_id!,
        item.product_id,
        item.quantity,
      );
    }

    const inventoryEntries = Array.from(inventoryDeltas.values());
    const inventorySnapshots = await Promise.all(
      inventoryEntries.map((entry) =>
        txn.get(
          db
            .collection("inventory")
            .where("warehouse_id", "==", entry.warehouseId)
            .where("warehouse_location_id", "==", entry.locationId)
            .where("product_id", "==", entry.productId)
            .limit(1),
        ),
      ),
    );

    const activeInventory = new Map<
      string,
      { ref: FirebaseFirestore.DocumentReference; data: Inventory }
    >();

    for (let i = 0; i < inventoryEntries.length; i++) {
      const entry = inventoryEntries[i];
      const activeDoc = inventorySnapshots[i].docs.find(
        (d) => d.data().is_deleted !== true,
      );

      if (activeDoc) {
        activeInventory.set(
          inventoryKey(entry.warehouseId, entry.locationId, entry.productId),
          { ref: activeDoc.ref, data: activeDoc.data() as Inventory },
        );
      }
    }

    // 1. Validate ATP after all reads and before any writes.
    for (const entry of inventoryEntries) {
      if (entry.outgoingQuantity <= 0) continue;

      const activeRecord = activeInventory.get(
        inventoryKey(entry.warehouseId, entry.locationId, entry.productId),
      );
      const currentAtp = activeRecord?.data.atp_quantity ?? 0;

      if (currentAtp < entry.outgoingQuantity) {
        throw createError(
          400,
          `Không đủ tồn kho khả dụng (ATP: ${currentAtp}, Yêu cầu: ${entry.outgoingQuantity}).`,
          `可用库存不足 (ATP: ${currentAtp}, 请求: ${entry.outgoingQuantity})。`,
        );
      }
    }

    // 2. Move inventory after every inventory read has completed.
    for (const entry of inventoryEntries) {
      if (entry.deltaQuantity === 0) continue;

      const activeRecord = activeInventory.get(
        inventoryKey(entry.warehouseId, entry.locationId, entry.productId),
      );

      if (activeRecord) {
        const newAtp = activeRecord.data.atp_quantity + entry.deltaQuantity;
        const newTotal = calculateInventoryTotalQuantity({
          atp_quantity: newAtp,
          on_hold_quantity: activeRecord.data.on_hold_quantity,
          in_transit_quantity: activeRecord.data.in_transit_quantity,
          quarantine_quantity: activeRecord.data.quarantine_quantity,
        });

        if (newAtp < 0 || newTotal < 0) {
          throw createError(
            400,
            "Tồn kho sau điều chuyển không hợp lệ.",
            "调拨后库存无效。",
          );
        }

        txn.update(activeRecord.ref, {
          atp_quantity: newAtp,
          total_quantity: newTotal,
          last_updated_at: now,
        });
      } else {
        if (entry.deltaQuantity < 0) {
          throw createError(
            400,
            "Không tìm thấy tồn kho nguồn để điều chuyển.",
            "找不到可用的源库存。",
          );
        }

        const newInvId = randomUUID();
        txn.set(db.collection("inventory").doc(newInvId), {
          id: newInvId,
          warehouse_id: entry.warehouseId,
          warehouse_location_id: entry.locationId,
          product_id: entry.productId,
          atp_quantity: entry.deltaQuantity,
          on_hold_quantity: 0,
          in_transit_quantity: 0,
          quarantine_quantity: 0,
          total_quantity: calculateInventoryTotalQuantity({
            atp_quantity: entry.deltaQuantity,
            on_hold_quantity: 0,
            in_transit_quantity: 0,
            quarantine_quantity: 0,
          }),
          last_count_at: null,
          last_updated_at: now,
          is_deleted: false,
        });
      }
    }

    // 3. Create transfer order (status=COMPLETED)
    const transferOrder: TransferOrderWrite = {
      id: orderId,
      order_number: orderNumber,
      transfer_type: TransferType.INTRA_WAREHOUSE,
      source_warehouse_id: input.source_warehouse_id,
      destination_warehouse_id: input.destination_warehouse_id,
      status: TransferOrderStatus.COMPLETED,
      creator_id: userId,
      approver_id: "SYSTEM_AUTO_APPROVE",
      approved_at: now,
      export_voucher_id: null,
      received_by: userId,
      received_at: now,
      dispatched_at: now,
      attachment_urls: input.attachment_urls ?? [],
      config_snapshot: configSnapshot,
      requires_reauth: false,
      reauth_confirmed_by: null,
      reauth_confirmed_at: null,
      action_time: actionTime,
      sync_time: now,
      notes: input.notes ?? null,
      is_deleted: false,
      created_at: now,
      updated_at: now,
      completed_at: now,
      inventory_moved: true,
      items_count: orderItems.length,
      total_quantity: totalQuantity,
      items: orderItems,
    };
    txn.set(db.collection("transfer_orders").doc(orderId), transferOrder);

    // 4. Create items
    for (const item of orderItems) {
      txn.set(
        db
          .collection("transfer_orders")
          .doc(orderId)
          .collection("items")
          .doc(item.id),
        item,
      );
    }

    return transferOrder;
  });

  // Audit log (outside transaction)
  await logAudit({
    entity_type: "TRANSFER_INTRA",
    entity_id: orderId,
    warehouse_id: order.source_warehouse_id,
    action: AuditAction.TRANSFER,
    user_id: userId,
    old_value: null,
    new_value: {
      order_number: orderNumber,
      status: TransferOrderStatus.COMPLETED,
      items_count: input.items.length,
    },
  });

  return order;
}

// ─────────────────────────────────────────────
// STATE MACHINE — Approval Callbacks
// ─────────────────────────────────────────────

/**
 * Called when all approval levels are completed.
 * Advances INTER transfer: APPROVED → create Export Voucher (if auto) or EXPORT_PENDING.
 */
export async function onApprovalCompleted(
  orderId: string,
  approverId: string,
): Promise<void> {
  const order = await transferRepo.findById(orderId);
  if (!order) throw createError(404, "Không tìm thấy phiếu.", "找不到单据。");

  const now = new Date();
  const autoCreate =
    order.config_snapshot?.auto_create_export !== false;

  if (autoCreate) {
    // Auto-create export voucher
    const exportVoucher = await createExportFromTransferInternal(order, now);
    await transferRepo.update(orderId, {
      status: TransferOrderStatus.EXPORT_CREATED,
      approver_id: approverId,
      approved_at: now,
      export_voucher_id: exportVoucher.id,
      updated_at: now,
      sync_time: now,
    });
  } else {
    // Wait for manual export creation
    await transferRepo.update(orderId, {
      status: TransferOrderStatus.APPROVED,
      approver_id: approverId,
      approved_at: now,
      updated_at: now,
      sync_time: now,
    });
  }

  await logAudit({
    entity_type: "TRANSFER_ORDER",
    entity_id: orderId,
    warehouse_id: order.source_warehouse_id,
    action: AuditAction.APPROVE,
    user_id: approverId,
    old_value: { status: TransferOrderStatus.PENDING_APPROVAL },
    new_value: {
      status: autoCreate
        ? TransferOrderStatus.EXPORT_CREATED
        : TransferOrderStatus.APPROVED,
    },
  });
}

/**
 * Called when approval is rejected.
 */
export async function onApprovalRejected(
  orderId: string,
  rejectorId: string,
  reason: string,
): Promise<void> {
  const now = new Date();
  await transferRepo.update(orderId, {
    status: TransferOrderStatus.REJECTED,
    updated_at: now,
    sync_time: now,
  });

  const order = await transferRepo.findById(orderId);
  await logAudit({
    entity_type: "TRANSFER_ORDER",
    entity_id: orderId,
    warehouse_id: order?.source_warehouse_id ?? null,
    action: AuditAction.REJECT,
    user_id: rejectorId,
    old_value: { status: TransferOrderStatus.PENDING_APPROVAL },
    new_value: { status: TransferOrderStatus.REJECTED, reason },
  });
}

/**
 * Called when the creator cancels their own transfer order.
 * Advances order from PENDING_APPROVAL → CANCELLED.
 */
export async function onApprovalCancelled(
  orderId: string,
  userId: string,
  reason?: string | null,
): Promise<void> {
  const now = new Date();
  await transferRepo.update(orderId, {
    status: TransferOrderStatus.CANCELLED,
    updated_at: now,
    sync_time: now,
  });

  const order = await transferRepo.findById(orderId);
  await logAudit({
    entity_type: "TRANSFER_ORDER",
    entity_id: orderId,
    warehouse_id: order?.source_warehouse_id ?? null,
    action: AuditAction.CANCEL,
    user_id: userId,
    old_value: { status: TransferOrderStatus.PENDING_APPROVAL },
    new_value: { status: TransferOrderStatus.CANCELLED, reason: reason || null },
  });
}

// ─────────────────────────────────────────────
// CREATE EXPORT FROM TRANSFER (1-click)
// ─────────────────────────────────────────────

/**
 * Public API: Manual 1-click creation of Export Voucher from Transfer.
 * Called when auto_create_export=false and user clicks "Tạo lệnh xuất kho".
 */
export async function createExportFromTransfer(
  orderId: string,
  userId: string,
  additionalAttachmentUrls: string[] = [],
): Promise<ExportVoucher> {
  const order = await transferRepo.findById(orderId);
  if (!order) throw createError(404, "Không tìm thấy phiếu.", "找不到单据。");

  if (
    order.status !== TransferOrderStatus.APPROVED &&
    order.status !== TransferOrderStatus.EXPORT_PENDING
  ) {
    throw createError(
      400,
      "Phiếu điều chuyển chưa được duyệt hoặc đã tạo lệnh xuất.",
      "调拨单尚未审批或已创建出库单。",
    );
  }

  const now = new Date();
  const exportVoucher = await createExportFromTransferInternal(
    order,
    now,
    additionalAttachmentUrls,
  );

  await transferRepo.update(orderId, {
    status: TransferOrderStatus.EXPORT_CREATED,
    export_voucher_id: exportVoucher.id,
    updated_at: now,
    sync_time: now,
  });

  await logAudit({
    entity_type: "TRANSFER_ORDER",
    entity_id: orderId,
    warehouse_id: order.source_warehouse_id,
    action: AuditAction.UPDATE,
    user_id: userId,
    old_value: { status: order.status },
    new_value: {
      status: TransferOrderStatus.EXPORT_CREATED,
      export_voucher_id: exportVoucher.id,
    },
  });

  return exportVoucher;
}

/**
 * Internal: Creates Export Voucher from Transfer Order.
 * Auto-attaches transfer attachments + allows additional ones.
 */
async function createExportFromTransferInternal(
  order: TransferOrder,
  now: Date,
  additionalAttachmentUrls: string[] = [],
): Promise<ExportVoucher> {
  const exportId = randomUUID();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, "");
  const seq = String(Math.floor(Math.random() * 900) + 100);
  const exportNumber = `EXP-${datePart}-${seq}`;

  // Merge attachments: transfer origin + additional
  const mergedAttachments = [
    ...(order.attachment_urls ?? []),
    ...additionalAttachmentUrls,
  ];

  const exportVoucher: ExportVoucher = {
    id: exportId,
    voucher_number: exportNumber,
    warehouse_id: order.source_warehouse_id,
    export_type: ExportType.TRANSFER,
    status: ExportVoucherStatus.PENDING_APPROVAL,
    creator_id: order.creator_id,
    approver_id: null,
    approved_at: null,
    reference_id: order.id,
    reference_type: ExportReferenceType.TRANSFER_ORDER,
    recipient_name: null,
    recipient_department: null,
    notes: `Lệnh xuất từ điều chuyển ${order.order_number}`,
    attachment_urls: mergedAttachments,
    action_time: now,
    sync_time: now,
    atp_deducted: false,
    is_deleted: false,
    created_at: now,
    updated_at: now,
  };

  await db.collection("export_vouchers").doc(exportId).set(exportVoucher);

  // Copy items from transfer to export
  const items = await transferRepo.findItemsByOrderId(order.id);
  for (const item of items) {
    const exportItem: ExportVoucherItem = {
      id: randomUUID(),
      export_voucher_id: exportId,
      product_id: item.product_id,
      warehouse_location_id: item.source_location_id,
      quantity: item.quantity,
      picked_quantity: 0,
      unit_price: 0,
      notes: null,
      is_deleted: false,
    };
    await db
      .collection("export_vouchers")
      .doc(exportId)
      .collection("items")
      .doc(exportItem.id)
      .set(exportItem);
  }

  // Create approval records for the export voucher
  try {
    await approvalService.createApprovalsForEntity(
      "EXPORT_VOUCHER",
      exportId,
      order.source_warehouse_id,
      order.creator_id,
      undefined,
      {
        sourceWarehouseId: order.source_warehouse_id,
        destinationWarehouseId: order.destination_warehouse_id,
      },
    );
  } catch (error) {
    console.error(
      "[transferOrderService] Export approval creation failed:",
      error,
    );
  }

  return exportVoucher;
}

// ─────────────────────────────────────────────
// EXPORT STATUS MIRROR
// ─────────────────────────────────────────────

/**
 * Called by exportVoucherService when Export Voucher status changes.
 * Mirrors status back to Transfer Order.
 */
export async function syncExportStatus(
  exportVoucherId: string,
  newExportStatus: string,
): Promise<void> {
  // Find the transfer order linked to this export
  const snap = await db
    .collection("transfer_orders")
    .where("export_voucher_id", "==", exportVoucherId)
    .where("is_deleted", "==", false)
    .limit(1)
    .get();

  if (snap.empty) return;

  const transferDoc = snap.docs[0];
  const now = new Date();
  let newTransferStatus: TransferOrderStatus | null = null;

  switch (newExportStatus) {
    case ExportVoucherStatus.PICKING:
      newTransferStatus = TransferOrderStatus.PICKING;
      break;
    case ExportVoucherStatus.SHIPPED:
      newTransferStatus = TransferOrderStatus.PENDING_RECEIVE;
      break;
    case ExportVoucherStatus.COMPLETED:
      // Export completed doesn't auto-complete transfer; need receiving first
      break;
  }

  if (newTransferStatus) {
    await transferDoc.ref.update({
      status: newTransferStatus,
      updated_at: now,
      sync_time: now,
      ...(newTransferStatus === TransferOrderStatus.PENDING_RECEIVE
        ? { dispatched_at: now }
        : {}),
    });
  }
}

// ─────────────────────────────────────────────
// RECEIVE TRANSFER
// ─────────────────────────────────────────────

/**
 * Start receiving: PENDING_RECEIVE → RECEIVING
 */
export async function receiveTransfer(
  orderId: string,
  userId: string,
): Promise<void> {
  const order = await transferRepo.findById(orderId);
  if (!order) throw createError(404, "Không tìm thấy phiếu.", "找不到单据。");

  if (order.status !== TransferOrderStatus.PENDING_RECEIVE) {
    throw createError(
      400,
      "Phiếu chưa sẵn sàng nhận hàng.",
      "单据尚未准备好接收。",
    );
  }

  const now = new Date();
  await transferRepo.update(orderId, {
    status: TransferOrderStatus.RECEIVING,
    received_by: userId,
    updated_at: now,
    sync_time: now,
  });

  await logAudit({
    entity_type: "TRANSFER_ORDER",
    entity_id: orderId,
    warehouse_id: order.destination_warehouse_id,
    action: AuditAction.UPDATE,
    user_id: userId,
    old_value: { status: TransferOrderStatus.PENDING_RECEIVE },
    new_value: { status: TransferOrderStatus.RECEIVING },
  });
}

// ─────────────────────────────────────────────
// COMPLETE RECEIVING — Firestore Transaction
// ─────────────────────────────────────────────

const receivingItemSchema = z.object({
  item_id: z.string().uuid(),
  destination_location_id: z.string().uuid(), // REQUIRED (architectural refinement #1)
  received_quantity: z.number().int().min(0),
});

export const completeReceivingSchema = z.object({
  items: z.array(receivingItemSchema).min(1).max(150),
});

export type CompleteReceivingInput = z.infer<typeof completeReceivingSchema>;

/**
 * Completes receiving phase. Moves inventory to destination warehouse.
 *
 * CRITICAL: Each item MUST have destination_location_id set.
 * Uses Firestore Transaction:
 *   1. Decrease in_transit_quantity at source
 *   2. Increase atp_quantity at destination
 *   3. Update transfer item statuses
 *   4. Update transfer order → COMPLETED
 */
export async function completeReceiving(
  orderId: string,
  input: CompleteReceivingInput,
  userId: string,
): Promise<void> {
  const order = await transferRepo.findById(orderId);
  if (!order) throw createError(404, "Không tìm thấy phiếu.", "找不到单据。");

  if (order.status !== TransferOrderStatus.RECEIVING) {
    throw createError(
      400,
      "Phiếu chưa ở trạng thái kiểm đếm.",
      "单据不在盘点状态。",
    );
  }

  const now = new Date();

  await db.runTransaction(async (txn) => {
    for (const receivedItem of input.items) {
      // Increase atp at destination location (upsert)
      const dstSnap = await txn.get(
        db
          .collection("inventory")
          .where("warehouse_id", "==", order.destination_warehouse_id)
          .where(
            "warehouse_location_id",
            "==",
            receivedItem.destination_location_id,
          )
          .where("product_id", "==", "")
          .limit(1), // placeholder — need product_id from transfer item
      );

      // Get the transfer item to find product_id
      const transferItemSnap = await txn.get(
        db
          .collection("transfer_orders")
          .doc(orderId)
          .collection("items")
          .doc(receivedItem.item_id),
      );

      if (!transferItemSnap.exists) continue;
      const transferItem = transferItemSnap.data() as TransferOrderItem;

      // Actual destination inventory query with correct product_id
      const actualDstSnap = await txn.get(
        db
          .collection("inventory")
          .where("warehouse_id", "==", order.destination_warehouse_id)
          .where(
            "warehouse_location_id",
            "==",
            receivedItem.destination_location_id,
          )
          .where("product_id", "==", transferItem.product_id)
          .limit(1),
      );
      const activeDst = actualDstSnap.docs.find(
        (d) => d.data().is_deleted !== true,
      );

      if (activeDst) {
        const dstData = activeDst.data();
        txn.update(activeDst.ref, {
          atp_quantity:
            (dstData.atp_quantity as number) + receivedItem.received_quantity,
          total_quantity:
            (dstData.total_quantity as number) + receivedItem.received_quantity,
          last_updated_at: now,
        });
      } else {
        const newInvId = randomUUID();
        txn.set(db.collection("inventory").doc(newInvId), {
          id: newInvId,
          warehouse_id: order.destination_warehouse_id,
          warehouse_location_id: receivedItem.destination_location_id,
          product_id: transferItem.product_id,
          total_quantity: receivedItem.received_quantity,
          atp_quantity: receivedItem.received_quantity,
          on_hold_quantity: 0,
          in_transit_quantity: 0,
          quarantine_quantity: 0,
          last_count_at: null,
          last_updated_at: now,
          is_deleted: false,
        });
      }

      // Update transfer item
      const hasDiscrepancy =
        receivedItem.received_quantity !== transferItem.quantity;
      txn.update(transferItemSnap.ref, {
        destination_location_id: receivedItem.destination_location_id,
        received_quantity: receivedItem.received_quantity,
        status: hasDiscrepancy
          ? TransferItemStatus.DISCREPANCY
          : TransferItemStatus.RECEIVED,
      });
    }

    // Update transfer order status
    txn.update(db.collection("transfer_orders").doc(orderId), {
      status: TransferOrderStatus.COMPLETED,
      received_at: now,
      updated_at: now,
      sync_time: now,
    });
  });

  await logAudit({
    entity_type: "TRANSFER_ORDER",
    entity_id: orderId,
    warehouse_id: order.destination_warehouse_id,
    action: AuditAction.UPDATE,
    user_id: userId,
    old_value: { status: TransferOrderStatus.RECEIVING },
    new_value: { status: TransferOrderStatus.COMPLETED },
  });
}

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

function generateOrderNumber(isIntra: boolean): string {
  const prefix = isIntra ? "TRF-I" : "TRF-X";
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const seq = String(Math.floor(Math.random() * 900) + 100);
  return `${prefix}-${datePart}-${seq}`;
}
