import { z } from "zod";

const ticketLogoDataUrl = z
  .string()
  .max(1_500_000)
  .refine(
    (value) =>
      /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(value),
    "Logo phải là ảnh PNG, JPG hoặc WEBP hợp lệ.",
  )
  .nullable();

const safeText = (maximum: number, minimum = 0) =>
  z
    .string()
    .trim()
    .min(minimum)
    .max(maximum)
    .refine(
      (value) => !value.includes("$"),
      "Nội dung không được chứa toán tử truy vấn.",
    );

export const posTicketSettingsSchema = z.object({
  paper_size: z.enum(["POS58", "POS80", "POS82"]),
  ticket_height_mm: z.number().min(80).max(160),
  store_name: safeText(120, 1),
  ticket_title: safeText(80, 1),
  subtitle: safeText(200),
  instructions: safeText(500),
  footer_message: safeText(300),
  logo_data_url: ticketLogoDataUrl,
  logo_width_mm: z.number().min(5).max(70),
  logo_max_height_mm: z.number().min(5).max(70),
  logo_contrast_percent: z.number().min(50).max(250),
  qr_size_mm: z.number().min(20).max(55),
  title_font_size_pt: z.number().min(8).max(28),
  product_font_size_pt: z.number().min(8).max(24),
  body_font_size_pt: z.number().min(6).max(16),
  font_weight: z.number().int().min(400).max(900),
  show_logo: z.boolean(),
  show_order_code: z.boolean(),
  show_issued_at: z.boolean(),
  show_price: z.boolean(),
  show_sequence: z.boolean(),
  auto_print_after_payment: z.boolean(),
});

export type PosTicketSettingsInput = z.infer<typeof posTicketSettingsSchema>;
