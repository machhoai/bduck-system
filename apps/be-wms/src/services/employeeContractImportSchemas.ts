import {
  EMPLOYEE_CONTRACT_IMPORT_MAX_ROWS,
} from "@bduck/shared-types";
import { z } from "zod";

import {
  employeeContractActionTimeSchema,
  employeeContractIdempotencyKeySchema,
  sanitizedEmployeeContractStringSchema,
} from "./employeeContractSchemas.js";

const fileNameSchema = sanitizedEmployeeContractStringSchema(240).refine(
  (value) => !/[\\/]/u.test(value),
  "File name must not contain a path.",
);
const checksumSchema = z.string().regex(/^[a-f0-9]{64}$/u);
const storagePathSchema = z
  .string()
  .trim()
  .min(1)
  .max(600)
  .refine(
    (value) =>
      !value.includes("..") &&
      !value.startsWith("/") &&
      !value.includes("\u0000"),
    "Storage path is invalid.",
  );

export const createEmployeeContractImportUploadSessionSchema =
  z.strictObject({
    files: z
      .array(
        z.strictObject({
          original_file_name: fileNameSchema,
          kind: z.enum(["EXCEL", "PDF"]),
        }),
      )
      .min(1)
      .max(EMPLOYEE_CONTRACT_IMPORT_MAX_ROWS + 1)
      .superRefine((files, context) => {
        if (files.filter((file) => file.kind === "EXCEL").length !== 1) {
          context.addIssue({
            code: "custom",
            message: "Exactly one Excel file is required.",
          });
        }
        const normalized = files.map((file) =>
          file.original_file_name.normalize("NFKC").toLocaleLowerCase(),
        );
        if (new Set(normalized).size !== normalized.length) {
          context.addIssue({
            code: "custom",
            message: "File names must be unique.",
          });
        }
        files.forEach((file, index) => {
          const validExtension =
            file.kind === "EXCEL"
              ? /\.xlsx$/iu.test(file.original_file_name)
              : /\.pdf$/iu.test(file.original_file_name);
          if (!validExtension) {
            context.addIssue({
              code: "custom",
              path: [index, "original_file_name"],
              message: `Invalid ${file.kind} extension.`,
            });
          }
        });
      }),
    idempotency_key: employeeContractIdempotencyKeySchema,
    action_time: employeeContractActionTimeSchema,
  });

export const previewEmployeeContractImportSchema = z.strictObject({
  upload_session_id: checksumSchema,
  source_file_name: fileNameSchema.refine((value) => /\.xlsx$/iu.test(value)),
  source_file_path: storagePathSchema,
  source_file_checksum: checksumSchema,
  pdf_files: z
    .array(
      z.strictObject({
        original_file_name: fileNameSchema.refine((value) =>
          /\.pdf$/iu.test(value),
        ),
        storage_path: storagePathSchema,
        sha256: checksumSchema,
      }),
    )
    .max(EMPLOYEE_CONTRACT_IMPORT_MAX_ROWS),
  action_time: employeeContractActionTimeSchema,
});

export const employeeContractImportBatchParamsSchema = z.strictObject({
  batchId: z.string().uuid(),
});

export const commitEmployeeContractImportSchema = z.strictObject({
  expected_batch_checksum: checksumSchema,
  idempotency_key: employeeContractIdempotencyKeySchema,
  action_time: employeeContractActionTimeSchema,
});

export type CreateEmployeeContractImportUploadSessionRequest = z.infer<
  typeof createEmployeeContractImportUploadSessionSchema
>;
export type PreviewEmployeeContractImportRequest = z.infer<
  typeof previewEmployeeContractImportSchema
>;
export type CommitEmployeeContractImportRequest = z.infer<
  typeof commitEmployeeContractImportSchema
>;
