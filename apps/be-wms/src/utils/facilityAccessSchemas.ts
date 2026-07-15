import { z } from "zod";

const noNoSqlOperators = (value: string) =>
  !/\$(where|ne|gt|gte|lt|lte|regex|or|and)\b/i.test(value);

export const facilityAccessIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(128)
  .refine(noNoSqlOperators, {
    message: "Identifier contains forbidden query operators",
  });

const optionalDateSchema = z.coerce.date().nullable().optional();

export const officeScopeQuerySchema = z.object({
  office_id: facilityAccessIdSchema.optional(),
  include_deleted: z.coerce.boolean().default(false),
});

export const officeScopeMutationSchema = z
  .object({
    scope_mode: z.enum(["ALL", "SELECTED"]),
    target_facility_ids: z
      .array(facilityAccessIdSchema)
      .max(500)
      .default([])
      .transform((ids) => Array.from(new Set(ids))),
    valid_from: optionalDateSchema,
    valid_until: optionalDateSchema,
    action_time: z.coerce.date().optional(),
  })
  .superRefine((value, context) => {
    if (
      value.valid_from &&
      value.valid_until &&
      value.valid_until.getTime() < value.valid_from.getTime()
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["valid_until"],
        message: "valid_until must be on or after valid_from",
      });
    }

    if (value.scope_mode === "ALL" && value.target_facility_ids.length > 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["target_facility_ids"],
        message: "ALL scope must not contain selected target facilities",
      });
    }
  });

export const accessGrantQuerySchema = z.object({
  user_id: facilityAccessIdSchema.optional(),
  facility_id: facilityAccessIdSchema.optional(),
  action: z.string().trim().min(1).max(160).optional(),
  include_deleted: z.coerce.boolean().default(false),
});

export const facilityAccessMigrationOptionsSchema = z.object({
  apply: z.boolean().default(false),
  resume: z.boolean().default(false),
  batch_size: z.coerce.number().int().min(1).max(100).default(25),
  migration_id: facilityAccessIdSchema.default("facility-access-v1"),
  confirm_project: facilityAccessIdSchema.optional(),
  initiated_by: facilityAccessIdSchema.default(
    "system:facility-access-migration",
  ),
});

export type OfficeScopeMutationInput = z.infer<
  typeof officeScopeMutationSchema
>;
export type FacilityAccessMigrationOptions = z.infer<
  typeof facilityAccessMigrationOptionsSchema
>;
