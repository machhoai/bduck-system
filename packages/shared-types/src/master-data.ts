// Dữ liệu nền tảng cốt lõi

import { ActiveStatus, LocationStatus, LocationType, ProductOrigin, ProductType, WarehouseType } from "./enums.js";

// ─────────────────────────────────────────────
// MASTER DATA
// ─────────────────────────────────────────────

export interface Organization {
    id: string; // UUID, PK
    name: string;
    code: string; // UNIQUE
    tax_code: string | null;
    address: string | null;
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
    unit: string; // PCS, BOX, KG, SET…
    product_type: ProductType;
    min_stock_threshold: number | null;
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