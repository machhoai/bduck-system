import { z } from "zod";

import {
  MARKETING_VOUCHER_CAMPAIGN_STATUSES,
  getMarketingVoucherSafeCodeCapacity,
  MARKETING_VOUCHER_CODE_STATUSES,
  MARKETING_VOUCHER_JOB_STATUSES,
  MARKETING_VOUCHER_JOB_TYPES,
  MARKETING_VOUCHER_REWARD_TYPES,
} from "./marketingVouchers.js";

const localDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/u, "DATE_MUST_BE_YYYY_MM_DD")
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return (
      Number.isFinite(parsed.getTime()) &&
      parsed.toISOString().slice(0, 10) === value
    );
  }, "DATE_INVALID");
const identifierSchema = z
  .string()
  .trim()
  .min(1)
  .max(160)
  .regex(/^[A-Za-z0-9_-]+$/u, "IDENTIFIER_INVALID");
const noSqlOperatorPattern = /\$(?:where|ne|gt|gte|lt|lte|in|nin|or|and)\b/iu;
const safeTextSchema = (maximum: number) =>
  z
    .string()
    .trim()
    .max(maximum)
    .refine((value) => !noSqlOperatorPattern.test(value), {
      message: "UNSAFE_QUERY_OPERATOR",
    });

export const marketingVoucherRewardTypeSchema = z.enum(
  MARKETING_VOUCHER_REWARD_TYPES,
);
export const marketingVoucherCampaignStatusSchema = z.enum(
  MARKETING_VOUCHER_CAMPAIGN_STATUSES,
);
export const marketingVoucherCodeStatusSchema = z.enum(
  MARKETING_VOUCHER_CODE_STATUSES,
);
export const marketingVoucherJobTypeSchema = z.enum(
  MARKETING_VOUCHER_JOB_TYPES,
);
export const marketingVoucherJobStatusSchema = z.enum(
  MARKETING_VOUCHER_JOB_STATUSES,
);
export const marketingVoucherCampaignPurposeSchema = z.enum(["EVENT", "PRINT"]);
export const marketingVoucherAccentColorSchema = z
  .string()
  .regex(/^#[0-9A-F]{6}$/iu, "HEX_COLOR_INVALID");
export const marketingVoucherIdempotencyKeySchema = z
  .string()
  .trim()
  .min(8)
  .max(128)
  .regex(/^[A-Za-z0-9:_-]+$/u, "IDEMPOTENCY_KEY_INVALID");

const rewardFieldsSchema = z
  .object({
    reward_type: marketingVoucherRewardTypeSchema,
    reward_value: z.number().finite().min(0).max(1_000_000_000),
  })
  .superRefine((value, context) => {
    if (
      value.reward_type === "DISCOUNT_PERCENT" &&
      (value.reward_value <= 0 || value.reward_value > 100)
    ) {
      context.addIssue({
        code: "custom",
        path: ["reward_value"],
        message: "DISCOUNT_PERCENT_OUT_OF_RANGE",
      });
    }
  });

export const createMarketingVoucherCampaignSchema = z
  .object({
    name: safeTextSchema(160).min(1),
    description: safeTextSchema(2_000),
    valid_from: localDateSchema,
    valid_to: localDateSchema,
    prefix: safeTextSchema(20).regex(/^[A-Za-z0-9-]*$/u),
    code_length: z.number().int().min(4).max(12),
    suffix: safeTextSchema(20).regex(/^[A-Za-z0-9-]*$/u),
    purpose: marketingVoucherCampaignPurposeSchema,
    accent_color: marketingVoucherAccentColorSchema,
    requested_code_count: z.number().int().min(1).max(1_000_000),
    idempotency_key: marketingVoucherIdempotencyKeySchema,
    action_time: z.coerce.date(),
  })
  .and(rewardFieldsSchema)
  .superRefine((value, context) => {
    if (
      value.requested_code_count >
      getMarketingVoucherSafeCodeCapacity(value.code_length)
    ) {
      context.addIssue({
        code: "custom",
        path: ["requested_code_count"],
        message: "REQUESTED_CODE_COUNT_EXCEEDS_SAFE_CODE_SPACE",
      });
    }
  })
  .refine((value) => value.valid_from <= value.valid_to, {
    path: ["valid_to"],
    message: "VALID_TO_BEFORE_VALID_FROM",
  });

export const updateMarketingVoucherCampaignSchema = z.object({
  name: safeTextSchema(160).min(1).optional(),
  description: safeTextSchema(2_000).optional(),
  valid_from: localDateSchema.optional(),
  valid_to: localDateSchema.optional(),
  purpose: marketingVoucherCampaignPurposeSchema.optional(),
  reward_type: marketingVoucherRewardTypeSchema.optional(),
  reward_value: z.number().finite().min(0).max(1_000_000_000).optional(),
  expected_revision: z.number().int().nonnegative(),
  idempotency_key: marketingVoucherIdempotencyKeySchema,
  action_time: z.coerce.date(),
});

const mutationMetadataSchema = z.object({
  expected_revision: z.number().int().nonnegative(),
  idempotency_key: marketingVoucherIdempotencyKeySchema,
  action_time: z.coerce.date(),
});

export const generateMarketingVoucherCodesSchema = z
  .object({ quantity: z.number().int().min(1).max(1_000_000) })
  .and(mutationMetadataSchema);

export const revokeMarketingVoucherCodesSchema = z.object({
  code_ids: z.array(identifierSchema).min(1).max(5_000),
  reason: safeTextSchema(500).min(1),
  idempotency_key: marketingVoucherIdempotencyKeySchema,
  action_time: z.coerce.date(),
});

export const extendMarketingVoucherCampaignSchema = z
  .object({ valid_to: localDateSchema })
  .and(mutationMetadataSchema);

export const updateMarketingVoucherAppearanceSchema = z
  .object({ accent_color: marketingVoucherAccentColorSchema })
  .and(mutationMetadataSchema);

export const changeMarketingVoucherCampaignStatusSchema = z
  .object({ status: z.enum(["ACTIVE", "PAUSED"]) })
  .and(mutationMetadataSchema);

export const deleteMarketingVoucherCampaignSchema = mutationMetadataSchema;

export const createMarketingVoucherExportJobSchema = z.object({
  campaign_id: identifierSchema,
  idempotency_key: marketingVoucherIdempotencyKeySchema,
  action_time: z.coerce.date(),
});

export const marketingVoucherEmailRecipientSchema = z.object({
  email: z.email().max(320),
  voucher_code_ids: z.array(identifierSchema).min(1).max(100),
});

export const createMarketingVoucherEmailJobSchema = z.object({
  campaign_id: identifierSchema,
  recipients: z.array(marketingVoucherEmailRecipientSchema).min(1).max(500),
  subject: safeTextSchema(200).min(1),
  introduction: safeTextSchema(5_000),
  idempotency_key: marketingVoucherIdempotencyKeySchema,
  action_time: z.coerce.date(),
});

export const retryMarketingVoucherJobItemsSchema = z.object({
  job_id: identifierSchema,
  item_ids: z.array(identifierSchema).min(1).max(500),
  idempotency_key: marketingVoucherIdempotencyKeySchema,
  action_time: z.coerce.date(),
});

export const marketingVoucherCampaignQuerySchema = z.object({
  status: marketingVoucherCampaignStatusSchema.optional(),
  purpose: marketingVoucherCampaignPurposeSchema.optional(),
  cursor: identifierSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export const marketingVoucherJobQuerySchema = z.object({
  campaign_id: identifierSchema.optional(),
  status: marketingVoucherJobStatusSchema.optional(),
  type: marketingVoucherJobTypeSchema.optional(),
  cursor: identifierSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export const marketingVoucherCampaignParamsSchema = z.object({
  campaignId: identifierSchema,
});

export const marketingVoucherJobParamsSchema = z.object({
  jobId: identifierSchema,
});

export const marketingVoucherCodeParamsSchema = z.object({
  codeId: identifierSchema,
});

export const resumeMarketingVoucherJobSchema = z.object({
  expected_job_revision: z.number().int().nonnegative(),
  expected_campaign_revision: z.number().int().nonnegative(),
  idempotency_key: marketingVoucherIdempotencyKeySchema,
  action_time: z.coerce.date(),
});

export const marketingVoucherCodeQuerySchema = z.object({
  campaign_id: identifierSchema.optional(),
  status: marketingVoucherCodeStatusSchema.optional(),
  reward_type: marketingVoucherRewardTypeSchema.optional(),
  code: identifierSchema.optional(),
  cursor: identifierSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type CreateMarketingVoucherCampaignInput = z.infer<
  typeof createMarketingVoucherCampaignSchema
>;
export type UpdateMarketingVoucherCampaignInput = z.infer<
  typeof updateMarketingVoucherCampaignSchema
>;
export type GenerateMarketingVoucherCodesInput = z.infer<
  typeof generateMarketingVoucherCodesSchema
>;
export type RevokeMarketingVoucherCodesInput = z.infer<
  typeof revokeMarketingVoucherCodesSchema
>;
export type ExtendMarketingVoucherCampaignInput = z.infer<
  typeof extendMarketingVoucherCampaignSchema
>;
export type UpdateMarketingVoucherAppearanceInput = z.infer<
  typeof updateMarketingVoucherAppearanceSchema
>;
export type ChangeMarketingVoucherCampaignStatusInput = z.infer<
  typeof changeMarketingVoucherCampaignStatusSchema
>;
export type CreateMarketingVoucherExportJobInput = z.infer<
  typeof createMarketingVoucherExportJobSchema
>;
export type CreateMarketingVoucherEmailJobInput = z.infer<
  typeof createMarketingVoucherEmailJobSchema
>;
export type RetryMarketingVoucherJobItemsInput = z.infer<
  typeof retryMarketingVoucherJobItemsSchema
>;
export type ResumeMarketingVoucherJobInput = z.infer<
  typeof resumeMarketingVoucherJobSchema
>;
