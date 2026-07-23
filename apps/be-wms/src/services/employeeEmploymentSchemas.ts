import { EmployeeEmploymentStatus } from "@bduck/shared-types";
import { z } from "zod";

const actionableEmploymentStatusSchema = z
  .nativeEnum(EmployeeEmploymentStatus)
  .refine((value) => value !== EmployeeEmploymentStatus.UNSPECIFIED, {
    message: "UNSPECIFIED is reserved for legacy migration records",
  });

export const createEmployeeEmploymentTransitionSchema = z.object({
  to_status: actionableEmploymentStatusSchema,
  effective_date: z.string().date(),
  probation_end_date: z.string().date().nullable().optional(),
  reason: z.string().trim().min(1).max(1000),
});

export const cancelEmployeeEmploymentTransitionSchema = z.object({
  reason: z.string().trim().min(1).max(1000),
});
