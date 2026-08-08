import type { PosReceiptSettingsPayload } from "@/api/posManagementApi";

export const createDefaultPosReceiptSettings = (
  storeName: string,
): PosReceiptSettingsPayload => ({
  paper_size: "POS80",
  theme: "CLASSIC",
  theme_messages: {
    CLASSIC: "",
    NATIONAL_DAY: "Chúc mừng ngày Quốc khánh 2/9",
    TET: "Chúc mừng năm mới – An khang thịnh vượng",
  },
  theme_message_font_size_pt: 10,
  store_name: storeName || "JOY POS",
  store_address: "",
  hotline: "",
  after_sales_text: "Hỗ trợ sau bán hàng: vui lòng giữ lại biên lai này.",
  footer_message: "Cảm ơn Quý khách và hẹn gặp lại!",
  logo_data_url: null,
  logo_width_mm: 24,
  logo_max_height_mm: 18,
  logo_contrast_percent: 125,
  invoice_qr_size_mm: 34,
  invoice_qr_title_font_size_pt: 9,
  invoice_qr_hint_font_size_pt: 8,
  font_weights: {
    storeName: 800, storeDetails: 400, receiptTitle: 800, orderInfo: 400,
    tableHeader: 800, itemName: 700, itemDetails: 400, itemTax: 400,
    summary: 400, taxTotal: 700, grandTotal: 900, invoiceQrTitle: 700,
    invoiceQrHint: 400, themeMessage: 700, footer: 700, decoration: 700,
  },
  show_logo: true,
  show_cashier: true,
  show_contact: true,
  show_item_tax: true,
  show_invoice_request_qr: true,
  show_theme_message: true,
  default_tax_rate: 10,
});
