import { ItemCondition } from "@bduck/shared-types";
import { z } from "zod";

const importVoucherItemSchema = z.object({
  id: z.string().uuid().optional(),
  product_id: z.string().uuid(),
  warehouse_location_id: z.string().uuid(),
  expected_quantity: z.number().int().positive(),
  actual_quantity: z.number().int().min(0).optional().default(0),
  unit_price: z.number().min(0),
  condition: z.nativeEnum(ItemCondition),
  notes: z.string().max(500).nullable().optional(),
});

export const createImportVoucherSchema = z.object({
  warehouse_id: z.string().uuid(),
  supplier_name: z.string().min(1).max(200),
  purchase_order_id: z.string().uuid().nullable().optional(),
  items: z.array(importVoucherItemSchema).min(1),
  notes: z.string().max(1000).nullable().optional(),
  /** Firebase Storage download URLs for attached documents */
  attachment_urls: z.array(z.string().url()).max(10).optional().default([]),
  /** ISO â€” client offline time */
  action_time: z.string().datetime().optional(),
  otp: z.string().optional(),
});

export type CreateImportVoucherInput = z.infer<
  typeof createImportVoucherSchema
>;

export const updateImportVoucherSchema = createImportVoucherSchema;
export type UpdateImportVoucherInput = CreateImportVoucherInput;
