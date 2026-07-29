import { z } from "zod";

import {
  employeeContractActionTimeSchema,
  employeeContractIdempotencyKeySchema,
  sanitizedEmployeeContractStringSchema,
} from "./employeeContractSchemas.js";

const pdfFileNameSchema = sanitizedEmployeeContractStringSchema(240)
  .refine(
    (value) => !/[\\/]/u.test(value),
    "File name must not contain a path.",
  )
  .refine((value) => /\.pdf$/iu.test(value), "File name must end with .pdf.");

export const employeeContractDocumentTargetParamsSchema = z.strictObject({
  id: z.string().uuid(),
  contractId: z.string().uuid(),
});

export const employeeContractUploadIntentParamsSchema = z.strictObject({
  id: z.string().uuid(),
  contractId: z.string().uuid(),
  intentId: z.string().regex(/^[a-f0-9]{64}$/u),
});

export const employeeContractDocumentParamsSchema = z.strictObject({
  id: z.string().uuid(),
  contractId: z.string().uuid(),
  documentId: z.string().uuid(),
});

export const employeeContractDocumentDownloadQuerySchema = z.strictObject({
  mode: z.enum(["view", "download"]).default("view"),
});

export const createEmployeeContractUploadIntentSchema = z.strictObject({
  original_file_name: pdfFileNameSchema,
  idempotency_key: employeeContractIdempotencyKeySchema,
  action_time: employeeContractActionTimeSchema,
});

export const finalizeEmployeeContractUploadSchema = z.strictObject({
  idempotency_key: employeeContractIdempotencyKeySchema,
  action_time: employeeContractActionTimeSchema,
});

export type CreateEmployeeContractUploadIntentRequest = z.infer<
  typeof createEmployeeContractUploadIntentSchema
>;
export type FinalizeEmployeeContractUploadRequest = z.infer<
  typeof finalizeEmployeeContractUploadSchema
>;
