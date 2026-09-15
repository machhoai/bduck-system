import { AuditAction } from "@bduck/shared-types";

import { releasePartnerInventoryAttentionLock } from "../repositories/partnerInventoryLockRepository.js";
import {
  findPartnerInventoryJob,
  updatePartnerInventoryJob,
} from "../repositories/partnerInventoryRepository.js";

import type { AuditMetadata } from "./auditService.js";
import { logAudit } from "./auditService.js";
import type { AuthorizationService } from "./authorization/index.js";
import { fetchJoyWorldStock } from "./joyWorldInventoryClient.js";
import { derivePartnerInventoryJobStatus } from "./partnerInventorySyncPolicy.js";
import { loadWarehouseById } from "./warehouseService.js";

export const reconcilePartnerInventoryJob = async (
  warehouseId: string,
  requestId: string,
  actorId: string,
  authorization: AuthorizationService,
  auditMetadata?: AuditMetadata,
) => {
  const warehouse = await loadWarehouseById(warehouseId);
  authorization.assert("partner_inventory.sync", warehouseId);
  const existing = await findPartnerInventoryJob(requestId);
  if (!existing || existing.warehouse_id !== warehouseId) {
    throw new Error("PARTNER_JOB_NOT_FOUND");
  }
  if (existing.status !== "UNKNOWN") {
    await releasePartnerInventoryAttentionLock({
      connectionId: existing.connection_id,
      partnerStockId: existing.partner_stock_id,
      requestId,
    });
    const { payload_fingerprint: _fingerprint, ...job } = existing;
    return job;
  }

  const currentRows = await fetchJoyWorldStock(existing.partner_stock_id);
  const rowsBySku = new Map<string, typeof currentRows>();
  currentRows.forEach((row) => {
    rowsBySku.set(row.giftNo, [...(rowsBySku.get(row.giftNo) || []), row]);
  });
  const items = existing.items.map((item) => {
    if (item.status !== "UNKNOWN") return item;
    const matches = rowsBySku.get(item.sku) || [];
    const partnerAfter = matches.length === 1 ? matches[0].amount : null;
    if (partnerAfter === item.target_atp) {
      return {
        ...item,
        partner_after: partnerAfter,
        status: "VERIFIED" as const,
        message: null,
      };
    }
    return { ...item, partner_after: partnerAfter };
  });
  const status = derivePartnerInventoryJobStatus(items);
  const job = await updatePartnerInventoryJob(requestId, {
    status,
    items,
    completed_at: new Date().toISOString(),
  });
  if (status !== "UNKNOWN") {
    await releasePartnerInventoryAttentionLock({
      connectionId: job.connection_id,
      partnerStockId: job.partner_stock_id,
      requestId,
    });
  }
  try {
    await logAudit({
      entity_type: "partner_inventory_sync_jobs",
      entity_id: job.id,
      entity_name: `${warehouse.name} / ${job.partner_stock_id}`,
      warehouse_id: warehouseId,
      action: AuditAction.UPDATE,
      user_id: actorId,
      old_value: { status: existing.status, items: existing.items },
      new_value: job as unknown as Record<string, unknown>,
      notes: "JoyWorld inventory synchronization read-back reconciliation",
      ...auditMetadata,
    });
  } catch (auditError) {
    console.error("[partnerInventoryReconciliationService] audit failed:", auditError);
  }
  return job;
};
