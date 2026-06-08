

export enum ExternalScanQueueStatus {
  QUEUED = "QUEUED",
  SUBMITTED = "SUBMITTED",
  APPROVED = "APPROVED",
  EXPORTED = "EXPORTED",
  REJECTED = "REJECTED",
}

export interface IntegrationClient {
  id: string;
  client_name: string;
  api_key: string;
  api_secret_hash: string;
  scopes: string[];
  allowed_warehouse_ids: string[];
  ip_whitelist: string[];
  rate_limit_per_minute: number;
  is_active: boolean;
  created_by: string;
  created_at: Date;
  last_used_at: Date | null;
}

export interface ExternalScanQueue {
  id: string;
  client_id: string;
  warehouse_id: string;
  warehouse_location_id: string;
  product_id: string;
  barcode_scanned: string;
  quantity: number;
  unit_price: number;
  scan_time: Date;
  sync_time: Date;
  operator_name: string;
  operator_id_external: string | null;
  device_id: string | null;
  batch_id: string | null;
  status: ExternalScanQueueStatus;
  approved_by: string | null;
  approved_at: Date | null;
  export_voucher_id: string | null;
  rejection_reason: string | null;
  atp_held: boolean;
  notes: string | null;
  is_deleted: boolean;
  created_at: Date;
}
