import { z } from "zod";

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
  action_time: z.coerce.date(),
}));

