import { AuditAction, type MarketingVoucherJob } from "@bduck/shared-types";

import { db } from "../config/firebase.js";

import {
  campaignRef,
  jobRef,
  mapMarketingVoucherCampaign,
  mapMarketingVoucherJob,
  writeMarketingVoucherAudit,
} from "./marketingVoucherRepository.js";

export async function failMarketingVoucherExportJob(
  jobId: string,
  failure: { code: string; message: string },
) {
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(jobRef(jobId));
    if (!snapshot.exists) return;
    const previous = mapMarketingVoucherJob(snapshot);
    if (["COMPLETED", "CANCELLED", "PAUSED"].includes(previous.status)) return;
    const campaignSnapshot = await transaction.get(
      campaignRef(previous.campaign_id),
    );
    const campaign = campaignSnapshot.exists
      ? mapMarketingVoucherCampaign(campaignSnapshot)
      : null;
    const now = new Date();
    const updated: MarketingVoucherJob = {
      ...previous,
      status: "FAILED",
      last_error_code: failure.code,
      last_error_message: failure.message.slice(0, 1_000),
      revision: previous.revision + 1,
      updated_at: now,
      sync_time: now,
    };
    transaction.set(snapshot.ref, updated);
    writeMarketingVoucherAudit(transaction, {
      id: `${previous.id}:export:failure:${previous.revision}`,
      action: AuditAction.MARKETING_VOUCHER_EXPORT_FAILED,
      entity_type: "marketing_voucher_jobs",
      entity_id: previous.id,
      entity_name: campaign?.name ?? null,
      context: {
        actor_id: previous.requested_by,
        action_time: previous.action_time,
        idempotency_key: previous.idempotency_key,
      },
      old_value: previous,
      new_value: updated,
      sync_time: now,
      notes: `Voucher export failed: ${failure.code}`,
    });
  });
}
