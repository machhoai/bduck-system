import { z } from "zod";

const safeId = z
  .string()
  .trim()
  .min(1)
  .max(160)
  .regex(/^[A-Za-z0-9_-]+$/u, "IDENTIFIER_INVALID");

export const posVoucherCampaignParamsSchema = z.object({
  warehouseId: safeId,
  campaignId: safeId,
});

export const posVoucherCampaignSettingSchema = z.object({
  enabled: z.boolean(),
  product_id: safeId,
  quantity: z.number().int().min(1).max(999),
  expected_version: z.number().int().nonnegative(),
  action_time: z.string().datetime({ offset: true }),
});

export type PosVoucherCampaignSettingValue = z.infer<
  typeof posVoucherCampaignSettingSchema
>;
