/**
 * Transfer Order Query Service — Read-only queries
 *
 * ═══════════════════════════════════════════════════════════════
 * Separated from transferOrderService for clarity.
 * Handles list, detail, and filter queries.
 * ═══════════════════════════════════════════════════════════════
 */

import * as transferRepo from "../repositories/transferOrderRepository.js";
import type { TransferOrder, TransferOrderItem } from "@bduck/shared-types";

// ─────────────────────────────────────────────
// LIST
// ─────────────────────────────────────────────

export interface TransferOrderFilters {
  source_warehouse_id?: string;
  destination_warehouse_id?: string;
  transfer_type?: string;
  status?: string;
}

export async function listTransferOrders(
  filters?: TransferOrderFilters,
): Promise<TransferOrder[]> {
  return transferRepo.findAll(filters);
}

// ─────────────────────────────────────────────
// DETAIL
// ─────────────────────────────────────────────

export interface TransferOrderDetail {
  order: TransferOrder;
  items: TransferOrderItem[];
}

export async function getTransferOrderById(
  id: string,
): Promise<TransferOrderDetail | null> {
  const order = await transferRepo.findById(id);
  if (!order) return null;

  let items = await transferRepo.findItemsByOrderId(id);
  if (
    items.length === 0 &&
    "items" in order &&
    Array.isArray((order as TransferOrder & { items?: unknown }).items)
  ) {
    items = (order as TransferOrder & { items: TransferOrderItem[] }).items;
  }

  return { order, items };
}
