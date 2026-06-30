// Dữ liệu nền tảng cốt lõi

import {
  ActiveStatus,
  LocationStatus,
  LocationType,
  ProductOrigin,
  ProductType,
  WarehouseType,
} from "./enums.js";

// ─────────────────────────────────────────────
// MASTER DATA
// ─────────────────────────────────────────────

export interface Organization {
  id: string; // UUID, PK
  name: string;
  code: string; // UNIQUE
  tax_code: string | null;
  address: string | null;
  organization_image_url: string | null;
  is_deleted: boolean; // ISO — soft delete only
  created_at: Date;
  updated_at: Date;
}

export interface Warehouse {
  id: string; // UUID, PK
  organization_id: string; // FK → organizations
  name: string;
  code: string; // UNIQUE
  type: WarehouseType;
  address: string | null;
  manager_id: string | null; // FK → users
  status: ActiveStatus;
  warehouse_description: string | null;
  warehouse_image_url: string | null;
  is_deleted: boolean;
  created_at: Date;
  updated_at: Date;
  coordinate: {
    longitude: number;
    latitude: number;
  } | null;
}

export interface WarehouseLocation {
  id: string; // UUID, PK
  warehouse_id: string; // FK → warehouses
  name: string;
  code: string;
  warehouse_location_description: string | null;
  warehouse_location_image_url: string | null;
  type: LocationType;
  status: LocationStatus;
  is_deleted: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface WarehouseLocationSlot {
  id: string; // UUID, PK
  warehouse_id: string; // FK to warehouses (denormalized)
  warehouse_location_id: string; // FK to warehouse_locations
  name: string;
  code: string;
  sort_order: number;
  description: string | null;
  is_active: boolean;
  is_deleted: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface WarehouseLocationSlotProduct {
  id: string; // UUID, PK
  warehouse_id: string; // FK to warehouses (denormalized)
  warehouse_location_id: string; // FK to warehouse_locations
  warehouse_location_slot_id: string; // FK to warehouse_location_slots
  product_id: string; // FK to products
  display_order: number | null;
  is_active: boolean;
  is_deleted: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface ProductCategory {
  id: string; // UUID, PK
  parent_id: string | null; // FK → self (hierarchical)
  name: string;
  code: string; // UNIQUE
  type: ProductType;
  category_description: string | null;
  is_deleted: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Product {
  id: string; // UUID, PK
  category_id: string; // FK → product_categories
  name: string;
  code: string; // UNIQUE (SKU)
  barcode: string | null; // IDX
  product_image_url: string[] | null;
  product_material: string | null;
  product_origin: ProductOrigin | null;
  hs_code: string | null;
  technical_specifications: string | null;
  dimensions: string | null;
  manufacturer: string | null;
  manufacturer_address: string | null;
  notes: string | null;
  applicable_standard: string | null;
  unit: string; // PCS, BOX, KG, SET…
  product_type: ProductType;
  unit_price: number | null;
  is_serialized: boolean;
  description: string | null;
  is_deleted: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface ProductBOM {
  id: string; // UUID, PK
  parent_product_id: string; // FK → products (Máy móc)
  child_product_id: string; // FK → products (Phụ tùng)
  quantity: number;
  note: string | null;
  is_deleted: boolean;
  created_at: Date;
  updated_at: Date;
}
