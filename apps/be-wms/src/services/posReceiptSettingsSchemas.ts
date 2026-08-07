import { z } from "zod";

const weight = z.number().int().min(400).max(900);
const fontWeights = z.object({
  storeName: weight, storeDetails: weight, receiptTitle: weight,
  orderInfo: weight, tableHeader: weight, itemName: weight,
  itemDetails: weight, itemTax: weight, summary: weight,
  taxTotal: weight, grandTotal: weight, invoiceQrTitle: weight,
  invoiceQrHint: weight, themeMessage: weight, footer: weight,
  decoration: weight,
});

export const posReceiptSettingsSchema = z.object({
  paper_size: z.enum(["POS58", "POS80", "POS82"]),
  theme: z.enum(["CLASSIC", "NATIONAL_DAY", "TET"]),
  theme_messages: z.record(z.string(), z.string().max(300)),
  theme_message_font_size_pt: z.number().min(6).max(24),
  store_name: z.string().trim().min(1).max(120),
  store_address: z.string().trim().max(300),
  hotline: z.string().trim().max(50),
  after_sales_text: z.string().trim().max(500),
  footer_message: z.string().trim().max(500),
  logo_data_url: z.string().max(1_500_000).nullable(),
  logo_width_mm: z.number().min(5).max(70),
  logo_max_height_mm: z.number().min(5).max(70),
  logo_contrast_percent: z.number().min(50).max(250),
  invoice_qr_size_mm: z.number().min(15).max(60),
  invoice_qr_title_font_size_pt: z.number().min(6).max(24),
  invoice_qr_hint_font_size_pt: z.number().min(6).max(24),
  font_weights: fontWeights,
  show_logo: z.boolean(), show_cashier: z.boolean(), show_contact: z.boolean(),
  show_item_tax: z.boolean(), show_invoice_request_qr: z.boolean(),
  show_theme_message: z.boolean(),
  default_tax_rate: z.number().min(0).max(100),
});

export type PosReceiptSettingsInput = z.infer<typeof posReceiptSettingsSchema>;
