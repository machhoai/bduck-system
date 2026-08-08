import { POS_DEVICE_STATUSES } from "@bduck/shared-types";
import { z } from "zod";

const safeText = (minimum: number, maximum: number) =>
  z
    .string()
    .trim()
    .min(minimum)
    .max(maximum)
    .refine((value) => !value.includes("$"), "Invalid query operator");

export const posWarehouseParamsSchema = z.object({
  warehouseId: z.string().uuid(),
});

export const posDeviceParamsSchema = z.object({
  deviceId: z.string().uuid(),
});

export const createPosEnrollmentSchema = z.object({
  otp: z.string().regex(/^\d{6}$/),
});

export const activatePosDeviceSchema = z.object({
  pairing_code: z.string().regex(/^\d{8}$/),
  device_id: z.string().uuid(),
  device_credential: z.string().min(32).max(200),
  device_name: safeText(2, 80),
  fingerprint: z
    .string()
    .trim()
    .min(16)
    .max(256)
    .regex(/^[A-Za-z0-9:_-]+$/),
  app_version: safeText(1, 30),
  operating_system: safeText(2, 100),
});

export const openPosDeviceSessionSchema = z.object({
  device_id: z.string().uuid(),
  device_credential: z.string().min(32).max(200),
  app_version: safeText(1, 30),
});

export const changePosDeviceStatusSchema = z.object({
  status: z.enum(POS_DEVICE_STATUSES),
});

export const transferPosDeviceSchema = z.object({
  warehouse_id: z.string().uuid(),
});
