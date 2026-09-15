import { z } from "zod";

const safeId = z
  .string()
  .min(1)
  .max(160)
  .refine((value) => !value.includes("$") && value === value.trim(), {
    message: "Invalid identifier",
  });

export const warehouseMappingParamsSchema = z.object({
  warehouseId: z.string().uuid(),
});

export const categoryMappingParamsSchema = z.object({
  categoryId: z.string().uuid(),
});

export const saveWarehouseMappingSchema = z.object({
  partner_stock_id: safeId,
});

export const saveCategoryMappingSchema = z.object({
  partner_type_id: safeId,
});

export const createComparisonSchema = z.object({
  action_time: z.iso.datetime(),
});

export const createSyncJobSchema = z.object({
  snapshot_id: z.string().uuid(),
  product_ids: z.array(z.string().uuid()).min(1).max(200),
  request_id: z.string().uuid(),
  action_time: z.iso.datetime(),
});

export const joyWorldEnvelopeSchema = z.object({
  success: z.boolean(),
  msg: z.string().optional().default(""),
  code: z.number().optional().default(0),
  data: z.unknown().optional(),
  desc: z.string().optional().default(""),
  totals: z.number().optional(),
});

export const joyWorldKeyValueSchema = z.object({
  key: safeId,
  value: z.string().min(1).max(300),
});

export const joyWorldStockRowSchema = z.object({
  id: safeId,
  stockId: safeId,
  stockName: z.string().min(1),
  giftId: safeId,
  giftName: z.string().min(1),
  giftNo: z.string().min(1),
  amount: z.number().finite(),
  giftPrice: z.number().finite().optional().default(0),
  isEnabled: z.boolean().optional().default(true),
  updateTime: z.string().optional().default(""),
});

export const joyWorldGiftDetailsSchema = z.object({
  id: safeId,
  giftNo: z.string().min(1),
  giftName: z.string().min(1),
  isOpenExpire: z.boolean().optional().default(false),
});

export type JoyWorldStockRow = z.infer<typeof joyWorldStockRowSchema>;

