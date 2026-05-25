// Tài khoản, phân quyền, RBAC

import { UserStatus } from "./enums.js";

// ─────────────────────────────────────────────
// USERS & RBAC (ISO 5.3 — Segregation of Duties)
// ─────────────────────────────────────────────

export interface User {
    id: string; // UUID, PK
    username: string; // UNIQUE
    email: string; // UNIQUE
    password_hash: string;
    full_name: string;
    employee_id: string; // UNIQUE
    status: UserStatus;
    is_deleted: boolean;
    created_at: Date;
    updated_at: Date;
}

export interface Role {
    id: string; // UUID, PK
    name: string; // UNIQUE, admin-defined
    description: string | null;
    color: string; // Hex color used across the UI
    parent_id: string | null; // FK → roles, nullable = root role
    permissions: Record<string, boolean>; // JSONB permission map
    board_position: {
        x: number;
        y: number;
    } | null; // Free-form org chart canvas position
    is_deleted: boolean; // ISO — soft delete only
    created_at: Date;
    updated_at: Date;
}

/**
 * User ↔ Warehouse ↔ Role mapping.
 * warehouse_id nullable = global scope.
 * A user can have multiple roles across different warehouses.
 */
export interface UserWarehouseRole {
    id: string; // UUID, PK
    user_id: string; // FK → users
    warehouse_id: string | null; // FK → warehouses (nullable = global)
    role_id: string; // FK → roles
    assigned_by: string; // FK → users
    valid_from: string; // DATE
    valid_until: string | null; // DATE, nullable
    is_active: boolean;
    created_at: Date;
}
