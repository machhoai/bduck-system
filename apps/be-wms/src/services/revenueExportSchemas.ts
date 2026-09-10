import { REVENUE_EXPORT_REPORT_TYPES } from "@bduck/shared-types";
import { z } from "zod";

export const exportRevenueSchema = z
  .object({
    source: z.enum(["OPEN_API", "LOCAL_POS"]),
    reportType: z.enum(REVENUE_EXPORT_REPORT_TYPES),
    warehouseId: z.string().trim().min(1).max(128),
    locale: z.enum(["vi", "zh"]),
    actionTime: z.string().datetime({ offset: true }),
    mode: z.enum(["today", "date", "month", "year", "custom"]),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),
    month: z.string().regex(/^\d{4}-\d{2}$/u),
    year: z.string().regex(/^\d{4}$/u),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),
    products: z
      .array(
        z
          .object({
            key: z.string().min(1).max(2048),
            exportName: z.string().trim().min(1).max(200).optional(),
          })
          .strict(),
      )
      .min(1)
      .max(5000)
      .optional(),
    roundMoney: z.boolean().optional(),
  })
  .refine(
    (input) =>
      input.reportType !== "INVOICE_PREPARATION" ||
      input.source === "LOCAL_POS",
    {
      message: "Invoice preparation requires LOCAL_POS",
      path: ["source"],
    },
  )
  .refine(
    (input) =>
      input.reportType !== "DAILY_REVENUE" || input.products === undefined,
    {
      message: "Daily revenue does not accept product selection",
      path: ["products"],
    },
  )
  .refine(
    (input) =>
      input.reportType === "INVOICE_PREPARATION" ||
      input.roundMoney === undefined,
    {
      message: "Money rounding applies only to invoice preparation",
      path: ["roundMoney"],
    },
  );
