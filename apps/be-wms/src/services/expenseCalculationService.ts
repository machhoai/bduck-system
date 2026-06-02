/**
 * Expense Calculation Service — WMS Integration
 *
 * ═══════════════════════════════════════════════════════════════
 * PURPOSE:
 * - Query completed export vouchers from WMS for a given
 *   warehouse + period, then compute `suggested_amount` for
 *   COGS and GIFT_EXPENSE categories automatically.
 * - This is a "human-in-the-loop" system: suggested values
 *   are shown to the user but never auto-committed.
 * ═══════════════════════════════════════════════════════════════
 */

import { db } from "../config/firebase.js";
import {
  ExportVoucherStatus,
  ExportType,
} from "@bduck/shared-types";

interface AutoExpenseResult {
  cogs: number;
  gift: number;
}

/**
 * Calculate suggested amounts by scanning completed export vouchers.
 *
 * @param warehouseId - Source warehouse
 * @param period      - Format YYYY-MM (e.g. "2026-06")
 */
export async function calculateAutoExpenses(
  warehouseId: string,
  period: string,
): Promise<AutoExpenseResult> {
  const [year, month] = period.split("-").map(Number);
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 1); // 1st of next month

  // Query completed export vouchers in the period
  const snap = await db
    .collection("export_vouchers")
    .where("warehouse_id", "==", warehouseId)
    .where("status", "==", ExportVoucherStatus.COMPLETED)
    .where("is_deleted", "==", false)
    .where("action_time", ">=", startDate)
    .where("action_time", "<", endDate)
    .get();

  let cogs = 0;
  let gift = 0;

  for (const doc of snap.docs) {
    const voucher = doc.data();
    const exportType = voucher.export_type as ExportType;

    // Fetch items sub-collection or inline items
    const itemsSnap = await db
      .collection("export_vouchers")
      .doc(doc.id)
      .collection("items")
      .get();

    for (const itemDoc of itemsSnap.docs) {
      const item = itemDoc.data();
      const amount = (item.picked_quantity || 0) * (item.unit_price || 0);

      if (exportType === ExportType.SALE_POS) {
        cogs += amount;
      } else if (exportType === ExportType.GIFT_MANUAL) {
        gift += amount;
      }
    }
  }

  return { cogs, gift };
}
