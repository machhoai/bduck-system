import { z } from "zod";

const businessDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}, "business_date must be a real calendar date");
const warehouseId = z.string().trim().min(1).max(200);
const sourceId = z.string().length(64).regex(/^[a-f0-9]+$/);

export const invoiceLedgerQuerySchema = z.object({
  warehouse_id: warehouseId,
  business_date: businessDate,
});

export const invoiceLedgerItemSchema = z.object({
  id: sourceId,
  warehouse_id: warehouseId,
});

export const invoiceDownloadSchema = invoiceLedgerItemSchema.extend({
  type: z.enum(["Pdf", "Xml"]),
});

export const reconciliationCaseParamsSchema = z.object({
  id: z.string().length(64).regex(/^[a-f0-9]+$/),
});

export const resolveReconciliationCaseSchema = z.object({
  warehouse_id: warehouseId,
  note: z.string().trim().min(3).max(1000),
});

export const statusSweepSchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(100),
});
