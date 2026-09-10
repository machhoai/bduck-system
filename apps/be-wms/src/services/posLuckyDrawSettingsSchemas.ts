import { z } from "zod";

const safeText = (maximum: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(maximum)
    .refine(
      (value) => !value.includes("$"),
      "Nội dung không được chứa toán tử truy vấn.",
    );

const packageTicketCounts = z
  .record(z.string().trim().min(1).max(128), z.number().int().min(0).max(50))
  .refine(
    (value) => Object.keys(value).length <= 500,
    "Chỉ được cấu hình tối đa 500 gói thành viên.",
  )
  .transform((value) =>
    Object.fromEntries(
      Object.entries(value).filter(([, ticketCount]) => ticketCount > 0),
    ),
  );

export const posLuckyDrawSettingsSchema = z.object({
  enabled: z.boolean(),
  paperSize: z.enum(["POS58", "POS80", "POS82"]),
  programName: safeText(100),
  ticketTitle: safeText(80),
  message: safeText(240),
  footerMessage: safeText(160),
  packageTicketCounts,
});

export type PosLuckyDrawSettingsValue = z.infer<
  typeof posLuckyDrawSettingsSchema
>;
