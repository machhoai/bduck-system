"use client";

/**
 * useProductPermissions — RBAC selectors cho module Products
 *
 * Tập trung toàn bộ permission check của module Products tại 1 hook.
 * Dùng trong bất kỳ component nào cần check quyền về sản phẩm.
 */

import { useUserStore } from "@/stores/useUserStore";

export interface ProductPermissions {
    /** Xem danh sách & chi tiết sản phẩm */
    canRead: boolean;
    /** Tạo/sửa/xóa mềm sản phẩm */
    canWrite: boolean;
    /**
     * Xem đơn giá sản phẩm (products.price.view).
     * Ẩn trường unit_price nếu = false.
     */
    canViewPrice: boolean;
}

export function useProductPermissions(): ProductPermissions {
    const hasPermission = useUserStore((s) => s.hasPermission);

    return {
        canRead: hasPermission("products.read"),
        canWrite: hasPermission("products.write"),
        canViewPrice: hasPermission("products.price.view"),
    };
}
