import { randomUUID } from "crypto";

import {
  AuditAction,
  type PartnerInventoryComparisonRow,
  type PartnerInventorySyncItemResult,
  type PartnerInventorySyncRequest,
} from "@bduck/shared-types";

import {
  acquirePartnerInventoryLock,
  markPartnerInventoryLockNeedsAttention,
  releasePartnerInventoryLock,
} from "../repositories/partnerInventoryLockRepository.js";
import {
  createPartnerInventoryJob,
  findPartnerInventoryJob,
  findPartnerInventorySnapshot,
  findPartnerWarehouseMapping,
  updatePartnerInventoryJob,
} from "../repositories/partnerInventoryRepository.js";

import { logAudit, type AuditMetadata } from "./auditService.js";
import type { AuthorizationService } from "./authorization/index.js";
import {
  decreaseJoyWorldStock,
  fetchJoyWorldGiftDetails,
  fetchJoyWorldStock,
  getPartnerInventoryCapability,
  increaseJoyWorldStock,
} from "./joyWorldInventoryClient.js";
import type { JoyWorldStockRow } from "./partnerInventorySchemas.js";
import {
  buildPartnerInventoryMutationItems,
  createPartnerInventoryItemResult,
  createPartnerInventoryPayloadFingerprint,
  derivePartnerInventoryJobStatus,
  type PreparedPartnerInventoryMutation,
} from "./partnerInventorySyncPolicy.js";
import { preparePartnerInventoryMutations } from "./partnerInventorySyncPreparation.js";
import { loadWarehouseById } from "./warehouseService.js";

export const synchronizePartnerInventory = async (
  warehouseId: string,
  input: PartnerInventorySyncRequest,
  actorId: string,
  authorization: AuthorizationService,
  auditMetadata?: AuditMetadata,
) => {
  const warehouse = await loadWarehouseById(warehouseId);
  authorization.assert("partner_inventory.sync", warehouseId);
  const capability = getPartnerInventoryCapability();
  if (!capability.write_enabled) throw new Error("PARTNER_WRITE_DISABLED");

  const fingerprint = createPartnerInventoryPayloadFingerprint(warehouseId, input);
  const existingJob = await findPartnerInventoryJob(input.request_id);
  if (existingJob) {
    if (existingJob.payload_fingerprint !== fingerprint) {
      throw new Error("IDEMPOTENCY_PAYLOAD_CONFLICT");
    }
    const { payload_fingerprint: _fingerprint, ...job } = existingJob;
    return job;
  }

  const [snapshot, mapping] = await Promise.all([
    findPartnerInventorySnapshot(input.snapshot_id),
    findPartnerWarehouseMapping(capability.connection_id, warehouseId),
  ]);
  if (!snapshot || snapshot.warehouse_id !== warehouseId) {
    throw new Error("PARTNER_SNAPSHOT_NOT_FOUND");
  }
  if (new Date(snapshot.expires_at).getTime() <= Date.now()) {
    throw new Error("PARTNER_SNAPSHOT_EXPIRED");
  }
  if (
    !mapping ||
    mapping.version !== snapshot.mapping_version ||
    mapping.partner_stock_id !== snapshot.partner_stock_id
  ) {
    throw new Error("PARTNER_MAPPING_CHANGED");
  }

  const productIds = [...new Set(input.product_ids)];
  const selectedRows = productIds.map((productId) =>
    snapshot.rows.find((row) => row.product_id === productId),
  );
  if (selectedRows.some((row) => !row?.eligible)) {
    throw new Error("PARTNER_SELECTION_NOT_ELIGIBLE");
  }

  const lockToken = randomUUID();
  await acquirePartnerInventoryLock({
    connectionId: capability.connection_id,
    partnerStockId: mapping.partner_stock_id,
    requestId: input.request_id,
    lockToken,
    actorId,
  });
  let jobCreated = false;
  let retainLockForReview = false;
  let partnerMutationAttempted = false;
  const prepared: PreparedPartnerInventoryMutation[] = [];
  const results: PartnerInventorySyncItemResult[] = [];

  try {
    const jobAfterLock = await findPartnerInventoryJob(input.request_id);
    if (jobAfterLock) {
      if (jobAfterLock.payload_fingerprint !== fingerprint) {
        throw new Error("IDEMPOTENCY_PAYLOAD_CONFLICT");
      }
      const { payload_fingerprint: _fingerprint, ...job } = jobAfterLock;
      return job;
    }

    await createPartnerInventoryJob({
      payloadFingerprint: fingerprint,
      job: {
        request_id: input.request_id,
        connection_id: capability.connection_id,
        warehouse_id: warehouseId,
        partner_stock_id: mapping.partner_stock_id,
        snapshot_id: snapshot.id,
        status: "RUNNING",
        requested_by: actorId,
        action_time: input.action_time,
        sync_time: new Date().toISOString(),
        completed_at: null,
        items: [],
      },
    });
    jobCreated = true;

    const preparation = await preparePartnerInventoryMutations({
      warehouseId,
      productIds,
      selectedRows: selectedRows as PartnerInventoryComparisonRow[],
      mapping,
    });
    prepared.push(...preparation.prepared);
    results.push(...preparation.results);

    const increases: PreparedPartnerInventoryMutation[] = [];
    const decreases: PreparedPartnerInventoryMutation[] = [];
    for (const mutation of prepared) {
      if (mutation.delta > 0) {
        const details = await fetchJoyWorldGiftDetails(mutation.current.giftId);
        if (details.isOpenExpire) {
          results.push(
            createPartnerInventoryItemResult(
              mutation,
              "BLOCKED",
              mutation.current.amount,
              "PARTNER_EXPIRY_DATE_REQUIRED",
            ),
          );
        } else {
          increases.push(mutation);
        }
      } else {
        decreases.push(mutation);
      }
    }

    const successfulMutations = new Set<PreparedPartnerInventoryMutation>();
    const unknownMutations = new Set<PreparedPartnerInventoryMutation>();
    const executeBatch = async (
      mutations: PreparedPartnerInventoryMutation[],
      direction: "add" | "out",
    ) => {
      if (mutations.length === 0) return;
      const payload = {
        stockId: mapping.partner_stock_id,
        stockName: mapping.partner_stock_name,
        remark: `JPULSE inventory sync ${input.request_id}`,
        orderItems: buildPartnerInventoryMutationItems(mutations, direction),
      };
      partnerMutationAttempted = true;
      try {
        if (direction === "add") await increaseJoyWorldStock(payload);
        else await decreaseJoyWorldStock(payload);
        mutations.forEach((item) => successfulMutations.add(item));
      } catch (error) {
        console.error(`[partnerInventorySyncService] ${direction} failed:`, error);
        mutations.forEach((item) => unknownMutations.add(item));
      }
    };

    await executeBatch(increases, "add");
    await executeBatch(decreases, "out");

    let verifiedRows: JoyWorldStockRow[] = [];
    try {
      verifiedRows = await fetchJoyWorldStock(mapping.partner_stock_id);
    } catch (error) {
      console.error("[partnerInventorySyncService] read-back failed:", error);
      prepared.forEach((item) => unknownMutations.add(item));
    }
    const verifiedByGiftId = new Map(
      verifiedRows.map((row) => [row.giftId, row] as const),
    );
    prepared.forEach((mutation) => {
      const after =
        verifiedByGiftId.get(mutation.current.giftId)?.amount ?? null;
      if (unknownMutations.has(mutation)) {
        results.push(
          createPartnerInventoryItemResult(
            mutation,
            "UNKNOWN",
            after,
            "PARTNER_RESULT_UNKNOWN",
          ),
        );
      } else if (
        successfulMutations.has(mutation) &&
        after === mutation.targetAtp
      ) {
        results.push(
          createPartnerInventoryItemResult(mutation, "VERIFIED", after),
        );
      } else {
        results.push(
          createPartnerInventoryItemResult(
            mutation,
            "UNKNOWN",
            after,
            "PARTNER_READ_BACK_MISMATCH",
          ),
        );
      }
    });

    const completedAt = new Date().toISOString();
    const finalStatus = derivePartnerInventoryJobStatus(results);
    const job = await updatePartnerInventoryJob(input.request_id, {
      status: finalStatus,
      items: results.sort((left, right) => left.sku.localeCompare(right.sku)),
      completed_at: completedAt,
    });
    if (finalStatus === "UNKNOWN") {
      retainLockForReview = true;
      try {
        await markPartnerInventoryLockNeedsAttention({
          connectionId: capability.connection_id,
          partnerStockId: mapping.partner_stock_id,
          lockToken,
        });
      } catch (lockError) {
        console.error("[partnerInventorySyncService] attention lock failed:", lockError);
      }
    }
    try {
      await logAudit({
        entity_type: "partner_inventory_sync_jobs",
        entity_id: job.id,
        entity_name: `${warehouse.name} / ${mapping.partner_stock_name}`,
        warehouse_id: warehouseId,
        action: AuditAction.UPDATE,
        user_id: actorId,
        old_value: {
          snapshot_id: snapshot.id,
          selected_product_ids: productIds,
        },
        new_value: job as unknown as Record<string, unknown>,
        notes: "Manual JPULSE ATP to JoyWorld inventory synchronization",
        ...auditMetadata,
      });
    } catch (auditError) {
      console.error("[partnerInventorySyncService] audit failed:", auditError);
    }
    return job;
  } catch (error) {
    if (jobCreated) {
      if (partnerMutationAttempted) {
        retainLockForReview = true;
        const recordedSkus = new Set(results.map((item) => item.sku));
        prepared.forEach((mutation) => {
          if (!recordedSkus.has(mutation.row.sku)) {
            results.push(
              createPartnerInventoryItemResult(
                mutation,
                "UNKNOWN",
                null,
                "PARTNER_RESULT_UNKNOWN",
              ),
            );
          }
        });
        try {
          await markPartnerInventoryLockNeedsAttention({
            connectionId: capability.connection_id,
            partnerStockId: mapping.partner_stock_id,
            lockToken,
          });
        } catch (lockError) {
          console.error(
            "[partnerInventorySyncService] failure attention lock failed:",
            lockError,
          );
        }
      }
      try {
        await updatePartnerInventoryJob(input.request_id, {
          status: partnerMutationAttempted ? "UNKNOWN" : "FAILED",
          items: partnerMutationAttempted ? results : [],
          completed_at: new Date().toISOString(),
        });
      } catch (updateError) {
        console.error("[partnerInventorySyncService] job failure update failed:", updateError);
      }
    }
    throw error;
  } finally {
    try {
      if (!retainLockForReview) {
        await releasePartnerInventoryLock({
          connectionId: capability.connection_id,
          partnerStockId: mapping.partner_stock_id,
          lockToken,
        });
      }
    } catch (releaseError) {
      console.error("[partnerInventorySyncService] lock release failed:", releaseError);
    }
  }
};
