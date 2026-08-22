import type {
  MarketingVoucherCampaign,
  MarketingVoucherJob,
} from "@bduck/shared-types";

import { marketingVoucherError } from "./marketingVoucherRepository.js";

export type MarketingVoucherCampaignActivity =
  | "VIEW"
  | "EDIT"
  | "GENERATE"
  | "REVOKE"
  | "EXTEND"
  | "EXPORT"
  | "EMAIL"
  | "REDEEM";

const PAUSE_BLOCKED_ACTIVITIES = new Set<MarketingVoucherCampaignActivity>([
  "GENERATE",
  "EXPORT",
  "EMAIL",
  "REDEEM",
]);

export const assertCampaignActivityAllowed = (
  campaign: Pick<MarketingVoucherCampaign, "status" | "is_deleted">,
  activity: MarketingVoucherCampaignActivity,
) => {
  if (campaign.is_deleted || campaign.status === "ENDED") {
    throw marketingVoucherError(
      "MARKETING_VOUCHER_CAMPAIGN_ENDED",
      { vi: "Chiến dịch đã kết thúc.", zh: "优惠券活动已结束。" },
      409,
    );
  }
  if (
    campaign.status === "PAUSED" &&
    PAUSE_BLOCKED_ACTIVITIES.has(activity)
  ) {
    throw marketingVoucherError(
      "MARKETING_VOUCHER_CAMPAIGN_PAUSED",
      {
        vi: "Chiến dịch đang tạm dừng nên hoạt động này bị chặn.",
        zh: "活动已暂停，此操作被阻止。",
      },
      409,
    );
  }
};

export const assertMarketingVoucherRevision = (
  actual: number,
  expected: number,
  entity: "CAMPAIGN" | "JOB" = "CAMPAIGN",
) => {
  if (actual !== expected) {
    throw marketingVoucherError(
      `MARKETING_VOUCHER_${entity}_REVISION_CONFLICT`,
      {
        vi: "Dữ liệu đã thay đổi. Vui lòng tải trạng thái mới nhất và thử lại.",
        zh: "数据已更改，请加载最新状态后重试。",
      },
      409,
      { expected_revision: expected, actual_revision: actual },
    );
  }
};

export const assertCampaignMutable = (campaign: MarketingVoucherCampaign) => {
  if (campaign.is_deleted || campaign.status === "ENDED") {
    throw marketingVoucherError(
      "MARKETING_VOUCHER_CAMPAIGN_NOT_MUTABLE",
      {
        vi: "Chiến dịch đã kết thúc hoặc bị xóa nên không thể chỉnh sửa.",
        zh: "活动已结束或删除，无法修改。",
      },
      409,
    );
  }
};

export const assertCampaignAllowsGeneration = (
  campaign: MarketingVoucherCampaign,
) => {
  assertCampaignActivityAllowed(campaign, "GENERATE");
  assertCampaignMutable(campaign);
  if (
    campaign.status !== "ACTIVE" ||
    campaign.active_generation_job_id ||
    campaign.active_extension_job_id
  ) {
    throw marketingVoucherError(
      "MARKETING_VOUCHER_GENERATION_NOT_ALLOWED",
      {
        vi: "Chỉ có thể sinh thêm mã khi chiến dịch đang hoạt động và không có job thay đổi mã khác.",
        zh: "仅当活动处于启用状态且没有其他券码变更任务时才能追加券码。",
      },
      409,
    );
  }
};

export const assertGenerationJob = (job: MarketingVoucherJob) => {
  if (job.type !== "GENERATE_CODES" || job.is_deleted) {
    throw marketingVoucherError(
      "MARKETING_VOUCHER_GENERATION_JOB_INVALID",
      {
        vi: "Job sinh mã không hợp lệ hoặc đã bị xóa.",
        zh: "券码生成任务无效或已删除。",
      },
      409,
    );
  }
};
