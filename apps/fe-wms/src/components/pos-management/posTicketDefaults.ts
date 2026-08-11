import type { PosTicketSettingsPayload } from "@/api/posManagementApi";

export const createDefaultPosTicketSettings = (
  storeName: string,
): PosTicketSettingsPayload => ({
  paper_size: "POS80",
  ticket_height_mm: 112,
  store_name: storeName || "JOY POS",
  ticket_title: "VÉ VUI CHƠI",
  subtitle: "Vui lòng xuất trình vé trước khi tham gia",
  instructions:
    "Mỗi vé chỉ có giá trị cho một lượt sử dụng. Không nhận vé rách hoặc mã QR không đọc được.",
  footer_message: "Chúc Quý khách có những phút giây thật vui!",
  logo_data_url: null,
  logo_width_mm: 24,
  logo_max_height_mm: 16,
  logo_contrast_percent: 125,
  qr_size_mm: 34,
  title_font_size_pt: 15,
  product_font_size_pt: 13,
  body_font_size_pt: 8,
  font_weight: 700,
  show_logo: true,
  show_order_code: true,
  show_issued_at: true,
  show_price: false,
  show_sequence: true,
  auto_print_after_payment: true,
});
