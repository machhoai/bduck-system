import { TransferType } from "@bduck/shared-types";
import { z } from "zod";

const transferItemSchema = z.object({
  product_id: z.string().uuid(),
  source_location_id: z.string().uuid(),
  destination_location_id: z.string().uuid().nullable().optional(),
  quantity: z.number().int().positive(),
});

export const createTransferOrderSchema = z.object({
  transfer_type: z.nativeEnum(TransferType),
  source_warehouse_id: z.string().uuid(),
  destination_warehouse_id: z.string().uuid(),
  items: z.array(transferItemSchema).min(1).max(150),
  notes: z.string().max(1000).nullable().optional(),
  attachment_urls: z.array(z.string().url()).max(10).optional().default([]),
  action_time: z.string().datetime().optional(),
  otp: z.string().optional(),
});

export type CreateTransferOrderInput = z.infer<
  typeof createTransferOrderSchema
>;

export const updateTransferOrderSchema = createTransferOrderSchema;
export type UpdateTransferOrderInput = CreateTransferOrderInput;
