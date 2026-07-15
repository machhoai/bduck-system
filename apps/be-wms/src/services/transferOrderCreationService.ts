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
import { executeIntraTransfer } from "./transferOrderIntraService.js";
import type { CreateTransferOrderInput } from "./transferOrderSchemas.js";
import {
  createTransferError,
  generateTransferOrderNumber,
} from "./transferOrderSupport.js";
import {
  assertTransferFacilities,
  assertTransferLocations,
  assertTransferWriteAccess,
} from "./transferAccessPolicy.js";

export async function createTransferOrder(
  input: CreateTransferOrderInput,
  userId: string,
  authorization: AuthorizationService,
): Promise<TransferOrder> {
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
  const now = new Date();
  const actionTime = input.action_time ? new Date(input.action_time) : now;
  const orderId = randomUUID();
  const isIntra = input.transfer_type === TransferType.INTRA_WAREHOUSE;

  // ── Validate: INTRA must have same source+destination warehouse ──
  if (isIntra && input.source_warehouse_id !== input.destination_warehouse_id) {
    throw createTransferError(
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
    throw createTransferError(
      400,
      "Điều chuyển liên kho: kho nguồn và kho đích phải khác nhau.",
      "跨库调拨：源仓库和目标仓库必须不同。",
    );
  }
  // ── Validate: INTRA items must have destination_location_id ──
  if (isIntra) {
    for (const item of input.items) {
      if (!item.destination_location_id) {
        throw createTransferError(
          400,
          "Điều chuyển trong kho: mỗi sản phẩm phải chọn vị trí đích.",
          "库内调拨：每个产品必须选择目标库位。",
        );
      }
      if (item.source_location_id === item.destination_location_id) {
        throw createTransferError(
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

  const orderNumber = generateTransferOrderNumber(isIntra);

  if (
    config?.require_evidence &&
    (!input.attachment_urls || input.attachment_urls.length === 0)
  ) {
    const err = createTransferError(
      400,
      "Bắt buộc tải lên chứng từ (evidence) khi tạo phiếu điều chuyển.",
      "创建调拨单时必须上传凭证 (evidence)。",
    );
    throw err;
  }

  if (config?.require_otp) {
    if (!input.otp) {
      const err = createTransferError(
        400,
        "Mã xác thực (OTP) là bắt buộc.",
        "验证码 (OTP) 是必需的。",
      );
      throw err;
    }
    const isOtpValid = await verifyMfa(userId, input.otp);
    if (!isOtpValid) {
      const err = createTransferError(
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

  const orderItems: TransferOrderItem[] = input.items.map((item) => ({
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
  batch.set(orderRef, order);
  for (const item of orderItems) {
    batch.set(orderRef.collection("items").doc(item.id), item);
  }
  await batch.commit();

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
    console.error("[transferOrderService] Approval creation failed:", error);
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

  const latestOrder = await transferRepo.findById(orderId);
  return latestOrder ?? order;
}
