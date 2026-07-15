import { AuditAction, TransferOrderStatus } from "@bduck/shared-types";
import { z } from "zod";
import * as transferRepo from "../repositories/transferOrderRepository.js";
import { logAudit } from "./auditService.js";
import type { AuthorizationService } from "./authorization/index.js";
import { runTransferReceivingTransaction } from "./transferOrderReceivingTransaction.js";
import { createTransferError } from "./transferOrderSupport.js";
import {
  assertReceivingLocations,
  assertTransferReceiveAccess,
  loadTransferOrder,
} from "./transferAccessPolicy.js";

export async function receiveTransfer(
  orderId: string,
  userId: string,
  authorization: AuthorizationService,
): Promise<void> {
  const order = await loadTransferOrder(orderId);
  assertTransferReceiveAccess(authorization, order.destination_warehouse_id);
  if (!order)
    throw createTransferError(404, "Không tìm thấy phiếu.", "找不到单据。");

  if (order.status !== TransferOrderStatus.PENDING_RECEIVE) {
    throw createTransferError(
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
  authorization: AuthorizationService,
): Promise<void> {
  const order = await loadTransferOrder(orderId);
  assertTransferReceiveAccess(authorization, order.destination_warehouse_id);
  await assertReceivingLocations(
    order.destination_warehouse_id,
    input.items.map((item) => item.destination_location_id),
  );
  if (!order)
    throw createTransferError(404, "Không tìm thấy phiếu.", "找不到单据。");

  if (order.status !== TransferOrderStatus.RECEIVING) {
    throw createTransferError(
      400,
      "Phiếu chưa ở trạng thái kiểm đếm.",
      "单据不在盘点状态。",
    );
  }

  const now = new Date();

  const seenItemIds = new Set<string>();
  for (const item of input.items) {
    if (seenItemIds.has(item.item_id)) {
      throw createTransferError(
        400,
        "Dữ liệu nhận hàng bị trùng sản phẩm.",
        "收货数据中存在重复商品。",
      );
    }
    seenItemIds.add(item.item_id);
  }

  await runTransferReceivingTransaction(
    orderId,
    input,
    order,
    authorization,
    now,
  );
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
