import { db } from "../../config/firebase.js";
import {
  IssueType,
  ItemCondition,
  NonconformityStatus,
  calculateInventoryTotalQuantity,
} from "@bduck/shared-types";
import type { Inventory } from "@bduck/shared-types";

export type BucketLock = "ON_HOLD" | "QUARANTINE" | null;

export interface ImportException {
  itemId: string;
  productId: string;
  locationId: string;
  quantity: number;
  expectedQuantity: number;
  actualQuantity: number;
  issueType: IssueType;
  status: NonconformityStatus;
  bucketLock: BucketLock;
  reason: string;
}

export interface InventoryLockAggregate {
  warehouseId: string;
  locationId: string;
  productId: string;
  onHoldQuantity: number;
  quarantineQuantity: number;
}

function toPositiveNumber(value: unknown): number {
  return typeof value === "number" && value > 0 ? value : 0;
}

function createInventoryLockError(
  vi: string,
  zh: string,
): Error & { statusCode: number; messages: Record<string, string> } {
  const error = new Error(vi) as Error & {
    statusCode: number;
    messages: Record<string, string>;
  };
  error.statusCode = 400;
  error.messages = { vi, zh };
  return error;
}

export function buildImportExceptions(
  items: FirebaseFirestore.DocumentData[],
): ImportException[] {
  const exceptions: ImportException[] = [];

  for (const item of items) {
    const productId = typeof item.product_id === "string" ? item.product_id : "";
    const locationId =
      typeof item.warehouse_location_id === "string"
        ? item.warehouse_location_id
        : "";
    if (!productId || !locationId) continue;

    const expected = toPositiveNumber(item.expected_quantity);
    const actual = toPositiveNumber(item.actual_quantity);
    const condition = item.condition as ItemCondition | undefined;
    const itemId = typeof item.id === "string" ? item.id : "";

    if (condition === ItemCondition.DAMAGED && actual > 0) {
      exceptions.push({
        itemId,
        productId,
        locationId,
        quantity: actual,
        expectedQuantity: expected,
        actualQuantity: actual,
        issueType: IssueType.DAMAGED,
        status: NonconformityStatus.QUARANTINED,
        bucketLock: "QUARANTINE",
        reason: "DAMAGED_RECEIVED_STOCK",
      });
    }

    if (condition === ItemCondition.MISSING || actual < expected) {
      const missingQuantity =
        condition === ItemCondition.MISSING
          ? Math.max(expected - actual, expected || actual)
          : expected - actual;

      if (missingQuantity > 0) {
        exceptions.push({
          itemId,
          productId,
          locationId,
          quantity: missingQuantity,
          expectedQuantity: expected,
          actualQuantity: actual,
          issueType: IssueType.MISSING,
          status: NonconformityStatus.UNDER_REVIEW,
          bucketLock: null,
          reason: "MISSING_RECEIVED_STOCK",
        });
      }
    }

    if (condition !== ItemCondition.DAMAGED && actual > expected) {
      exceptions.push({
        itemId,
        productId,
        locationId,
        quantity: actual - expected,
        expectedQuantity: expected,
        actualQuantity: actual,
        issueType: IssueType.DISCREPANCY,
        status: NonconformityStatus.UNDER_REVIEW,
        bucketLock: "ON_HOLD",
        reason: "SURPLUS_RECEIVED_STOCK",
      });
    }
  }

  return exceptions;
}

export function aggregateInventoryLocks(
  warehouseId: string,
  exceptions: ImportException[],
): InventoryLockAggregate[] {
  const grouped = new Map<string, InventoryLockAggregate>();

  for (const exception of exceptions) {
    if (!exception.bucketLock) continue;

    const key = `${exception.locationId}:${exception.productId}`;
    const current =
      grouped.get(key) ??
      {
        warehouseId,
        locationId: exception.locationId,
        productId: exception.productId,
        onHoldQuantity: 0,
        quarantineQuantity: 0,
      };

    if (exception.bucketLock === "ON_HOLD") {
      current.onHoldQuantity += exception.quantity;
    } else {
      current.quarantineQuantity += exception.quantity;
    }

    grouped.set(key, current);
  }

  return Array.from(grouped.values());
}

export async function applyInventoryLocksInTransaction(
  txn: FirebaseFirestore.Transaction,
  aggregates: InventoryLockAggregate[],
): Promise<void> {
  if (aggregates.length === 0) return;

  const snapshots = await Promise.all(
    aggregates.map((aggregate) =>
      txn.get(
        db
          .collection("inventory")
          .where("warehouse_id", "==", aggregate.warehouseId)
          .where("warehouse_location_id", "==", aggregate.locationId)
          .where("product_id", "==", aggregate.productId)
          .limit(5),
      ),
    ),
  );

  const now = new Date();

  aggregates.forEach((aggregate, index) => {
    const activeDocs = snapshots[index].docs.filter(
      (doc) => doc.data().is_deleted !== true,
    );

    if (activeDocs.length === 0) {
      throw createInventoryLockError(
        "Khong tim thay ton kho de khoa ngoai le sau nhan hang.",
        "未找到用于锁定收货异常的库存。",
      );
    }

    const inventoryDoc = activeDocs[0];
    const existing = inventoryDoc.data() as Inventory;
    const lockQuantity =
      aggregate.onHoldQuantity + aggregate.quarantineQuantity;
    const newAtp = existing.atp_quantity - lockQuantity;

    if (newAtp < 0) {
      throw createInventoryLockError(
        "So luong kha dung (ATP) khong du de khoa ngoai le sau nhan hang.",
        "可用库存 (ATP) 不足，无法锁定收货异常。",
      );
    }

    const newOnHold = existing.on_hold_quantity + aggregate.onHoldQuantity;
    const newQuarantine =
      existing.quarantine_quantity + aggregate.quarantineQuantity;

    txn.update(inventoryDoc.ref, {
      atp_quantity: newAtp,
      on_hold_quantity: newOnHold,
      quarantine_quantity: newQuarantine,
      total_quantity: calculateInventoryTotalQuantity({
        atp_quantity: newAtp,
        on_hold_quantity: newOnHold,
        in_transit_quantity: existing.in_transit_quantity,
        quarantine_quantity: newQuarantine,
      }),
      last_updated_at: now,
    });
  });
}
