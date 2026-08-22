import type {
  MarketingVoucherCampaignPage,
  MarketingVoucherCodePage,
  MarketingVoucherJobPage,
} from "@bduck/shared-types";

import { db } from "../config/firebase.js";

import {
  campaignRef,
  codeRef,
  jobRef,
  mapMarketingVoucherCampaign,
  mapMarketingVoucherCode,
  mapMarketingVoucherJob,
} from "./marketingVoucherRepository.js";

const pageFromSnapshots = <T>(
  snapshots: FirebaseFirestore.QueryDocumentSnapshot[],
  limit: number,
  mapper: (snapshot: FirebaseFirestore.QueryDocumentSnapshot) => T,
) => {
  const hasMore = snapshots.length > limit;
  const page = hasMore ? snapshots.slice(0, limit) : snapshots;
  return {
    items: page.map(mapper),
    next_cursor: hasMore ? (page.at(-1)?.id ?? null) : null,
  };
};

export const findMarketingVoucherCampaignById = async (campaignId: string) => {
  const snapshot = await campaignRef(campaignId).get();
  return snapshot.exists && snapshot.get("is_deleted") !== true
    ? mapMarketingVoucherCampaign(snapshot)
    : null;
};

export const listMarketingVoucherCampaigns = async (input: {
  status?: string;
  purpose?: string;
  cursor?: string;
  limit: number;
}): Promise<MarketingVoucherCampaignPage> => {
  let query: FirebaseFirestore.Query = db
    .collection("marketing_voucher_campaigns")
    .where("is_deleted", "==", false);
  if (input.status) query = query.where("status", "==", input.status);
  if (input.purpose) query = query.where("purpose", "==", input.purpose);
  query = query.orderBy("updated_at", "desc");
  if (input.cursor) {
    const cursor = await campaignRef(input.cursor).get();
    if (cursor.exists) query = query.startAfter(cursor);
  }
  const snapshot = await query.limit(input.limit + 1).get();
  return pageFromSnapshots(
    snapshot.docs,
    input.limit,
    mapMarketingVoucherCampaign,
  );
};

export const findMarketingVoucherCodeById = async (codeId: string) => {
  const snapshot = await codeRef(codeId).get();
  return snapshot.exists && snapshot.get("is_deleted") !== true
    ? mapMarketingVoucherCode(snapshot)
    : null;
};

export const listMarketingVoucherCodes = async (input: {
  campaign_id?: string;
  status?: string;
  reward_type?: string;
  code?: string;
  cursor?: string;
  limit: number;
}): Promise<MarketingVoucherCodePage> => {
  if (input.code) {
    const code = await findMarketingVoucherCodeById(input.code);
    const matches =
      code &&
      (!input.campaign_id || code.campaign_id === input.campaign_id) &&
      (!input.status || code.status === input.status) &&
      (!input.reward_type || code.reward_type === input.reward_type);
    return { items: matches && code ? [code] : [], next_cursor: null };
  }

  let query: FirebaseFirestore.Query = db
    .collection("marketing_voucher_codes")
    .where("is_deleted", "==", false);
  if (input.campaign_id) {
    query = query.where("campaign_id", "==", input.campaign_id);
  }
  if (input.status) query = query.where("status", "==", input.status);
  if (input.reward_type) {
    query = query.where("reward_type", "==", input.reward_type);
  }
  query = query.orderBy("created_at", "desc");
  if (input.cursor) {
    const cursor = await codeRef(input.cursor).get();
    if (cursor.exists) query = query.startAfter(cursor);
  }
  const snapshot = await query.limit(input.limit + 1).get();
  return pageFromSnapshots(snapshot.docs, input.limit, mapMarketingVoucherCode);
};

export const findMarketingVoucherJobById = async (jobId: string) => {
  const snapshot = await jobRef(jobId).get();
  return snapshot.exists && snapshot.get("is_deleted") !== true
    ? mapMarketingVoucherJob(snapshot)
    : null;
};

export const listMarketingVoucherJobs = async (input: {
  campaign_id?: string;
  status?: string;
  type?: string;
  cursor?: string;
  limit: number;
}): Promise<MarketingVoucherJobPage> => {
  let query: FirebaseFirestore.Query = db
    .collection("marketing_voucher_jobs")
    .where("is_deleted", "==", false);
  if (input.campaign_id) {
    query = query.where("campaign_id", "==", input.campaign_id);
  }
  if (input.status) query = query.where("status", "==", input.status);
  if (input.type) query = query.where("type", "==", input.type);
  query = query.orderBy("created_at", "desc");
  if (input.cursor) {
    const cursor = await jobRef(input.cursor).get();
    if (cursor.exists) query = query.startAfter(cursor);
  }
  const snapshot = await query.limit(input.limit + 1).get();
  return pageFromSnapshots(snapshot.docs, input.limit, mapMarketingVoucherJob);
};
