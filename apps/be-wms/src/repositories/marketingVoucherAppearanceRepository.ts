import {
  AuditAction,
  type MarketingVoucherCampaignMutationResult,
  type UpdateMarketingVoucherAppearanceInput,
} from "@bduck/shared-types";

import { db } from "../config/firebase.js";

import {
  loadMarketingVoucherMutationResult,
  type MarketingVoucherMutationPointer,
} from "./marketingVoucherJobMutationHelpers.js";
import {
  campaignRef,
  mapMarketingVoucherCampaign,
  marketingVoucherError,
  prepareMarketingVoucherOperation,
  writeMarketingVoucherAudit,
  writeMarketingVoucherOperation,
  type MarketingVoucherOperationContext,
} from "./marketingVoucherRepository.js";
import {
  assertCampaignMutable,
  assertMarketingVoucherRevision,
} from "./marketingVoucherRepositoryGuards.js";

export const updateMarketingVoucherAppearanceRecord = async (input: {
  campaign_id: string;
  request: UpdateMarketingVoucherAppearanceInput;
  context: MarketingVoucherOperationContext;
}): Promise<MarketingVoucherCampaignMutationResult> => {
  const pointer = await db.runTransaction<MarketingVoucherMutationPointer>(
    async (transaction) => {
      const operation = await prepareMarketingVoucherOperation(
        transaction,
        "UPDATE_APPEARANCE",
        input.context,
        { campaign_id: input.campaign_id, request: input.request },
      );
      if (operation.replay) {
        return {
          ...operation.replay,
          replayed: true,
        } as MarketingVoucherMutationPointer;
      }
      const reference = campaignRef(input.campaign_id);
      const snapshot = await transaction.get(reference);
      if (!snapshot.exists || snapshot.get("is_deleted") === true) {
        throw marketingVoucherError(
          "MARKETING_VOUCHER_CAMPAIGN_NOT_FOUND",
          { vi: "Không tìm thấy chiến dịch.", zh: "未找到优惠券活动。" },
          404,
        );
      }
      const previous = mapMarketingVoucherCampaign(snapshot);
      assertCampaignMutable(previous);
      assertMarketingVoucherRevision(
        previous.revision,
        input.request.expected_revision,
      );
      const now = new Date();
      const updated = {
        ...previous,
        accent_color: input.request.accent_color.toUpperCase(),
        revision: previous.revision + 1,
        updated_by: input.context.actor_id,
        updated_at: now,
        action_time: input.context.action_time,
        sync_time: now,
      };
      const result = { campaign_id: previous.id, job_id: null };
      transaction.set(reference, updated);
      writeMarketingVoucherAudit(transaction, {
        id: `${operation.id}:appearance`,
        action: AuditAction.MARKETING_VOUCHER_APPEARANCE_UPDATE,
        entity_type: "marketing_voucher_campaigns",
        entity_id: previous.id,
        entity_name: previous.name,
        context: input.context,
        old_value: { accent_color: previous.accent_color },
        new_value: { accent_color: updated.accent_color },
        sync_time: now,
        notes: "Marketing voucher accent color updated",
      });
      writeMarketingVoucherOperation(
        transaction,
        operation,
        "UPDATE_APPEARANCE",
        input.context,
        result,
        now,
      );
      return { ...result, replayed: false };
    },
  );
  return loadMarketingVoucherMutationResult(pointer);
};
