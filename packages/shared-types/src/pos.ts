import type { ISOTimestamped, LocalizedText, SoftDeletable } from "./utility.js";

export const POS_DEVICE_STATUSES = ["ACTIVE", "REVOKED"] as const;
export type PosDeviceStatus = (typeof POS_DEVICE_STATUSES)[number];

export const POS_ENROLLMENT_STATUSES = ["PENDING", "USED", "EXPIRED", "REVOKED"] as const;
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
  payment_settings: PosPaymentSettings | null;
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

export interface PosStoreOverview {
  warehouse_id: string;
  active_devices: number;
  revoked_devices: number;
  offline_devices: number;
  receipt_settings_version: number | null;
  latest_heartbeat_at: Date | null;
}

export interface PosPaymentSettings {
  warehouseId: string;
  enabled: boolean;
  bankBin: string;
  accountNumber: string;
  accountName: string;
  version: number;
  updatedAt: string;
  updatedByUid: string;
}

export type PosPaymentSettingsInput = Pick<
  PosPaymentSettings,
  "enabled" | "bankBin" | "accountNumber" | "accountName"
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
