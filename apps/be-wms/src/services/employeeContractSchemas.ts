import {
  EmployeeContractType,
  isValidContractLocalDate,
} from "@bduck/shared-types";
import { z } from "zod";

import { hasUnsafeEmployeeContractQueryOperator } from "./employeeContractPolicy.js";

export const sanitizedEmployeeContractStringSchema = (
  maximumLength: number,
) =>
  z
    .string()
    .trim()
    .min(1)
    .max(maximumLength)
    .refine(
      (value) =>
        !value.includes("\u0000") &&
        !hasUnsafeEmployeeContractQueryOperator(value),
      "String contains an unsupported query operator.",
    );

const localDateSchema = z
  .string()
  .refine(isValidContractLocalDate, "Date must use YYYY-MM-DD.");

export const employeeContractActionTimeSchema = z.coerce.date();
export const employeeContractIdempotencyKeySchema =
  sanitizedEmployeeContractStringSchema(160).min(8);
const contractNumberSchema = sanitizedEmployeeContractStringSchema(120);
const notesSchema = z
  .string()
  .trim()
  .max(2000)
  .refine(
    (value) =>
      !value.includes("\u0000") &&
      !hasUnsafeEmployeeContractQueryOperator(value),
    "Notes contain an unsupported query operator.",
  )
  .nullable()
  .optional();

const contractFields = {
  contract_number: contractNumberSchema,
  contract_type: z.nativeEnum(EmployeeContractType),
  start_date: localDateSchema,
  end_date: localDateSchema.nullable(),
  notes: notesSchema,
};

export const employeeContractProfileParamsSchema = z.strictObject({
  id: z.string().uuid(),
});

export const employeeContractParamsSchema = z.strictObject({
  id: z.string().uuid(),
  contractId: z.string().uuid(),
});

export const createEmployeeContractSchema = z.strictObject({
  ...contractFields,
  idempotency_key: employeeContractIdempotencyKeySchema,
  action_time: employeeContractActionTimeSchema,
});

export const updateEmployeeContractSchema = z
  .strictObject({
    contract_number: contractNumberSchema.optional(),
    contract_type: z.nativeEnum(EmployeeContractType).optional(),
    start_date: localDateSchema.optional(),
    end_date: localDateSchema.nullable().optional(),
    notes: notesSchema,
    expected_revision: z.number().int().positive(),
    idempotency_key: employeeContractIdempotencyKeySchema,
    action_time: employeeContractActionTimeSchema,
  })
  .refine(
    (value) =>
      value.contract_number !== undefined ||
      value.contract_type !== undefined ||
      value.start_date !== undefined ||
      value.end_date !== undefined ||
      value.notes !== undefined,
    "At least one contract field must be supplied.",
  );

export const renewEmployeeContractSchema = z.strictObject({
  ...contractFields,
  expected_revision: z.number().int().positive(),
  idempotency_key: employeeContractIdempotencyKeySchema,
  action_time: employeeContractActionTimeSchema,
});

const lifecycleFields = {
  reason: sanitizedEmployeeContractStringSchema(1000),
  expected_revision: z.number().int().positive(),
  idempotency_key: employeeContractIdempotencyKeySchema,
  action_time: employeeContractActionTimeSchema,
};

export const cancelEmployeeContractSchema = z.strictObject(lifecycleFields);

export const terminateEmployeeContractSchema = z.strictObject({
  ...lifecycleFields,
  termination_date: localDateSchema,
});

export type CreateEmployeeContractRequest = z.infer<
  typeof createEmployeeContractSchema
>;
export type UpdateEmployeeContractRequest = z.infer<
  typeof updateEmployeeContractSchema
>;
export type RenewEmployeeContractRequest = z.infer<
  typeof renewEmployeeContractSchema
>;
export type CancelEmployeeContractRequest = z.infer<
  typeof cancelEmployeeContractSchema
>;
export type TerminateEmployeeContractRequest = z.infer<
  typeof terminateEmployeeContractSchema
>;
