import {
  AuditAction,
  type MarketingVoucherCampaign,
  type MarketingVoucherCode,
  type MarketingVoucherMutationResult,
  type RevokeMarketingVoucherCodesInput,
} from "@bduck/shared-types";

import { db } from "../config/firebase.js";

import {
  campaignRef,
  codeRef,
  mapMarketingVoucherCampaign,
  mapMarketingVoucherCode,
  marketingVoucherError,
  prepareMarketingVoucherOperation,
  sha256,
  writeMarketingVoucherAudit,
  writeMarketingVoucherOperation,
  type MarketingVoucherOperationContext,
} from "./marketingVoucherRepository.js";
import { assertCampaignActivityAllowed } from "./marketingVoucherRepositoryGuards.js";

export interface MarketingVoucherRevokeResult {
  revoked_code_ids: string[];
  already_revoked_code_ids: string[];
}

const nextCounts = (
  campaign: MarketingVoucherCampaign,
  codes: MarketingVoucherCode[],
) => {
  const available = codes.filter((code) => code.status === "AVAILABLE").length;
  const distributed = codes.filter(
    (code) => code.status === "DISTRIBUTED",
  ).length;
  if (
    campaign.code_counts.available < available ||
    campaign.code_counts.distributed < distributed
  ) {
    throw marketingVoucherError(
      "MARKETING_VOUCHER_COUNTER_INCONSISTENT",
      {
        vi: "Bộ đếm chiến dịch không khớp với trạng thái mã. Cần đối soát trước khi tiếp tục.",
        zh: "活动计数与券码状态不一致，请先完成对账。",
      },
      409,
    );
  }
  return {
    ...campaign.code_counts,
    available: campaign.code_counts.available - available,
    distributed: campaign.code_counts.distributed - distributed,
    revoked: campaign.code_counts.revoked + codes.length,
  };
};

export const revokeMarketingVoucherCodesRecord = async (input: {
  request: RevokeMarketingVoucherCodesInput;
  context: MarketingVoucherOperationContext;
}): Promise<MarketingVoucherMutationResult<MarketingVoucherRevokeResult>> => {
  const uniqueCodeIds = [...new Set(input.request.code_ids)];
  const result = await db.runTransaction<
    MarketingVoucherRevokeResult & { replayed: boolean }
  >(async (transaction) => {
    const operation = await prepareMarketingVoucherOperation(
      transaction,
      "REVOKE_CODES",
      input.context,
      { ...input.request, code_ids: uniqueCodeIds },
    );
    if (operation.replay) {
      return {
        ...operation.replay,
        replayed: true,
      } as MarketingVoucherRevokeResult & {
        replayed: boolean;
      };
    }
    const codeSnapshots = await transaction.getAll(
      ...uniqueCodeIds.map(codeRef),
    );
    const missing = codeSnapshots
      .filter((snapshot) => !snapshot.exists)
      .map((snapshot) => snapshot.id);
    if (missing.length > 0) {
      throw marketingVoucherError(
        "MARKETING_VOUCHER_CODE_NOT_FOUND",
        {
          vi: "Không tìm thấy một hoặc nhiều mã voucher.",
          zh: "一个或多个优惠券码不存在。",
        },
        404,
        { code_ids: missing },
      );
    }
    const codes = codeSnapshots.map(mapMarketingVoucherCode);
    const used = codes.filter((code) => code.status === "USED");
    if (used.length > 0) {
      throw marketingVoucherError(
        "MARKETING_VOUCHER_USED_CODE_CANNOT_REVOKE",
        {
          vi: "Không thể vô hiệu mã đã sử dụng.",
          zh: "已使用的优惠券不能撤销。",
        },
        409,
        { code_ids: used.map((code) => code.id) },
      );
    }
    const changeable = codes.filter(
      (code) =>
        !code.is_deleted && ["AVAILABLE", "DISTRIBUTED"].includes(code.status),
    );
    const campaignIds = [
      ...new Set(changeable.map((code) => code.campaign_id)),
    ];
    const campaignSnapshots = campaignIds.length
      ? await transaction.getAll(...campaignIds.map(campaignRef))
      : [];
    const campaigns = campaignSnapshots.map((snapshot) => {
      if (!snapshot.exists || snapshot.get("is_deleted") === true) {
        throw marketingVoucherError(
          "MARKETING_VOUCHER_CAMPAIGN_NOT_FOUND",
          {
            vi: "Không tìm thấy chiến dịch của mã voucher.",
            zh: "未找到优惠券所属活动。",
          },
          404,
        );
      }
      const campaign = mapMarketingVoucherCampaign(snapshot);
      assertCampaignActivityAllowed(campaign, "REVOKE");
      return campaign;
    });
    const now = new Date();
    const updatedCodes = changeable.map(
      (code): MarketingVoucherCode => ({
        ...code,
        status: "REVOKED",
        revoked_at: now,
        revoked_by: input.context.actor_id,
        revoke_reason: input.request.reason,
        revision: code.revision + 1,
        updated_by: input.context.actor_id,
        updated_at: now,
        action_time: input.context.action_time,
        sync_time: now,
      }),
    );
    updatedCodes.forEach((updated, index) => {
      const previous = changeable[index];
      transaction.set(codeRef(updated.id), updated);
      writeMarketingVoucherAudit(transaction, {
        id: `${operation.id}:code:${sha256(updated.id)}`,
        action: AuditAction.MARKETING_VOUCHER_CODES_REVOKE,
        entity_type: "marketing_voucher_codes",
        entity_id: updated.id,
        entity_name: updated.campaign_name,
        context: input.context,
        old_value: previous,
        new_value: updated,
        sync_time: now,
        notes: input.request.reason,
      });
    });
    campaigns.forEach((previous) => {
      const campaignCodes = changeable.filter(
        (code) => code.campaign_id === previous.id,
      );
      const updated: MarketingVoucherCampaign = {
        ...previous,
        code_counts: nextCounts(previous, campaignCodes),
        revision: previous.revision + 1,
        updated_by: input.context.actor_id,
        updated_at: now,
        action_time: input.context.action_time,
        sync_time: now,
      };
      transaction.set(campaignRef(previous.id), updated);
      writeMarketingVoucherAudit(transaction, {
        id: `${operation.id}:campaign:${previous.id}`,
        action: AuditAction.MARKETING_VOUCHER_CODES_REVOKE,
        entity_type: "marketing_voucher_campaigns",
        entity_id: previous.id,
        entity_name: previous.name,
        context: input.context,
        old_value: previous,
        new_value: updated,
        sync_time: now,
        notes: `Revoked ${campaignCodes.length} voucher codes`,
      });
    });
    const operationResult: MarketingVoucherRevokeResult = {
      revoked_code_ids: updatedCodes.map((code) => code.id),
      already_revoked_code_ids: codes
        .filter((code) => code.status === "REVOKED")
        .map((code) => code.id),
    };
    writeMarketingVoucherOperation(
      transaction,
      operation,
      "REVOKE_CODES",
      input.context,
      { ...operationResult },
      now,
    );
    return { ...operationResult, replayed: false };
  });
  const { replayed, ...value } = result;
  return { value, replayed };
};
