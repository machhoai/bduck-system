"use client";

import type {
  ChangeMarketingVoucherCampaignStatusInput,
  CreateMarketingVoucherCampaignInput,
  CreateMarketingVoucherEmailJobInput,
  ExtendMarketingVoucherCampaignInput,
  GenerateMarketingVoucherCodesInput,
  MarketingVoucherCampaignMutationResult,
  MarketingVoucherMutationResult,
  ResumeMarketingVoucherJobInput,
  RetryMarketingVoucherJobItemsInput,
  RevokeMarketingVoucherCodesInput,
  UpdateMarketingVoucherCampaignInput,
  UpdateMarketingVoucherAppearanceInput,
} from "@bduck/shared-types";

import { createDetailedApiError } from "@/utils/apiError";
import { authenticatedFetch } from "@/utils/authenticatedFetch";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://api.wms.localhost";
const API_PATH = "/api/marketing-vouchers";

interface RevokeResult {
  revoked_code_ids: string[];
  already_revoked_code_ids: string[];
}

const voucherFetch = async <T>(
  path: string,
  fallbackMessage: string,
  init: RequestInit,
): Promise<T> => {
  const response = await authenticatedFetch(
    `${API_BASE_URL}${API_PATH}${path}`,
    {
      ...init,
      headers: init.body
        ? { "Content-Type": "application/json", ...init.headers }
        : init.headers,
    },
  );
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.success) {
    throw createDetailedApiError(response, body, fallbackMessage);
  }
  return body.data as T;
};

export const createMarketingVoucherIdempotencyKey = (prefix: string) =>
  `${prefix}:${crypto.randomUUID()}`;

export const createMarketingVoucherCampaign = (
  input: CreateMarketingVoucherCampaignInput,
  fallbackMessage: string,
) =>
  voucherFetch<MarketingVoucherCampaignMutationResult>(
    "/campaigns",
    fallbackMessage,
    { method: "POST", body: JSON.stringify(input) },
  );

export const updateMarketingVoucherCampaign = (
  campaignId: string,
  input: UpdateMarketingVoucherCampaignInput,
  fallbackMessage: string,
) =>
  voucherFetch<MarketingVoucherCampaignMutationResult>(
    `/campaigns/${encodeURIComponent(campaignId)}`,
    fallbackMessage,
    { method: "PUT", body: JSON.stringify(input) },
  );

export const updateMarketingVoucherAppearance = (
  campaignId: string,
  input: UpdateMarketingVoucherAppearanceInput,
  fallbackMessage: string,
) =>
  voucherFetch<MarketingVoucherCampaignMutationResult>(
    `/campaigns/${encodeURIComponent(campaignId)}/appearance`,
    fallbackMessage,
    { method: "PUT", body: JSON.stringify(input) },
  );

export const changeMarketingVoucherCampaignStatus = (
  campaignId: string,
  input: ChangeMarketingVoucherCampaignStatusInput,
  fallbackMessage: string,
) =>
  voucherFetch<MarketingVoucherCampaignMutationResult>(
    `/campaigns/${encodeURIComponent(campaignId)}/status`,
    fallbackMessage,
    { method: "POST", body: JSON.stringify(input) },
  );

export const generateMarketingVoucherCodes = (
  campaignId: string,
  input: GenerateMarketingVoucherCodesInput,
  fallbackMessage: string,
) =>
  voucherFetch<MarketingVoucherCampaignMutationResult>(
    `/campaigns/${encodeURIComponent(campaignId)}/generate`,
    fallbackMessage,
    { method: "POST", body: JSON.stringify(input) },
  );

export const extendMarketingVoucherCampaign = (
  campaignId: string,
  input: ExtendMarketingVoucherCampaignInput,
  fallbackMessage: string,
) =>
  voucherFetch<MarketingVoucherCampaignMutationResult>(
    `/campaigns/${encodeURIComponent(campaignId)}/extend`,
    fallbackMessage,
    { method: "POST", body: JSON.stringify(input) },
  );

export const revokeMarketingVoucherCodes = (
  input: RevokeMarketingVoucherCodesInput,
  fallbackMessage: string,
) =>
  voucherFetch<MarketingVoucherMutationResult<RevokeResult>>(
    "/codes/revoke",
    fallbackMessage,
    { method: "POST", body: JSON.stringify(input) },
  );

export const softDeleteMarketingVoucherCampaign = (
  campaignId: string,
  input: {
    expected_revision: number;
    idempotency_key: string;
    action_time: Date;
  },
  fallbackMessage: string,
) =>
  voucherFetch<MarketingVoucherCampaignMutationResult>(
    `/campaigns/${encodeURIComponent(campaignId)}`,
    fallbackMessage,
    { method: "DELETE", body: JSON.stringify(input) },
  );

export const resumeMarketingVoucherJob = (
  jobId: string,
  input: ResumeMarketingVoucherJobInput,
  fallbackMessage: string,
) =>
  voucherFetch<MarketingVoucherCampaignMutationResult>(
    `/jobs/${encodeURIComponent(jobId)}/resume`,
    fallbackMessage,
    { method: "POST", body: JSON.stringify(input) },
  );

export const createMarketingVoucherEmailJob = (
  input: CreateMarketingVoucherEmailJobInput,
  fallbackMessage: string,
) =>
  voucherFetch<MarketingVoucherCampaignMutationResult>(
    "/email-jobs",
    fallbackMessage,
    { method: "POST", body: JSON.stringify(input) },
  );

export const retryMarketingVoucherEmailItems = (
  jobId: string,
  input: RetryMarketingVoucherJobItemsInput,
  fallbackMessage: string,
) =>
  voucherFetch<MarketingVoucherCampaignMutationResult>(
    `/jobs/${encodeURIComponent(jobId)}/email-items/retry`,
    fallbackMessage,
    { method: "POST", body: JSON.stringify(input) },
  );
