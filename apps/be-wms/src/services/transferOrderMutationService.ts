import {
  AuditAction,
  TransferItemStatus,
  TransferOrderStatus,
  TransferType,
  type ProcessEntityType,
  type TransferOrder,
  type TransferOrderItem,
} from "@bduck/shared-types";
import { randomUUID } from "crypto";
import { db } from "../config/firebase.js";
import * as transferRepo from "../repositories/transferOrderRepository.js";
import * as approvalService from "./approvalService.js";
import { logAudit } from "./auditService.js";
import type { AuthorizationService } from "./authorization/index.js";
import { verifyMfa } from "./mfaService.js";
import { getConfigForEntity } from "./processConfigService.js";
import { onApprovalCompleted } from "./transferOrderStateService.js";
import type { UpdateTransferOrderInput } from "./transferOrderSchemas.js";
import { createTransferError } from "./transferOrderSupport.js";
import {
  assertTransferFacilities,
  assertTransferLocations,
  assertTransferWriteAccess,
  loadTransferOrder,
} from "./transferAccessPolicy.js";

export async function updateTransferOrder(
  orderId: string,
  input: UpdateTransferOrderInput,
  userId: string,
  authorization: AuthorizationService,
): Promise<TransferOrder> {
  const oldOrder = await loadTransferOrder(orderId);
  assertTransferWriteAccess(authorization, oldOrder.source_warehouse_id);
  assertTransferWriteAccess(authorization, input.source_warehouse_id);
  await assertTransferFacilities(
    input.source_warehouse_id,
    input.destination_warehouse_id,
  );
  await assertTransferLocations(
    input.source_warehouse_id,
    input.destination_warehouse_id,
    input.items,
  );
  if (!oldOrder)
    throw createTransferError(
      404,
      "Khong tim thay phieu dieu chuyen.",
      "找不到调拨单。",
    );

  if (!authorization.canWriteTransfer(oldOrder.source_warehouse_id)) {
    throw createTransferError(
      403,
      "Ban khong co quyen sua phieu dieu chuyen nay.",
      "您没有权限修改此调拨单。",
    );
  }

  const allowedStatuses = [
    TransferOrderStatus.DRAFT,
    TransferOrderStatus.PENDING_APPROVAL,
    TransferOrderStatus.REJECTED,
  ];
  if (!allowedStatuses.includes(oldOrder.status)) {
    throw createTransferError(
      400,
      "Chi co the sua phieu dang cho duyet hoac bi tu choi.",
      "只能修改待审批或已拒绝的单据。",
    );
  }

  const isIntra = input.transfer_type === TransferType.INTRA_WAREHOUSE;
  if (isIntra && input.source_warehouse_id !== input.destination_warehouse_id) {
    throw createTransferError(
      400,
      "Dieu chuyen trong kho: kho nguon va kho dich phai giong nhau.",
      "库内调拨：源仓库和目标仓库必须相同。",
    );
  }
  if (
    !isIntra &&
    input.source_warehouse_id === input.destination_warehouse_id
  ) {
    throw createTransferError(
      400,
      "Dieu chuyen lien kho: kho nguon va kho dich phai khac nhau.",
      "跨库调拨：源仓库和目标仓库必须不同。",
    );
  }
  if (isIntra) {
    for (const item of input.items) {
      if (!item.destination_location_id) {
        throw createTransferError(
          400,
          "Dieu chuyen trong kho: moi san pham phai chon vi tri dich.",
          "库内调拨：每个产品必须选择目标库位。",
        );
      }
      if (item.source_location_id === item.destination_location_id) {
        throw createTransferError(
          400,
          "Vi tri nguon va vi tri dich khong duoc giong nhau.",
          "源库位和目标库位不能相同。",
        );
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

  if (
    config?.require_evidence &&
    (!input.attachment_urls || input.attachment_urls.length === 0)
  ) {
    throw createTransferError(
      400,
      "Bat buoc tai len chung tu khi sua phieu dieu chuyen.",
      "修改调拨单时必须上传凭证。",
    );
  }

  if (config?.require_otp) {
    if (!input.otp) {
      throw createTransferError(
        400,
        "Ma xac thuc OTP la bat buoc.",
        "验证码是必需的。",
      );
    }
    const isOtpValid = await verifyMfa(userId, input.otp);
    if (!isOtpValid) {
      throw createTransferError(
        400,
        "Ma xac thuc OTP khong hop le hoac da het han.",
        "验证码无效或已过期。",
      );
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
  const oldItemsQuery = orderRef.collection("items");
  const oldApprovalsQuery = db
    .collection("pending_approvals")
    .where("entity_type", "in", ["TRANSFER_ORDER", "TRANSFER_INTRA"])
    .where("entity_id", "==", orderId);

  await db.runTransaction(async (transaction) => {
    const [currentOrderSnap, oldItemsSnap, oldApprovalsSnap] =
      await Promise.all([
        transaction.get(orderRef),
        transaction.get(oldItemsQuery),
        transaction.get(oldApprovalsQuery),
      ]);
    const currentOrder = currentOrderSnap.data() as TransferOrder | undefined;
    if (
      !currentOrderSnap.exists ||
      !currentOrder ||
      currentOrder.is_deleted !== false ||
      currentOrder.source_warehouse_id !== oldOrder.source_warehouse_id ||
      currentOrder.status !== oldOrder.status
    ) {
      throw createTransferError(
        409,
        "Phiếu điều chuyển đã thay đổi. Vui lòng thao tác lại.",
        "调拨单已更改，请重试。",
      );
    }
    assertTransferWriteAccess(authorization, currentOrder.source_warehouse_id);

    transaction.update(orderRef, newOrder);
    for (const doc of oldItemsSnap.docs) {
      transaction.update(doc.ref, { is_deleted: true, updated_at: now });
    }
    for (const item of items) {
      transaction.set(orderRef.collection("items").doc(item.id), item);
    }
    for (const doc of oldApprovalsSnap.docs) {
      if (doc.data().status !== "PENDING") continue;
      transaction.update(doc.ref, {
        status: "CANCELLED",
        approver_id: userId,
        approved_at: now,
        reason: "TRANSFER_ORDER_UPDATED",
        updated_at: now,
      });
    }
  });

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

  const latestOrder = await transferRepo.findById(orderId);
  return latestOrder ?? ({ ...oldOrder, ...newOrder } as TransferOrder);
}

// ─────────────────────────────────────────────
// INTRA-WAREHOUSE — Immediate execution
// ─────────────────────────────────────────────
