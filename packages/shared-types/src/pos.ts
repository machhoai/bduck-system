import type {
  ISOTimestamped,
  LocalizedText,
  SoftDeletable,
} from "./utility.js";

export const POS_DEVICE_STATUSES = ["ACTIVE", "REVOKED"] as const;
export type PosDeviceStatus = (typeof POS_DEVICE_STATUSES)[number];

export const POS_ENROLLMENT_STATUSES = [
  "PENDING",
  "USED",
  "EXPIRED",
  "REVOKED",
] as const;
export type PosEnrollmentStatus = (typeof POS_ENROLLMENT_STATUSES)[number];

export interface PosDevice extends SoftDeletable {
  id: string;
  warehouse_id: string;
  name: string;
  fingerprint_hash: string;
  credential_hash: string;
  status: PosDeviceStatus;
  app_version: string;
  operating_system: string;
  enrolled_by: string;
  enrolled_at: Date;
  last_seen_at: Date | null;
  revoked_by: string | null;
  revoked_at: Date | null;
}

export interface PosDeviceEnrollment extends SoftDeletable {
  id: string;
  warehouse_id: string;
  code_hash: string;
  status: PosEnrollmentStatus;
  expires_at: Date;
  created_by: string;
  used_by_device_id: string | null;
  used_at: Date | null;
  revoked_by: string | null;
  revoked_at: Date | null;
}

export interface PosDeviceEnrollmentGrant {
  enrollment_id: string;
  pairing_code: string;
  expires_at: Date;
  warehouse_id: string;
}

export interface PosDeviceActivationResult {
  device: Omit<PosDevice, "credential_hash">;
  device_credential: string;
}

export interface PosDeviceSessionResult {
  device: Omit<PosDevice, "credential_hash">;
  receipt_settings: PosReceiptSettings | null;
  ticket_settings: PosTicketSettings | null;
  payment_settings: PosPaymentSettings | null;
  customer_display_settings?: PosCustomerDisplaySettingsView | null;
  server_time: Date;
}

export interface PosReceiptSettingsWatchResult {
  changed: boolean;
  receipt_settings: PosReceiptSettings | null;
  server_time: Date;
}

export interface PosTicketSettingsWatchResult {
  changed: boolean;
  ticket_settings: PosTicketSettings | null;
  server_time: Date;
}

export type PosCustomerDisplayMediaType = "IMAGE" | "VIDEO";

export interface PosCustomerDisplayPlaylistItem {
  media_id: string;
  sort_order: number;
  enabled: boolean;
  image_duration_seconds: number | null;
}

export interface PosCustomerDisplaySettings extends SoftDeletable {
  id: string;
  warehouse_id: string;
  version: number;
  playlist: PosCustomerDisplayPlaylistItem[];
  updated_by: string;
}

export interface PosCustomerDisplayMedia extends SoftDeletable {
  id: string;
  warehouse_id: string;
  type: PosCustomerDisplayMediaType;
  storage_path: string;
  file_name: string;
  mime_type: "image/jpeg" | "image/png" | "image/webp" | "video/mp4";
  file_size_bytes: number;
  checksum_sha256: string;
  width: number | null;
  height: number | null;
  duration_seconds: number | null;
  created_by: string;
  updated_by: string;
}

export interface PosCustomerDisplayMediaView extends PosCustomerDisplayMedia {
  download_url: string;
}

export interface PosCustomerDisplaySettingsView {
  settings: PosCustomerDisplaySettings | null;
  media: PosCustomerDisplayMediaView[];
}

export interface PosCustomerDisplaySettingsInput {
  expected_version: number;
  playlist: PosCustomerDisplayPlaylistItem[];
  action_time: string;
}

export interface PosCustomerDisplaySettingsWatchResult {
  changed: boolean;
  customer_display_settings: PosCustomerDisplaySettingsView | null;
  server_time: Date;
}

export interface PosReceiptFontWeights {
  storeName: number;
  storeDetails: number;
  receiptTitle: number;
  orderInfo: number;
  tableHeader: number;
  itemName: number;
  itemDetails: number;
  itemTax: number;
  summary: number;
  taxTotal: number;
  grandTotal: number;
  invoiceQrTitle: number;
  invoiceQrHint: number;
  themeMessage: number;
  footer: number;
  decoration: number;
}

export interface PosReceiptSettings extends SoftDeletable {
  id: string;
  warehouse_id: string;
  version: number;
  paper_size: "POS58" | "POS80" | "POS82";
  theme: "CLASSIC" | "NATIONAL_DAY" | "TET";
  theme_messages: Record<string, string>;
  theme_message_font_size_pt: number;
  store_name: string;
  store_address: string;
  hotline: string;
  after_sales_text: string;
  footer_message: string;
  logo_data_url: string | null;
  logo_width_mm: number;
  logo_max_height_mm: number;
  logo_contrast_percent: number;
  invoice_qr_size_mm: number;
  invoice_qr_title_font_size_pt: number;
  invoice_qr_hint_font_size_pt: number;
  font_weights: PosReceiptFontWeights;
  show_logo: boolean;
  show_cashier: boolean;
  show_contact: boolean;
  show_item_tax: boolean;
  show_invoice_request_qr: boolean;
  show_theme_message: boolean;
  default_tax_rate: number;
  updated_by: string;
}

export interface PosTicketSettings extends SoftDeletable {
  id: string;
  warehouse_id: string;
  version: number;
  paper_size: "POS58" | "POS80" | "POS82";
  ticket_height_mm: number;
  store_name: string;
  ticket_title: string;
  subtitle: string;
  instructions: string;
  footer_message: string;
  logo_data_url: string | null;
  logo_width_mm: number;
  logo_max_height_mm: number;
  logo_contrast_percent: number;
  qr_size_mm: number;
  title_font_size_pt: number;
  product_font_size_pt: number;
  body_font_size_pt: number;
  font_weight: number;
  show_logo: boolean;
  show_order_code: boolean;
  show_issued_at: boolean;
  show_price: boolean;
  show_sequence: boolean;
  auto_print_after_payment: boolean;
  updated_by: string;
}

export type PosLuckyDrawPaperSize = "POS58" | "POS80" | "POS82";

/** Shared contract persisted in pos_lucky_draw_settings for JPULSE and JPOS. */
export interface PosLuckyDrawSettings {
  warehouseId: string;
  enabled: boolean;
  paperSize: PosLuckyDrawPaperSize;
  programName: string;
  ticketTitle: string;
  message: string;
  footerMessage: string;
  packageTicketCounts: Record<string, number>;
  version: number;
  updatedAt: string;
  updatedByUid: string;
}

export type PosLuckyDrawSettingsInput = Pick<
  PosLuckyDrawSettings,
  | "enabled"
  | "paperSize"
  | "programName"
  | "ticketTitle"
  | "message"
  | "footerMessage"
  | "packageTicketCounts"
>;

export interface PosLuckyDrawPackageOption {
  goodsId: string;
  goodsName: string;
  category: number;
  typeName: string;
  price: number;
  afterTaxPrice: number;
}

export interface PosLuckyDrawSettingsView {
  settings: PosLuckyDrawSettings | null;
  packages: PosLuckyDrawPackageOption[];
}

export interface PosStoreOverview {
  warehouse_id: string;
  active_devices: number;
  revoked_devices: number;
  offline_devices: number;
  receipt_settings_version: number | null;
  latest_heartbeat_at: Date | null;
}

export interface PosPaymentSettings {
  deviceId: string;
  warehouseId: string;
  enabled: boolean;
  fixedTransferOnly: boolean;
  bankBin: string;
  accountNumber: string;
  accountName: string;
  version: number;
  updatedAt: string;
  updatedByUid: string;
}

export const POS_MEMBER_COMPENSATION_STATUSES = [
  "PROCESSING",
  "SUCCEEDED",
  "FAILED",
  "UNKNOWN",
] as const;
export type PosMemberCompensationStatus =
  (typeof POS_MEMBER_COMPENSATION_STATUSES)[number];

/** Backend-only record for an idempotent manual member balance correction. */
export interface PosMemberCompensation extends SoftDeletable {
  id: string;
  warehouse_id: string;
  shop_id: number;
  member_uid: string;
  member_code: string | null;
  member_name: string;
  stored_category: 1;
  amount: number;
  reason: string;
  accounting_category: 1004;
  status: PosMemberCompensationStatus;
  created_by: string;
  created_by_name: string;
  device_id: string;
  action_time: Date;
  sync_time: Date;
  attempt_count: number;
  remote_total_value: number | null;
  remote_code: number | null;
  remote_message: string | null;
  completed_at: Date | null;
}

export type PosPaymentSettingsInput = Pick<
  PosPaymentSettings,
  "enabled" | "fixedTransferOnly" | "bankBin" | "accountNumber" | "accountName"
>;

export interface PosFailureEvent extends ISOTimestamped {
  id: string;
  warehouse_id: string;
  device_id: string;
  user_id: string | null;
  kind: string;
  message: string;
  app_version: string;
  metadata: Record<string, string | number | boolean | null>;
  resolution: LocalizedText | null;
}
