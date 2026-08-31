import { z } from "zod";

const visibilityKey = z
  .string()
  .trim()
  .min(1)
  .max(256)
  .refine((value) => !value.includes("$"), "Invalid visibility key");

const uniqueKeys = z
  .array(visibilityKey)
  .max(2_000)
  .transform((values) => [...new Set(values)].sort());

export const posProductVisibilitySettingsSchema = z.object({
  expected_version: z.number().int().nonnegative(),
  disabled_group_keys: uniqueKeys,
  disabled_product_ids: uniqueKeys,
  action_time: z.string().datetime({ offset: true }),
});

export type PosProductVisibilitySettingsValue = z.infer<
  typeof posProductVisibilitySettingsSchema
>;

