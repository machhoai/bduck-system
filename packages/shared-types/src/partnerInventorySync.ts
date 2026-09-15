export const PARTNER_INVENTORY_CONNECTION_ID = "joyworld-manager" as const;

export type PartnerInventoryRowStatus =
  | "READY"
  | "ALREADY_MATCHED"
  | "NO_PARTNER_MATCH"
  | "NO_JPULSE_INVENTORY"
  | "DUPLICATE_SKU"
  | "INVALID_ATP";

export type PartnerInventoryJobStatus =
  | "RUNNING"
  | "COMPLETED"
  | "PARTIAL"
  | "FAILED"
  | "UNKNOWN";

export type PartnerInventoryItemStatus =
  | "VERIFIED"
  | "ALREADY_MATCHED"
  | "STALE"
  | "FAILED"
  | "UNKNOWN"
  | "BLOCKED";

export interface PartnerWarehouseOption {
  stock_id: string;
  stock_name: string;
}

export interface PartnerGiftTypeOption {
  type_id: string;
  type_name: string;
}

export interface PartnerWarehouseMappingDto {
  id: string;
  connection_id: string;
  warehouse_id: string;
  partner_stock_id: string;
  partner_stock_name: string;
  version: number;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
  updated_by: string;
}

export interface PartnerCategoryMappingDto {
  id: string;
  connection_id: string;
  category_id: string;
  partner_type_id: string;
  partner_type_name: string;
  version: number;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
  updated_by: string;
}

export interface PartnerInventoryComparisonRow {
  row_id: string;
  product_id: string | null;
  category_id: string | null;
  sku: string;
  product_name: string;
  partner_gift_id: string | null;
  partner_stock_value_id: string | null;
  jpulse_atp: number | null;
  partner_amount: number | null;
  delta: number | null;
  partner_gift_price: number | null;
  partner_is_open_expire: boolean;
  status: PartnerInventoryRowStatus;
  eligible: boolean;
}

export interface PartnerInventoryComparisonSnapshot {
  id: string;
  connection_id: string;
  warehouse_id: string;
  partner_stock_id: string;
  partner_stock_name: string;
  mapping_version: number;
  source_revision: string;
  fetched_at: string;
  expires_at: string;
  rows: PartnerInventoryComparisonRow[];
}

export interface PartnerInventorySyncRequest {
  snapshot_id: string;
  product_ids: string[];
  request_id: string;
  action_time: string;
}

export interface PartnerInventorySyncItemResult {
  product_id: string;
  sku: string;
  target_atp: number;
  partner_before: number;
  partner_after: number | null;
  delta: number;
  status: PartnerInventoryItemStatus;
  message: string | null;
}

export interface PartnerInventorySyncJobDto {
  id: string;
  request_id: string;
  connection_id: string;
  warehouse_id: string;
  partner_stock_id: string;
  snapshot_id: string;
  status: PartnerInventoryJobStatus;
  requested_by: string;
  action_time: string;
  sync_time: string;
  completed_at: string | null;
  items: PartnerInventorySyncItemResult[];
}

export interface PartnerInventoryCapability {
  connection_id: string;
  connection_name: string;
  shop_id: string | null;
  read_enabled: boolean;
  write_enabled: boolean;
}
