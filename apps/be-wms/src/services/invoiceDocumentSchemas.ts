import { InvoiceDocumentStatus } from "@bduck/shared-types";
import { z } from "zod";

const warehouseIdSchema = z.string().trim().min(1).max(200);
const hashSchema = z
  .string()
  .length(64)
  .regex(/^[a-f0-9]+$/);
const vatRateNameSchema = z.enum(["0%", "5%", "8%", "10%", "KCT", "KKKNT"]);

export const invoiceDocumentParamsSchema = z.object({
  id: z
    .string()
    .trim()
    .length(64)
    .regex(/^[a-f0-9]+$/),
});

export const invoiceDocumentScopeSchema = z.object({
  warehouse_id: warehouseIdSchema,
});

export const invoiceDocumentPrepareSchema = z.object({
  warehouse_id: warehouseIdSchema,
  expected_source_payload_hash: hashSchema,
});

export const invoiceDocumentPreviewSchema = z.object({
  warehouse_id: warehouseIdSchema,
  expected_revision: z.number().int().min(1),
  expected_source_payload_hash: hashSchema,
});

const invoiceBuyerSchema = z
  .object({
    full_name: z.string().trim().min(1).max(255),
    legal_name: z.string().trim().max(255),
    tax_code: z.string().trim().max(30),
    address: z.string().trim().max(500),
    phone_number: z.string().trim().max(50),
    email: z.union([z.literal(""), z.string().trim().email().max(255)]),
  })
  .superRefine((buyer, ctx) => {
    if (buyer.tax_code && !/^\d{10}(?:-\d{3})?$/.test(buyer.tax_code)) {
      ctx.addIssue({
        code: "custom",
        path: ["tax_code"],
        message: "Vietnam tax code must have 10 digits or 10-3 digits.",
      });
    }
  });

const invoiceItemSchema = z.object({
  line_number: z.number().int().min(1).max(199),
  source_item_id: z.string().trim().max(200).nullable().default(null),
  item_code: z.string().trim().min(1).max(100),
  item_name: z.string().trim().min(1).max(500),
  category_code: z.string().trim().max(200).nullable().default(null),
  category_name: z.string().trim().max(255).nullable().default(null),
  unit_name: z.string().trim().min(1).max(100),
  quantity: z.number().positive(),
  unit_price: z.number().min(0),
  discount_rate: z.number().min(0).max(100).nullable().default(null),
  discount_amount: z.number().min(0).nullable().default(null),
  vat_rate_name: vatRateNameSchema,
  source_amount_without_vat: z.number().nullable().default(null),
  source_vat_amount: z.number().nullable().default(null),
  source_total_amount: z.number().nullable().default(null),
});

export const invoiceDocumentUpdateSchema = z
  .object({
    warehouse_id: warehouseIdSchema,
    expected_revision: z.number().int().min(1),
    expected_source_payload_hash: hashSchema,
    buyer: invoiceBuyerSchema,
    payment_method_name: z.string().trim().min(1).max(100),
    items: z.array(invoiceItemSchema).min(1).max(199),
  })
  .superRefine((value, ctx) => {
    const lines = new Set<number>();
    value.items.forEach((item, index) => {
      if (lines.has(item.line_number)) {
        ctx.addIssue({
          code: "custom",
          path: ["items", index, "line_number"],
          message: "Line number must be unique.",
        });
      }
      lines.add(item.line_number);
      if (item.discount_rate !== null && item.discount_amount !== null) {
        ctx.addIssue({
          code: "custom",
          path: ["items", index, "discount_amount"],
          message: "Use either discount rate or discount amount, not both.",
        });
      }
    });
  });

export type InvoiceDocumentUpdateInput = z.infer<
  typeof invoiceDocumentUpdateSchema
>;
export const editableInvoiceStatuses = new Set<InvoiceDocumentStatus>([
  InvoiceDocumentStatus.NEEDS_TAX_CONFIGURATION,
  InvoiceDocumentStatus.NEEDS_CORRECTION,
  InvoiceDocumentStatus.NEEDS_REVIEW,
  InvoiceDocumentStatus.NEEDS_SECOND_REVIEW,
  InvoiceDocumentStatus.READY_TO_ISSUE,
  InvoiceDocumentStatus.REJECTED,
]);
