import { db } from "../config/firebase.js";
import { v4 as uuidv4 } from "uuid";
import type {
  ExportVoucher,
  ExportVoucherItem,
  IntegrationClient,
  ExternalScanQueue,
} from "@bduck/shared-types";
import {
  calculateInventoryTotalQuantity,
  ExternalScanQueueStatus,
} from "@bduck/shared-types";
import { findByLocationAndProduct } from "../repositories/inventoryRepository.js";
import * as externalScanRepo from "../repositories/externalScanRepository.js";
import { productRepository as productRepo } from "../repositories/productRepository.js";
import { logAudit } from "./auditService.js";
import {
  AuditAction,
  ExternalCountCheckpointType,
  ExportReferenceType,
  ExportType,
  ExportVoucherStatus,
} from "@bduck/shared-types";
import { generateVoucherNumber } from "../utils/voucherNumberGenerator.js";
import * as scannableProductService from "./externalQueueScannableProductService.js";
import * as approvalService from "./approvalService.js";
import {
  isExternalCountCheckpointSatisfied,
  isExternalCountGateOpen,
} from "./stockCountService.js";

// Lấy sản phẩm dựa trên barcode hoặc productId
async function resolveProduct(
  productId: string | null,
  barcode: string | null,
) {
  if (productId) {
    const product = await productRepo.findById(productId);
    if (!product) throw new Error("PRODUCT_NOT_FOUND");
    return product;
  }
  if (barcode) {
    const product = await productRepo.findByBarcode(barcode);
    if (!product) throw new Error("PRODUCT_NOT_FOUND");
    return product;
  }
  throw new Error("MISSING_PRODUCT_INFO");
}

async function enrichScansWithProducts(scans: ExternalScanQueue[]) {
  const products = await productRepo.findByIds(
    scans.map((scan) => scan.product_id),
  );
  const productById = new Map(products.map((product) => [product.id, product]));

  return scans.map((scan) => {
    const product = productById.get(scan.product_id);
    return {
      ...scan,
      product_name: product?.name ?? null,
      product_code: product?.code ?? null,
      product_barcode: product?.barcode ?? null,
      product_unit: product?.unit ?? null,
      product_type: product?.product_type ?? null,
      product_image_url:
        product?.product_image_url && product.product_image_url.length > 0
          ? product.product_image_url[0]
          : null,
    };
  });
}

function getShiftDate(scanTime: Date) {
  return scanTime.toISOString().slice(0, 10);
}

function buildLocationBatchId(shiftDate: string) {
  return `B-${shiftDate.replace(/-/g, "")}-${uuidv4().substring(0, 8).toUpperCase()}`;
}

function toDate(value: unknown): Date {
  if (value instanceof Date) return value;
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof (value as { toDate: unknown }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate();
  }
  if (
    value &&
    typeof value === "object" &&
    "seconds" in value &&
    typeof (value as { seconds: unknown }).seconds === "number"
  ) {
    return new Date((value as { seconds: number }).seconds * 1000);
  }
  return new Date(value as string | number);
}

function isExternalQueueVoucher(voucher: Partial<ExportVoucher> | null) {
  return voucher?.reference_type === ExportReferenceType.EXTERNAL_QUEUE_BATCH;
}

async function getUserDisplayName(userId: string): Promise<string | undefined> {
  try {
    const userDoc = await db.collection("users").doc(userId).get();
    if (!userDoc.exists) return undefined;
    const user = userDoc.data();
    return user?.full_name || user?.email || undefined;
  } catch {
    return undefined;
  }
}

export const scanProduct = async (
  client: IntegrationClient,
  warehouseId: string,
  data: {
    warehouse_location_id: string;
    product_id: string | null;
    barcode: string | null;
    quantity: number;
    operator_name: string;
    operator_id_external: string | null;
    device_id: string | null;
    scan_time: string;
  },
  clientIp: string,
): Promise<ExternalScanQueue> => {
  const product = await resolveProduct(data.product_id, data.barcode);

  if (!client.allowed_warehouse_ids.includes(warehouseId)) {
    throw new Error("UNAUTHORIZED_WAREHOUSE");
  }

  const beforeScanCountOk = await isExternalCountCheckpointSatisfied({
    warehouseId,
    warehouseLocationId: data.warehouse_location_id,
    businessDate: getShiftDate(new Date(data.scan_time)),
    checkpointType: ExternalCountCheckpointType.BEFORE_SCAN,
  });
  if (!beforeScanCountOk) {
    throw new Error("EXTERNAL_COUNT_BEFORE_SCAN_REQUIRED");
  }

  const isAllowed = await scannableProductService.isProductAllowedForLocation(
    data.warehouse_location_id,
    product.id,
  );
  if (!isAllowed) {
    throw new Error("PRODUCT_NOT_ALLOWED_FOR_LOCATION");
  }

  // Generate ID
  const scanId = uuidv4();
  let createdRecord: ExternalScanQueue | null = null;
  let atpBefore = 0;
  let atpAfter = 0;
  let onHoldBefore = 0;
  let onHoldAfter = 0;

  await db.runTransaction(async (tx) => {
    // 1. Check Inventory ATP
    const invSnapshot = await tx.get(
      db
        .collection("inventory")
        .where("warehouse_location_id", "==", data.warehouse_location_id)
        .where("product_id", "==", product.id)
        .limit(1),
    );

    if (invSnapshot.empty) {
      throw new Error("INSUFFICIENT_ATP");
    }

    const invDoc = invSnapshot.docs[0];
    const invData = invDoc.data();

    if (invData.is_deleted || invData.atp_quantity < data.quantity) {
      throw new Error("INSUFFICIENT_ATP");
    }

    atpBefore = invData.atp_quantity;
    onHoldBefore = invData.on_hold_quantity;
    atpAfter = atpBefore - data.quantity;
    onHoldAfter = onHoldBefore + data.quantity;

    // 2. Update Inventory (Hold ATP)
    tx.update(invDoc.ref, {
      atp_quantity: atpAfter,
      on_hold_quantity: onHoldAfter,
      last_updated_at: new Date(),
    });

    // 3. Create Queue Record (Option A: Always new record)
    createdRecord = {
      id: scanId,
      client_id: client.id,
      warehouse_id: warehouseId,
      warehouse_location_id: data.warehouse_location_id,
      product_id: product.id,
      barcode_scanned: data.barcode || product.barcode || "",
      quantity: data.quantity,
      unit_price: product.unit_price || 0,
      scan_time: new Date(data.scan_time),
      sync_time: new Date(),
      operator_name: data.operator_name,
      operator_id_external: data.operator_id_external,
      device_id: data.device_id,
      batch_id: null,
      status: ExternalScanQueueStatus.QUEUED,
      approved_by: null,
      approved_at: null,
      export_voucher_id: null,
      rejection_reason: null,
      atp_held: true,
      notes: null,
      is_deleted: false,
      created_at: new Date(),
    };

    tx.set(db.collection("external_scan_queue").doc(scanId), createdRecord);
  });

  if (!createdRecord) throw new Error("TRANSACTION_FAILED");

  // 4. Audit Log
  await logAudit({
    entity_type: "EXTERNAL_SCAN",
    entity_id: scanId,
    warehouse_id: warehouseId,
    action: AuditAction.CREATE,
    user_id: `EXT:${client.id}`,
    old_value: null,
    new_value: {
      ...(createdRecord as any)!,
      client_name: client.client_name,
      atp_before: atpBefore,
      atp_after: atpAfter,
      on_hold_before: onHoldBefore,
      on_hold_after: onHoldAfter,
    },
    ip_address: clientIp,
    device_id: data.device_id || undefined,
  }).catch(console.error);

  return createdRecord;
};

export const cancelScan = async (
  scanId: string,
  clientId: string,
): Promise<void> => {
  await db.runTransaction(async (tx) => {
    const queueDoc = await tx.get(
      db.collection("external_scan_queue").doc(scanId),
    );
    if (!queueDoc.exists) throw new Error("NOT_FOUND");

    const queueData = queueDoc.data() as ExternalScanQueue;
    if (queueData.client_id !== clientId) throw new Error("UNAUTHORIZED");
    if (queueData.status !== ExternalScanQueueStatus.QUEUED)
      throw new Error("INVALID_STATUS");
    if (queueData.is_deleted) throw new Error("NOT_FOUND");

    // Revert ATP
    const invSnapshot = await tx.get(
      db
        .collection("inventory")
        .where("warehouse_location_id", "==", queueData.warehouse_location_id)
        .where("product_id", "==", queueData.product_id)
        .limit(1),
    );

    if (!invSnapshot.empty) {
      const invDoc = invSnapshot.docs[0];
      const invData = invDoc.data();
      tx.update(invDoc.ref, {
        atp_quantity: invData.atp_quantity + queueData.quantity,
        on_hold_quantity: Math.max(
          0,
          invData.on_hold_quantity - queueData.quantity,
        ),
        last_updated_at: new Date(),
      });
    }

    tx.update(queueDoc.ref, {
      is_deleted: true,
      atp_held: false,
    });
  });
};

export const submitBatch = async (
  client: IntegrationClient,
  data: {
    warehouse_id: string;
    warehouse_location_id: string;
    shift_date: string;
    operator_name: string;
    operator_id_external: string | null;
    notes: string | null;
  },
) => {
  if (!client.allowed_warehouse_ids.includes(data.warehouse_id)) {
    throw new Error("UNAUTHORIZED_WAREHOUSE");
  }

  const beforeSubmitCountOk = await isExternalCountCheckpointSatisfied({
    warehouseId: data.warehouse_id,
    warehouseLocationId: data.warehouse_location_id,
    businessDate: data.shift_date,
    checkpointType: ExternalCountCheckpointType.BEFORE_SUBMIT,
  });
  if (!beforeSubmitCountOk) {
    throw new Error("EXTERNAL_COUNT_BEFORE_SUBMIT_REQUIRED");
  }

  const batchId = buildLocationBatchId(data.shift_date);

  const scans = await externalScanRepo.findQueuedByLocationAndDate(
    client.id,
    data.warehouse_location_id,
    data.shift_date,
  );

  if (scans.length === 0) {
    throw new Error("NO_QUEUED_SCANS");
  }

  const batch = db.batch();
  let totalQty = 0;
  let totalValue = 0;

  scans.forEach((scan) => {
    const ref = db.collection("external_scan_queue").doc(scan.id);
    batch.update(ref, {
      status: ExternalScanQueueStatus.SUBMITTED,
      batch_id: batchId,
      notes: data.notes,
    });
    totalQty += scan.quantity;
    totalValue += scan.quantity * scan.unit_price;
  });

  await batch.commit();

  await logAudit({
    entity_type: "EXTERNAL_SCAN",
    entity_id: batchId,
    warehouse_id: data.warehouse_id,
    action: AuditAction.UPDATE,
    user_id: data.operator_id_external || `EXT:${client.id}`,
    old_value: { status: ExternalScanQueueStatus.QUEUED },
    new_value: {
      status: ExternalScanQueueStatus.SUBMITTED,
      warehouse_location_id: data.warehouse_location_id,
      total_quantity: totalQty,
      total_value: totalValue,
      submitted_by: data.operator_name,
      notes: data.notes,
    },
    notes: data.notes,
  }).catch(console.error);

  return {
    batch_id: batchId,
    total_products: scans.length,
    total_quantity: totalQty,
    total_value: totalValue,
  };
};

// -------------------------------------------------------------------------
// EXTERNAL VIEW
// -------------------------------------------------------------------------

export const getMyScans = async (
  client: IntegrationClient,
  operatorIdExternal: string,
) => {
  const scans = await externalScanRepo.findQueuedByExternalOperator(
    client.id,
    operatorIdExternal,
  );

  return enrichScansWithProducts(scans);
};

export const getLocationScans = async (
  client: IntegrationClient,
  warehouseId: string,
  warehouseLocationId: string,
) => {
  if (!client.allowed_warehouse_ids.includes(warehouseId)) {
    throw new Error("UNAUTHORIZED_WAREHOUSE");
  }

  const scans = await externalScanRepo.findQueuedByLocation({
    clientId: client.id,
    warehouseId,
    locationId: warehouseLocationId,
  });

  return enrichScansWithProducts(scans);
};

export const cancelScanByManager = async (
  scanId: string,
  managerId: string,
  canManageWarehouse: (warehouseId: string) => boolean,
  reason: string | null,
) => {
  const scan = await externalScanRepo.findById(scanId);
  if (!scan) throw new Error("SCAN_NOT_FOUND");
  if (scan.status !== ExternalScanQueueStatus.QUEUED) {
    throw new Error("INVALID_SCAN_STATUS");
  }
  if (!canManageWarehouse(scan.warehouse_id)) {
    throw new Error("PERMISSION_DENIED");
  }

  let atpBefore = 0;
  let atpAfter = 0;
  let onHoldBefore = 0;
  let onHoldAfter = 0;

  await db.runTransaction(async (tx) => {
    const scanRef = db.collection("external_scan_queue").doc(scanId);
    const scanSnap = await tx.get(scanRef);
    if (!scanSnap.exists) throw new Error("SCAN_NOT_FOUND");

    const currentScan = scanSnap.data() as ExternalScanQueue;
    if (currentScan.is_deleted) throw new Error("SCAN_NOT_FOUND");
    if (currentScan.status !== ExternalScanQueueStatus.QUEUED) {
      throw new Error("INVALID_SCAN_STATUS");
    }

    const invSnapshot = await tx.get(
      db
        .collection("inventory")
        .where("warehouse_location_id", "==", currentScan.warehouse_location_id)
        .where("product_id", "==", currentScan.product_id)
        .limit(1),
    );

    if (!invSnapshot.empty && currentScan.atp_held) {
      const invDoc = invSnapshot.docs[0];
      const invData = invDoc.data();
      atpBefore = Number(invData.atp_quantity ?? 0);
      onHoldBefore = Number(invData.on_hold_quantity ?? 0);
      atpAfter = atpBefore + currentScan.quantity;
      onHoldAfter = Math.max(0, onHoldBefore - currentScan.quantity);

      tx.update(invDoc.ref, {
        atp_quantity: atpAfter,
        on_hold_quantity: onHoldAfter,
        last_updated_at: new Date(),
      });
    }

    tx.update(scanRef, {
      is_deleted: true,
      atp_held: false,
      rejection_reason: reason,
      sync_time: new Date(),
    });
  });

  await logAudit({
    entity_type: "EXTERNAL_SCAN",
    entity_id: scan.id,
    warehouse_id: scan.warehouse_id,
    action: AuditAction.SOFT_DELETE,
    user_id: managerId,
    old_value: {
      scan_id: scan.id,
      product_id: scan.product_id,
      quantity: scan.quantity,
      atp_quantity: atpBefore,
      on_hold_quantity: onHoldBefore,
    },
    new_value: {
      scan_id: scan.id,
      is_deleted: true,
      atp_held: false,
      atp_quantity: atpAfter,
      on_hold_quantity: onHoldAfter,
      reason,
    },
    notes: reason,
  }).catch(console.error);

  return { scan_id: scanId, cancelled: true };
};

export const autoSubmitQueuedLocations = async (params: {
  actorId: string;
  warehouseId?: string;
  warehouseLocationId?: string;
  olderThanMinutes?: number;
  now?: Date;
}) => {
  const scans = await externalScanRepo.findQueued({
    warehouse_id: params.warehouseId,
    warehouse_location_id: params.warehouseLocationId,
  });
  const now = params.now ?? new Date();
  const cutoffTime =
    typeof params.olderThanMinutes === "number"
      ? now.getTime() - params.olderThanMinutes * 60 * 1000
      : null;

  const groupMap = new Map<string, ExternalScanQueue[]>();
  for (const scan of scans) {
    const scanDate = toDate(scan.scan_time);
    if (cutoffTime !== null && scanDate.getTime() > cutoffTime) continue;

    const shiftDate = getShiftDate(scanDate);
    const groupKey = [
      scan.client_id,
      scan.warehouse_id,
      scan.warehouse_location_id,
      shiftDate,
    ].join(":");

    const group = groupMap.get(groupKey) ?? [];
    group.push(scan);
    groupMap.set(groupKey, group);
  }

  const submittedBatches = [];
  const blockedLocations = [];
  let submittedScans = 0;
  for (const group of groupMap.values()) {
    const first = group[0];
    const shiftDate = getShiftDate(toDate(first.scan_time));
    const countGateOpen = await isExternalCountGateOpen({
      warehouseId: first.warehouse_id,
      warehouseLocationId: first.warehouse_location_id,
      businessDate: shiftDate,
    });
    if (!countGateOpen) {
      blockedLocations.push({
        warehouse_id: first.warehouse_id,
        warehouse_location_id: first.warehouse_location_id,
        business_date: shiftDate,
        queued_scans: group.length,
        reason: "EXTERNAL_COUNT_REQUIRED",
      });
      continue;
    }

    const batchId = buildLocationBatchId(shiftDate);
    const batch = db.batch();
    let totalQty = 0;
    let totalValue = 0;

    for (const scan of group) {
      batch.update(db.collection("external_scan_queue").doc(scan.id), {
        status: ExternalScanQueueStatus.SUBMITTED,
        batch_id: batchId,
        sync_time: now,
        notes:
          typeof params.olderThanMinutes === "number"
            ? `Auto-submitted by location after ${params.olderThanMinutes} minutes without new scans.`
            : "Auto-submitted by scheduled time.",
      });
      totalQty += scan.quantity;
      totalValue += scan.quantity * scan.unit_price;
    }

    await batch.commit();

    await logAudit({
      entity_type: "EXTERNAL_SCAN",
      entity_id: batchId,
      warehouse_id: first.warehouse_id,
      action: AuditAction.UPDATE,
      user_id: params.actorId,
      old_value: { status: ExternalScanQueueStatus.QUEUED },
      new_value: {
        status: ExternalScanQueueStatus.SUBMITTED,
        auto_submit: true,
        warehouse_location_id: first.warehouse_location_id,
        total_scans: group.length,
        total_quantity: totalQty,
        total_value: totalValue,
        ...(typeof params.olderThanMinutes === "number"
          ? { older_than_minutes: params.olderThanMinutes }
          : { scheduled_submit: true }),
      },
      notes: "Auto-submit location queue",
    }).catch(console.error);

    submittedBatches.push({
      batch_id: batchId,
      warehouse_id: first.warehouse_id,
      warehouse_location_id: first.warehouse_location_id,
      total_scans: group.length,
      total_quantity: totalQty,
      total_value: totalValue,
    });
    submittedScans += group.length;
  }

  return {
    submitted_batches: submittedBatches.length,
    submitted_scans: submittedScans,
    batches: submittedBatches,
    blocked_locations: blockedLocations,
  };
};

// -------------------------------------------------------------------------
// MANAGER ACTIONS (WMS Internal)
// -------------------------------------------------------------------------

export const approveBatch = async (
  batchId: string,
  managerId: string,
  approvedItems: { scan_id: string; quantity: number }[],
  notes: string | null,
  canEditQuantitiesForWarehouse: (warehouseId: string) => boolean = () => false,
) => {
  const scans = await externalScanRepo.findByBatchId(batchId);
  if (scans.length === 0) throw new Error("BATCH_NOT_FOUND");

  const statuses = new Set(scans.map((scan) => scan.status));
  const batchStatus = scans[0].status;
  if (
    statuses.size !== 1 ||
    ![
      ExternalScanQueueStatus.SUBMITTED,
      ExternalScanQueueStatus.REVISION_REQUIRED,
    ].includes(batchStatus)
  ) {
    throw new Error("INVALID_BATCH_STATUS");
  }

  const warehouseId = scans[0].warehouse_id;
  const scanIds = new Set(scans.map((scan) => scan.id));
  if (approvedItems.some((item) => !scanIds.has(item.scan_id))) {
    throw new Error("INVALID_APPROVED_ITEM");
  }

  const approvedByScanId = new Map(
    approvedItems.map((item) => [item.scan_id, item.quantity]),
  );
  if (scans.every((scan) => (approvedByScanId.get(scan.id) ?? 0) <= 0)) {
    throw new Error("NO_APPROVED_ITEMS");
  }

  const quantityChanges = scans
    .map((scan) => {
      const approvedQty = approvedByScanId.get(scan.id) ?? 0;
      return {
        scan_id: scan.id,
        product_id: scan.product_id,
        old_quantity: scan.quantity,
        approved_quantity: approvedQty,
      };
    })
    .filter((item) => item.old_quantity !== item.approved_quantity);

  if (
    quantityChanges.length > 0 &&
    !canEditQuantitiesForWarehouse(warehouseId)
  ) {
    throw new Error("QUANTITY_EDIT_PERMISSION_REQUIRED");
  }

  for (const change of quantityChanges) {
    if (change.approved_quantity > change.old_quantity) {
      throw new Error("APPROVED_QUANTITY_EXCEEDS_HELD_QUANTITY");
    }
  }

  const existingVoucherId =
    scans.find((scan) => Boolean(scan.export_voucher_id))?.export_voucher_id ??
    null;
  const voucherId = existingVoucherId || uuidv4();
  let voucherNumber = await generateVoucherNumber("EXP");
  const now = new Date();

  await db.runTransaction(async (tx) => {
    const inventoryDocs = await Promise.all(
      scans.map(async (scan) => {
        const invSnapshot = await tx.get(
          db
            .collection("inventory")
            .where("warehouse_location_id", "==", scan.warehouse_location_id)
            .where("product_id", "==", scan.product_id)
            .limit(1),
        );
        return { scan, invSnapshot };
      }),
    );
    const voucherRef = db.collection("export_vouchers").doc(voucherId);
    const existingVoucherSnap = existingVoucherId
      ? await tx.get(voucherRef)
      : null;
    const existingVoucher = existingVoucherSnap?.exists
      ? (existingVoucherSnap.data() as ExportVoucher)
      : null;
    const oldVoucherItemsSnap = existingVoucher
      ? await tx.get(
          voucherRef.collection("items").where("is_deleted", "==", false),
        )
      : null;

    if (existingVoucher) {
      if (
        !isExternalQueueVoucher(existingVoucher) ||
        existingVoucher.reference_id !== batchId
      ) {
        throw new Error("VOUCHER_BATCH_MISMATCH");
      }
      voucherNumber = existingVoucher.voucher_number || voucherNumber;
    }

    const invMap = new Map<
      string,
      {
        ref: FirebaseFirestore.DocumentReference;
        oldData: FirebaseFirestore.DocumentData;
        atp_delta: number;
        hold_delta: number;
      }
    >();
    const groupedVoucherItems = new Map<
      string,
      {
        product_id: string;
        warehouse_location_id: string;
        quantity: number;
        picked_quantity: number;
        unit_price: number;
      }
    >();

    for (const { scan, invSnapshot } of inventoryDocs) {
      const approvedQty = approvedByScanId.get(scan.id) ?? 0;

      if (!invSnapshot.empty) {
        const invDoc = invSnapshot.docs[0];
        const path = invDoc.ref.path;
        if (!invMap.has(path)) {
          invMap.set(path, {
            ref: invDoc.ref,
            oldData: invDoc.data(),
            atp_delta: 0,
            hold_delta: 0,
          });
        }
        const state = invMap.get(path)!;
        const releasedHold = scan.quantity - approvedQty;
        state.hold_delta -= releasedHold;
        state.atp_delta += releasedHold;
      }

      tx.update(db.collection("external_scan_queue").doc(scan.id), {
        status: ExternalScanQueueStatus.PENDING_EXPORT_APPROVAL,
        quantity: approvedQty,
        approved_by: managerId,
        approved_at: now,
        final_approved_by: null,
        final_approved_at: null,
        revision_requested_by: null,
        revision_requested_at: null,
        export_voucher_id: voucherId,
        rejection_reason: null,
        atp_held: approvedQty > 0,
        notes,
        sync_time: now,
      });

      if (approvedQty > 0) {
        const key = `${scan.product_id}_${scan.warehouse_location_id}`;
        if (!groupedVoucherItems.has(key)) {
          groupedVoucherItems.set(key, {
            product_id: scan.product_id,
            warehouse_location_id: scan.warehouse_location_id,
            quantity: 0,
            picked_quantity: 0,
            unit_price: scan.unit_price,
          });
        }
        const item = groupedVoucherItems.get(key)!;
        item.quantity += approvedQty;
        item.picked_quantity += approvedQty;
      }
    }

    for (const state of invMap.values()) {
      const newAtp = state.oldData.atp_quantity + state.atp_delta;
      const newOnHold = Math.max(
        0,
        state.oldData.on_hold_quantity + state.hold_delta,
      );
      const newTotal = calculateInventoryTotalQuantity({
        atp_quantity: newAtp,
        on_hold_quantity: newOnHold,
        in_transit_quantity: state.oldData.in_transit_quantity,
        quarantine_quantity: state.oldData.quarantine_quantity,
      });

      tx.update(state.ref, {
        on_hold_quantity: newOnHold,
        atp_quantity: newAtp,
        total_quantity: newTotal,
        last_updated_at: now,
      });
    }

    const voucherItems = Array.from(groupedVoucherItems.values());

    if (oldVoucherItemsSnap) {
      for (const doc of oldVoucherItemsSnap.docs) {
        tx.update(doc.ref, { is_deleted: true });
      }
    }

    if (existingVoucher) {
      tx.update(voucherRef, {
        warehouse_id: warehouseId,
        export_type: ExportType.SALE_POS,
        status: ExportVoucherStatus.PENDING_APPROVAL,
        creator_id: managerId,
        approver_id: null,
        approved_at: null,
        reference_id: batchId,
        reference_type: ExportReferenceType.EXTERNAL_QUEUE_BATCH,
        recipient_name: "External Scan Queue",
        recipient_department: "External Queue Approval",
        attachment_urls: existingVoucher.attachment_urls ?? [],
        action_time: now,
        atp_deducted: false,
        sync_time: now,
        updated_at: now,
        is_deleted: false,
        notes: `Updated from external queue batch ${batchId}.${notes ? ` ${notes}` : ""}`,
      });
    } else {
      const voucher: ExportVoucher = {
        id: voucherId,
        voucher_number: voucherNumber,
        warehouse_id: warehouseId,
        export_type: ExportType.SALE_POS,
        status: ExportVoucherStatus.PENDING_APPROVAL,
        creator_id: managerId,
        created_at: now,
        updated_at: now,
        approver_id: null,
        approved_at: null,
        reference_id: batchId,
        reference_type: ExportReferenceType.EXTERNAL_QUEUE_BATCH,
        recipient_name: "External Scan Queue",
        recipient_department: "External Queue Approval",
        attachment_urls: [],
        action_time: now,
        atp_deducted: false,
        sync_time: now,
        is_deleted: false,
        notes: `Created from external queue batch ${batchId}.${notes ? ` ${notes}` : ""}`,
      };

      tx.set(voucherRef, voucher);
    }

    for (const item of voucherItems) {
      const itemId = uuidv4();
      const voucherItem: ExportVoucherItem = {
        id: itemId,
        export_voucher_id: voucherId,
        product_id: item.product_id,
        warehouse_location_id: item.warehouse_location_id,
        quantity: item.quantity,
        picked_quantity: item.picked_quantity,
        unit_price: item.unit_price,
        notes: "Created from external queue level-1 approval",
        is_deleted: false,
      };

      tx.set(voucherRef.collection("items").doc(itemId), voucherItem);
    }
  });

  const creatorName = await getUserDisplayName(managerId);
  const approvals = await approvalService.createApprovalsForEntity(
    "EXPORT_VOUCHER",
    voucherId,
    warehouseId,
    managerId,
    { voucher_number: voucherNumber, creator_name: creatorName },
    undefined,
    {
      minLevel: 1,
      maxLevel: 2,
      configEntityType: "EXTERNAL_QUEUE_EXPORT",
    },
  );

  let resultingStatus = ExternalScanQueueStatus.PENDING_EXPORT_APPROVAL;
  if (approvals.length === 0) {
    await finalizeApprovedBatchFromVoucher(voucherId, "SYSTEM_AUTO_APPROVE");
    resultingStatus = ExternalScanQueueStatus.EXPORTED;
  }

  await logAudit({
    entity_type: "EXTERNAL_SCAN",
    entity_id: batchId,
    warehouse_id: warehouseId,
    action: AuditAction.APPROVE,
    user_id: managerId,
    old_value: { status: batchStatus },
    new_value: {
      status: resultingStatus,
      export_voucher_id: voucherId,
      export_voucher_number: voucherNumber,
      approved_items: approvedItems,
      quantity_changes: quantityChanges,
    },
  }).catch(console.error);

  return {
    batch_id: batchId,
    export_voucher_id: voucherId,
    export_voucher_number: voucherNumber,
    status: resultingStatus,
  };
};

export const finalizeApprovedBatchFromVoucher = async (
  voucherId: string,
  approverId: string,
) => {
  const voucherRef = db.collection("export_vouchers").doc(voucherId);
  const voucherSnap = await voucherRef.get();
  if (!voucherSnap.exists) throw new Error("VOUCHER_NOT_FOUND");

  const voucher = voucherSnap.data() as ExportVoucher;
  if (!isExternalQueueVoucher(voucher) || !voucher.reference_id) {
    throw new Error("NOT_EXTERNAL_QUEUE_VOUCHER");
  }
  if (
    voucher.status === ExportVoucherStatus.COMPLETED &&
    voucher.atp_deducted
  ) {
    return {
      batch_id: voucher.reference_id,
      export_voucher_id: voucherId,
      unchanged: true,
    };
  }

  const batchId = voucher.reference_id;
  const scans = await externalScanRepo.findByBatchId(batchId);
  if (scans.length === 0) throw new Error("BATCH_NOT_FOUND");
  if (
    scans.some(
      (scan) =>
        scan.status !== ExternalScanQueueStatus.PENDING_EXPORT_APPROVAL &&
        scan.status !== ExternalScanQueueStatus.EXPORTED,
    )
  ) {
    throw new Error("INVALID_BATCH_STATUS");
  }

  const now = new Date();
  await db.runTransaction(async (tx) => {
    const inventoryDocs = await Promise.all(
      scans.map(async (scan) => {
        const invSnapshot = await tx.get(
          db
            .collection("inventory")
            .where("warehouse_location_id", "==", scan.warehouse_location_id)
            .where("product_id", "==", scan.product_id)
            .limit(1),
        );
        return { scan, invSnapshot };
      }),
    );
    const currentVoucherSnap = await tx.get(voucherRef);
    if (!currentVoucherSnap.exists) throw new Error("VOUCHER_NOT_FOUND");
    const currentVoucher = currentVoucherSnap.data() as ExportVoucher;
    if (
      currentVoucher.status === ExportVoucherStatus.COMPLETED &&
      currentVoucher.atp_deducted
    ) {
      return;
    }

    const invMap = new Map<
      string,
      {
        ref: FirebaseFirestore.DocumentReference;
        oldData: FirebaseFirestore.DocumentData;
        hold_delta: number;
      }
    >();

    for (const { scan, invSnapshot } of inventoryDocs) {
      if (!invSnapshot.empty && scan.atp_held && scan.quantity > 0) {
        const invDoc = invSnapshot.docs[0];
        const path = invDoc.ref.path;
        if (!invMap.has(path)) {
          invMap.set(path, {
            ref: invDoc.ref,
            oldData: invDoc.data(),
            hold_delta: 0,
          });
        }
        invMap.get(path)!.hold_delta -= scan.quantity;
      }

      tx.update(db.collection("external_scan_queue").doc(scan.id), {
        status: ExternalScanQueueStatus.EXPORTED,
        atp_held: false,
        final_approved_by: approverId,
        final_approved_at: now,
        rejection_reason: null,
        sync_time: now,
      });
    }

    for (const state of invMap.values()) {
      const newOnHold = Math.max(
        0,
        Number(state.oldData.on_hold_quantity ?? 0) + state.hold_delta,
      );
      const newTotal = calculateInventoryTotalQuantity({
        atp_quantity: Number(state.oldData.atp_quantity ?? 0),
        on_hold_quantity: newOnHold,
        in_transit_quantity: Number(state.oldData.in_transit_quantity ?? 0),
        quarantine_quantity: Number(state.oldData.quarantine_quantity ?? 0),
      });

      tx.update(state.ref, {
        on_hold_quantity: newOnHold,
        total_quantity: newTotal,
        last_updated_at: now,
      });
    }

    tx.update(voucherRef, {
      status: ExportVoucherStatus.COMPLETED,
      approver_id: approverId,
      approved_at: now,
      atp_deducted: true,
      sync_time: now,
      updated_at: now,
    });
  });

  await logAudit({
    entity_type: "EXTERNAL_SCAN",
    entity_id: batchId,
    warehouse_id: voucher.warehouse_id,
    action: AuditAction.EXPORT,
    user_id: approverId,
    old_value: { status: ExternalScanQueueStatus.PENDING_EXPORT_APPROVAL },
    new_value: {
      status: ExternalScanQueueStatus.EXPORTED,
      export_voucher_id: voucherId,
    },
  }).catch(console.error);

  await logAudit({
    entity_type: "EXPORT_VOUCHER",
    entity_id: voucherId,
    warehouse_id: voucher.warehouse_id,
    action: AuditAction.EXPORT,
    user_id: approverId,
    old_value: { status: ExportVoucherStatus.PENDING_APPROVAL },
    new_value: {
      status: ExportVoucherStatus.COMPLETED,
      atp_deducted: true,
      reference_id: batchId,
      reference_type: ExportReferenceType.EXTERNAL_QUEUE_BATCH,
    },
  }).catch(console.error);

  return { batch_id: batchId, export_voucher_id: voucherId };
};

export const returnBatchForRevisionFromVoucher = async (
  voucherId: string,
  rejectorId: string,
  reason: string,
) => {
  const voucherSnap = await db
    .collection("export_vouchers")
    .doc(voucherId)
    .get();
  if (!voucherSnap.exists) throw new Error("VOUCHER_NOT_FOUND");

  const voucher = voucherSnap.data() as ExportVoucher;
  if (!isExternalQueueVoucher(voucher) || !voucher.reference_id) {
    throw new Error("NOT_EXTERNAL_QUEUE_VOUCHER");
  }

  const batchId = voucher.reference_id;
  const scans = await externalScanRepo.findByBatchId(batchId);
  if (scans.length === 0) throw new Error("BATCH_NOT_FOUND");
  if (
    scans.some(
      (scan) => scan.status !== ExternalScanQueueStatus.PENDING_EXPORT_APPROVAL,
    )
  ) {
    throw new Error("INVALID_BATCH_STATUS");
  }

  const now = new Date();
  const batch = db.batch();
  for (const scan of scans) {
    batch.update(db.collection("external_scan_queue").doc(scan.id), {
      status: ExternalScanQueueStatus.REVISION_REQUIRED,
      rejection_reason: reason,
      revision_requested_by: rejectorId,
      revision_requested_at: now,
      sync_time: now,
    });
  }
  await batch.commit();

  await logAudit({
    entity_type: "EXTERNAL_SCAN",
    entity_id: batchId,
    warehouse_id: voucher.warehouse_id,
    action: AuditAction.REJECT,
    user_id: rejectorId,
    old_value: { status: ExternalScanQueueStatus.PENDING_EXPORT_APPROVAL },
    new_value: {
      status: ExternalScanQueueStatus.REVISION_REQUIRED,
      export_voucher_id: voucherId,
      rejection_reason: reason,
    },
  }).catch(console.error);

  return { batch_id: batchId, export_voucher_id: voucherId };
};

export const cancelBatchFromVoucher = async (
  voucherId: string,
  userId: string,
  reason: string,
) => {
  const voucherSnap = await db
    .collection("export_vouchers")
    .doc(voucherId)
    .get();
  if (!voucherSnap.exists) throw new Error("VOUCHER_NOT_FOUND");

  const voucher = voucherSnap.data() as ExportVoucher;
  if (!isExternalQueueVoucher(voucher) || !voucher.reference_id) {
    throw new Error("NOT_EXTERNAL_QUEUE_VOUCHER");
  }

  await rejectHeldBatch(voucher.reference_id, userId, reason, [
    ExternalScanQueueStatus.PENDING_EXPORT_APPROVAL,
    ExternalScanQueueStatus.REVISION_REQUIRED,
  ]);
};

export const updateScanQuantity = async (
  scanId: string,
  newQuantity: number,
  managerId: string,
  canEditWarehouse: (warehouseId: string) => boolean,
  reason: string | null,
) => {
  const scan = await externalScanRepo.findById(scanId);
  if (!scan) throw new Error("SCAN_NOT_FOUND");
  if (
    scan.status !== ExternalScanQueueStatus.QUEUED &&
    scan.status !== ExternalScanQueueStatus.SUBMITTED &&
    scan.status !== ExternalScanQueueStatus.REVISION_REQUIRED
  ) {
    throw new Error("INVALID_SCAN_STATUS");
  }
  if (!canEditWarehouse(scan.warehouse_id)) {
    throw new Error("PERMISSION_DENIED");
  }

  let oldQuantity = scan.quantity;
  if (newQuantity === oldQuantity) {
    return {
      scan_id: scanId,
      quantity: newQuantity,
      unchanged: true,
    };
  }

  let quantityDelta = newQuantity - oldQuantity;
  let atpBefore = 0;
  let atpAfter = 0;
  let onHoldBefore = 0;
  let onHoldAfter = 0;

  await db.runTransaction(async (tx) => {
    const scanRef = db.collection("external_scan_queue").doc(scanId);
    const scanSnap = await tx.get(scanRef);
    if (!scanSnap.exists) throw new Error("SCAN_NOT_FOUND");

    const currentScan = scanSnap.data() as ExternalScanQueue;
    if (currentScan.is_deleted) throw new Error("SCAN_NOT_FOUND");
    if (
      currentScan.status !== ExternalScanQueueStatus.QUEUED &&
      currentScan.status !== ExternalScanQueueStatus.SUBMITTED &&
      currentScan.status !== ExternalScanQueueStatus.REVISION_REQUIRED
    ) {
      throw new Error("INVALID_SCAN_STATUS");
    }

    const invSnapshot = await tx.get(
      db
        .collection("inventory")
        .where("warehouse_location_id", "==", currentScan.warehouse_location_id)
        .where("product_id", "==", currentScan.product_id)
        .limit(1),
    );

    if (invSnapshot.empty) {
      throw new Error("INVENTORY_NOT_FOUND");
    }

    const invDoc = invSnapshot.docs[0];
    const invData = invDoc.data();
    oldQuantity = currentScan.quantity;
    quantityDelta = newQuantity - oldQuantity;
    atpBefore = invData.atp_quantity || 0;
    onHoldBefore = invData.on_hold_quantity || 0;

    if (quantityDelta === 0) return;

    if (quantityDelta > 0 && atpBefore < quantityDelta) {
      throw new Error("INSUFFICIENT_ATP");
    }

    atpAfter = atpBefore - quantityDelta;
    onHoldAfter = Math.max(0, onHoldBefore + quantityDelta);

    const now = new Date();
    tx.update(invDoc.ref, {
      atp_quantity: atpAfter,
      on_hold_quantity: onHoldAfter,
      last_updated_at: now,
    });

    tx.update(scanRef, {
      quantity: newQuantity,
      atp_held: newQuantity > 0,
      sync_time: now,
    });
  });

  if (quantityDelta === 0) {
    return {
      scan_id: scanId,
      quantity: newQuantity,
      unchanged: true,
    };
  }

  await logAudit({
    entity_type: "EXTERNAL_SCAN",
    entity_id: scan.batch_id || scan.id,
    warehouse_id: scan.warehouse_id,
    action: AuditAction.UPDATE,
    user_id: managerId,
    old_value: {
      scan_id: scan.id,
      batch_id: scan.batch_id,
      product_id: scan.product_id,
      quantity: oldQuantity,
      atp_quantity: atpBefore,
      on_hold_quantity: onHoldBefore,
    },
    new_value: {
      scan_id: scan.id,
      batch_id: scan.batch_id,
      product_id: scan.product_id,
      quantity: newQuantity,
      quantity_delta: quantityDelta,
      atp_quantity: atpAfter,
      on_hold_quantity: onHoldAfter,
      reason,
    },
    notes: reason,
  }).catch(console.error);

  return {
    scan_id: scanId,
    batch_id: scan.batch_id,
    old_quantity: oldQuantity,
    quantity: newQuantity,
    quantity_delta: quantityDelta,
  };
};

async function rejectHeldBatch(
  batchId: string,
  managerId: string,
  reason: string,
  allowedStatuses: ExternalScanQueueStatus[],
) {
  const scans = await externalScanRepo.findByBatchId(batchId);
  if (scans.length === 0) throw new Error("BATCH_NOT_FOUND");
  const statuses = new Set(scans.map((scan) => scan.status));
  const currentStatus = scans[0].status;
  if (statuses.size !== 1 || !allowedStatuses.includes(currentStatus)) {
    throw new Error("INVALID_BATCH_STATUS");
  }

  const now = new Date();
  await db.runTransaction(async (tx) => {
    const inventoryDocs = await Promise.all(
      scans.map(async (scan) => {
        const invSnapshot = await tx.get(
          db
            .collection("inventory")
            .where("warehouse_location_id", "==", scan.warehouse_location_id)
            .where("product_id", "==", scan.product_id)
            .limit(1),
        );
        return { scan, invSnapshot };
      }),
    );

    const invMap = new Map<
      string,
      {
        ref: FirebaseFirestore.DocumentReference;
        oldData: FirebaseFirestore.DocumentData;
        atp_delta: number;
        hold_delta: number;
      }
    >();

    for (const { scan, invSnapshot } of inventoryDocs) {
      if (!invSnapshot.empty && scan.atp_held && scan.quantity > 0) {
        const invDoc = invSnapshot.docs[0];
        const path = invDoc.ref.path;
        if (!invMap.has(path)) {
          invMap.set(path, {
            ref: invDoc.ref,
            oldData: invDoc.data(),
            atp_delta: 0,
            hold_delta: 0,
          });
        }
        const state = invMap.get(path)!;
        state.hold_delta -= scan.quantity;
        state.atp_delta += scan.quantity;
      }

      tx.update(db.collection("external_scan_queue").doc(scan.id), {
        status: ExternalScanQueueStatus.REJECTED,
        rejection_reason: reason,
        approved_by: managerId,
        approved_at: now,
        atp_held: false,
        revision_requested_by: null,
        revision_requested_at: null,
        sync_time: now,
      });
    }

    for (const state of invMap.values()) {
      const newAtp = Number(state.oldData.atp_quantity ?? 0) + state.atp_delta;
      const newOnHold = Math.max(
        0,
        Number(state.oldData.on_hold_quantity ?? 0) + state.hold_delta,
      );
      const newTotal = calculateInventoryTotalQuantity({
        atp_quantity: newAtp,
        on_hold_quantity: newOnHold,
        in_transit_quantity: Number(state.oldData.in_transit_quantity ?? 0),
        quarantine_quantity: Number(state.oldData.quarantine_quantity ?? 0),
      });

      tx.update(state.ref, {
        on_hold_quantity: newOnHold,
        atp_quantity: newAtp,
        total_quantity: newTotal,
        last_updated_at: now,
      });
    }
  });

  await logAudit({
    entity_type: "EXTERNAL_SCAN",
    entity_id: batchId,
    warehouse_id: scans[0].warehouse_id,
    action: AuditAction.REJECT,
    user_id: managerId,
    old_value: { status: currentStatus },
    new_value: {
      status: ExternalScanQueueStatus.REJECTED,
      rejection_reason: reason,
    },
  }).catch(console.error);
}

export const rejectBatch = async (
  batchId: string,
  managerId: string,
  reason: string,
) => {
  await rejectHeldBatch(batchId, managerId, reason, [
    ExternalScanQueueStatus.SUBMITTED,
    ExternalScanQueueStatus.REVISION_REQUIRED,
  ]);
};
