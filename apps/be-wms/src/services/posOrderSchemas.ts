import {
  POS_ORDER_PAYMENT_STATUSES,
  POS_ORDER_SYNC_STATUSES,
} from "@bduck/shared-types";
import { z } from "zod";

const safeText = (maximum: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(maximum)
    .refine(
      (value) => !value.includes("$"),
      "Query operators are not allowed.",
    );

const cancellationReason = z.string().trim().min(3).max(500);

export const posOrderParamsSchema = z.object({
  warehouseId: safeText(128),
  localOrderId: safeText(128).optional(),
});

export const posOrderListQuerySchema = z.object({
  orderCode: z.string().trim().max(128).optional(),
  phone: z.string().trim().max(32).optional(),
  paymentStatus: z.enum(POS_ORDER_PAYMENT_STATUSES).optional(),
  syncStatus: z.enum(POS_ORDER_SYNC_STATUSES).optional(),
  operatorId: z.string().trim().max(128).optional(),
  product: z.string().trim().max(200).optional(),
  sortBy: z.enum(["totalAmount", "createdAt"]).default("createdAt"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  cursor: z.string().trim().max(1_000).optional(),
});

export const posOrderCancelSchema = z
  .object({
    reason: cancellationReason,
    action_time: z.string().datetime({ offset: true }),
    expectedVersion: z.number().int().nonnegative(),
    refundConfirmed: z.boolean(),
  })
  .strict();

export type PosOrderListQuery = z.infer<typeof posOrderListQuerySchema>;
export type PosOrderCancelValue = z.infer<typeof posOrderCancelSchema>;
