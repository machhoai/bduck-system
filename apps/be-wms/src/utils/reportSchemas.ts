import { z } from "zod";

const safeIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[a-zA-Z0-9._:-]+$/);

const dateSchema = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/);

export const reportIdParamSchema = z.object({
  id: safeIdSchema,
});

export const reportVersionParamSchema = z.object({
  templateId: safeIdSchema,
  versionId: safeIdSchema,
});

export const reportFieldInstanceSchema = z.object({
  id: safeIdSchema,
  field_key: z.literal("inventory.stock_by_product"),
  label: z.string().trim().min(1).max(120),
  params: z.object({
    product_id: z.string().trim().max(120).optional(),
    product_code: z.string().trim().min(1).max(80),
    warehouse_scope: z.enum(["all_accessible", "specific_warehouse"]),
    warehouse_id: z.string().trim().max(120).nullable().optional(),
    quantity_bucket: z.enum([
      "total_quantity",
      "atp_quantity",
      "on_hold_quantity",
      "in_transit_quantity",
      "quarantine_quantity",
    ]),
    date_mode: z.enum(["today", "specific_date", "date_range", "month", "year"]),
    date: dateSchema.nullable().optional(),
    start_date: dateSchema.nullable().optional(),
    end_date: dateSchema.nullable().optional(),
    month: z.string().trim().regex(/^\d{4}-\d{2}$/).nullable().optional(),
    year: z.string().trim().regex(/^\d{4}$/).nullable().optional(),
    output_format: z.enum(["number", "with_unit", "detailed"]),
  }),
});

export const reportExcelMappingSchema = z.object({
  field_instances: z.array(reportFieldInstanceSchema).max(500),
  cell_mappings: z
    .array(
      z.object({
        id: safeIdSchema,
        sheet_name: z.string().trim().min(1).max(120),
        cell: z
          .string()
          .trim()
          .regex(/^[A-Z]{1,3}[1-9][0-9]{0,6}$/),
        field_instance_id: safeIdSchema,
        write_mode: z.literal("value"),
      }),
    )
    .max(2000),
});

export const createExcelReportTemplateSchema = z.object({
  name: z.string().trim().min(1).max(160),
  original_file_name: z.string().trim().min(1).max(180),
  file_base64: z.string().min(1),
  visibility: z.enum(["private", "shared"]).default("private"),
  mapping: reportExcelMappingSchema.default({
    field_instances: [],
    cell_mappings: [],
  }),
});

export const updateExcelReportTemplateSchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  visibility: z.enum(["private", "shared"]).optional(),
  mapping: reportExcelMappingSchema.optional(),
});

export const exportExcelReportSchema = z.object({
  mapping: reportExcelMappingSchema.optional(),
});
