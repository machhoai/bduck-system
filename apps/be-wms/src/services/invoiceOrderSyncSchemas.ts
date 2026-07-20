import { InvoiceOrderSyncPurpose } from "@bduck/shared-types";
import { z } from "zod";

const businessDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
  }, "business_date must be a valid YYYY-MM-DD date.");

export const invoiceOrderSyncInputSchema = z.object({
  warehouse_id: z.string().trim().min(1).max(200),
  business_date: businessDateSchema,
  purpose: z.nativeEnum(InvoiceOrderSyncPurpose),
});

export const invoiceOrderListQuerySchema = z.object({
  warehouse_id: z.string().trim().min(1).max(200),
  business_date: businessDateSchema,
});

export const invoiceOrderDetailInputSchema = z.object({
  id: z.string().trim().length(64).regex(/^[a-f0-9]+$/),
  warehouse_id: z.string().trim().min(1).max(200),
});

export const invoiceOrderPreviewInputSchema = z.object({
  warehouse_id: z.string().trim().min(1).max(200),
  expected_source_payload_hash: z.string().length(64).regex(/^[a-f0-9]+$/),
});

export type InvoiceOrderSyncInput = z.infer<typeof invoiceOrderSyncInputSchema>;
