import {
  MARKETING_VOUCHER_CAMPAIGNS_COLLECTION,
  MARKETING_VOUCHER_CODES_COLLECTION,
} from "@bduck/shared-types";
import type { Firestore } from "firebase-admin/firestore";

import type { SourceCampaignScan } from "./marketingVoucherMigrationTypes.js";

export interface MigrationUatResult {
  campaignIds: string[];
  passed: boolean;
  issues: string[];
}

const selectSizeTiers = (
  campaigns: SourceCampaignScan[],
): SourceCampaignScan[] => {
  if (campaigns.length <= 3) return campaigns;
  const sorted = [...campaigns].sort(
    (left, right) => left.counts.total - right.counts.total,
  );
  return [sorted[0]!, sorted[Math.floor(sorted.length / 2)]!, sorted.at(-1)!];
};

export const runMarketingVoucherMigrationUat = async (input: {
  target: Firestore;
  campaigns: SourceCampaignScan[];
  piiRedacted: boolean;
}): Promise<MigrationUatResult> => {
  const selected = selectSizeTiers(input.campaigns);
  const issues: string[] = [];
  for (const source of selected) {
    const campaign = await input.target
      .collection(MARKETING_VOUCHER_CAMPAIGNS_COLLECTION)
      .doc(source.id)
      .get();
    if (!campaign.exists) {
      issues.push(`UAT_CAMPAIGN_MISSING:${source.id}`);
      continue;
    }
    if (Number(campaign.get("total_issued")) !== source.counts.total) {
      issues.push(`UAT_CAMPAIGN_TOTAL_MISMATCH:${source.id}`);
    }
    if (
      campaign.get("legacy_metadata.purpose_defaulted") === true &&
      campaign.get("purpose") !== "EVENT"
    ) {
      issues.push(`UAT_PURPOSE_DEFAULT_INVALID:${source.id}`);
    }
    const sample = await input.target
      .collection(MARKETING_VOUCHER_CODES_COLLECTION)
      .where("campaign_id", "==", source.id)
      .limit(25)
      .get();
    if (source.counts.total > 0 && sample.empty) {
      issues.push(`UAT_CODE_SAMPLE_EMPTY:${source.id}`);
    }
    if (!input.piiRedacted) continue;
    for (const code of sample.docs) {
      const phone = code.get("distributed_to_phone");
      const email = code.get("emailed_to");
      const staffId = code.get("used_by_staff_id");
      const staffName = code.get("used_by_staff_name");
      if (phone && !String(phone).startsWith("phone-")) {
        issues.push(`UAT_PHONE_NOT_REDACTED:${code.id}`);
      }
      if (email && !String(email).endsWith("@example.invalid")) {
        issues.push(`UAT_EMAIL_NOT_REDACTED:${code.id}`);
      }
      if (staffId && !String(staffId).startsWith("staff-")) {
        issues.push(`UAT_STAFF_ID_NOT_REDACTED:${code.id}`);
      }
      if (staffName && staffName !== "[REDACTED]") {
        issues.push(`UAT_STAFF_NAME_NOT_REDACTED:${code.id}`);
      }
    }
  }
  return {
    campaignIds: selected.map((campaign) => campaign.id),
    passed: issues.length === 0,
    issues,
  };
};
