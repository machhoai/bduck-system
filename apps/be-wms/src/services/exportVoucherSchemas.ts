import { ExportReferenceType, ExportType } from "@bduck/shared-types";
import { z } from "zod";

const exportVoucherItemSchema = z.object({
  product_id: z.string().uuid(),
  warehouse_location_id: z.string().uuid(),
  quantity: z.number().int().positive(),
  unit_price: z.number().min(0),
  notes: z.string().max(500).nullable().optional(),
});

export const createExportVoucherSchema = z.object({
  warehouse_id: z.string().uuid(),
  export_type: z.nativeEnum(ExportType),
  reference_id: z.string().uuid().nullable().optional(),
  reference_type: z.nativeEnum(ExportReferenceType).nullable().optional(),
  recipient_name: z.string().max(200).nullable().optional(),
  recipient_department: z.string().max(200).nullable().optional(),
  items: z.array(exportVoucherItemSchema).min(1),
  notes: z.string().max(1000).nullable().optional(),
  attachment_urls: z.array(z.string().url()).max(10).optional().default([]),
  action_time: z.string().datetime().optional(),
  otp: z.string().optional(),
});

export type CreateExportVoucherInput = z.infer<
  typeof createExportVoucherSchema
>;

export const updateExportVoucherSchema = createExportVoucherSchema;
export type UpdateExportVoucherInput = CreateExportVoucherInput;
