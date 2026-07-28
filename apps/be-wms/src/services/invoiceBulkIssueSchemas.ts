import { z } from "zod";
import { invoiceDisplayMappingSchema } from "./meInvoiceConfigSchemas.js";

const scopedId = z.string().trim().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/);
const businessDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().startsWith(value);
}, "Invalid business date");

const bulkSelectionSchema = z.object({
  warehouse_id: scopedId,
  business_date: businessDate,
  selection_mode: z.enum(["SELECTED", "ALL"]),
  source_order_ids: z.array(scopedId).max(1000).default([]),
}).superRefine((value, context) => {
  if (value.selection_mode === "SELECTED" && value.source_order_ids.length === 0) {
    context.addIssue({
      code: "custom",
      path: ["source_order_ids"],
      message: "At least one source order is required",
    });
  }
  if (value.selection_mode === "ALL" && value.source_order_ids.length > 0) {
    context.addIssue({
      code: "custom",
      path: ["source_order_ids"],
      message: "ALL selection must not include source order ids",
    });
  }
});

export const previewInvoiceBulkIssueSchema = bulkSelectionSchema;

export const createInvoiceBulkIssueSchema = bulkSelectionSchema.and(z.object({
  otp: z.string().regex(/^\d{6}$/),
  idempotency_key: z.string().trim().min(8).max(128),
  config_fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  action_time: z.coerce.date(),
}));

export const invoiceBulkDisplayConfigQuerySchema = z.object({
  warehouse_id: scopedId,
  business_date: businessDate,
});

export const saveInvoiceBulkDisplayConfigSchema =
  invoiceBulkDisplayConfigQuerySchema.extend({
    item_name_mapping: invoiceDisplayMappingSchema,
    item_unit_mapping: invoiceDisplayMappingSchema.optional(),
    unit_name_mapping: invoiceDisplayMappingSchema.optional(),
    action_time: z.coerce.date(),
  }).refine(
    (value) => value.item_unit_mapping || value.unit_name_mapping,
    "Product unit mapping is required",
  );
