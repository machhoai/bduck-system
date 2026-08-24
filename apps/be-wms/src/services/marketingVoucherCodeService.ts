import { createHash } from "node:crypto";

import type {
  GenerateMarketingVoucherCodesInput,
  RevokeMarketingVoucherCodesInput,
} from "@bduck/shared-types";

import { createMarketingVoucherGenerationJobRecord } from "../repositories/marketingVoucherJobMutationRepository.js";
import {
  findMarketingVoucherCodeById,
  listMarketingVoucherCodes,
} from "../repositories/marketingVoucherQueryRepository.js";
import { revokeMarketingVoucherCodesRecord } from "../repositories/marketingVoucherRevokeRepository.js";

import type { AuthorizationService } from "./authorization/index.js";
import { assertMarketingVoucherPermission } from "./marketingVoucherAccessPolicy.js";
import {
  marketingVoucherOperationContext,
  type MarketingVoucherRequestMetadata,
} from "./marketingVoucherOperationContext.js";
import { dispatchMarketingVoucherJob } from "./marketingVoucherTaskDispatcher.js";

export const getMarketingVoucherCodes = async (
  query: {
    campaign_id?: string;
    status?: string;
    reward_type?: string;
    code?: string;
    cursor?: string;
    limit: number;
  },
  authorization: AuthorizationService,
) => {
  assertMarketingVoucherPermission(authorization, "marketing_vouchers.read");
  return listMarketingVoucherCodes(query);
};

export const getMarketingVoucherCode = async (
  codeId: string,
  authorization: AuthorizationService,
) => {
  assertMarketingVoucherPermission(authorization, "marketing_vouchers.read");
  const code = await findMarketingVoucherCodeById(codeId);
  if (!code) {
    throw {
      code: "MARKETING_VOUCHER_CODE_NOT_FOUND",
      statusCode: 404,
      messages: { vi: "Không tìm thấy mã voucher.", zh: "未找到优惠券码。" },
    };
  }
  return code;
};

export const generateMarketingVoucherCodes = async (
  campaignId: string,
  request: GenerateMarketingVoucherCodesInput,
  actorId: string,
  authorization: AuthorizationService,
  metadata: MarketingVoucherRequestMetadata,
) => {
  assertMarketingVoucherPermission(
    authorization,
    "marketing_vouchers.codes.generate",
  );
  const result = await createMarketingVoucherGenerationJobRecord({
    campaign_id: campaignId,
    request,
    context: marketingVoucherOperationContext({
      actorId,
      actionTime: request.action_time,
      idempotencyKey: request.idempotency_key,
      metadata,
    }),
  });
  if (result.job) {
    await dispatchMarketingVoucherJob({
      jobId: result.job.id,
      revision: result.job.revision,
    });
  }
  return result;
};

export const revokeMarketingVoucherCodes = async (
  request: RevokeMarketingVoucherCodesInput,
  actorId: string,
  authorization: AuthorizationService,
  metadata: MarketingVoucherRequestMetadata,
) => {
  assertMarketingVoucherPermission(
    authorization,
    "marketing_vouchers.codes.revoke",
  );
  const codeIds = [...new Set(request.code_ids)];
  const chunks = Array.from(
    { length: Math.ceil(codeIds.length / 100) },
    (_, index) => codeIds.slice(index * 100, (index + 1) * 100),
  );
  const revokedCodeIds: string[] = [];
  const alreadyRevokedCodeIds: string[] = [];
  let allReplayed = true;
  for (const [index, chunk] of chunks.entries()) {
    const chunkKey = `revoke:${createHash("sha256")
      .update(`${request.idempotency_key}:${index}`)
      .digest("hex")
      .slice(0, 48)}`;
    const result = await revokeMarketingVoucherCodesRecord({
      request: { ...request, code_ids: chunk, idempotency_key: chunkKey },
      context: marketingVoucherOperationContext({
        actorId,
        actionTime: request.action_time,
        idempotencyKey: chunkKey,
        metadata,
      }),
    });
    revokedCodeIds.push(...result.value.revoked_code_ids);
    alreadyRevokedCodeIds.push(...result.value.already_revoked_code_ids);
    allReplayed = allReplayed && result.replayed;
  }
  return {
    value: {
      revoked_code_ids: revokedCodeIds,
      already_revoked_code_ids: alreadyRevokedCodeIds,
    },
    replayed: allReplayed,
  };
};
