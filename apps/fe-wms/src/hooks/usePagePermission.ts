"use client";

/**
 * usePagePermission — Check if current user has access to a page
 *
 * Maps page routes to required permissions.
 * Returns true if user has permission, false if blocked.
 *
 * LUẬT THÉP: RBAC — Frontend must check Role before rendering.
 */

import { useUserStore } from "@/stores/useUserStore";
import { menuItems } from "@/config/menuConfig";

/**
 * Route → permission mapping (derived from menuConfig + additional pages)
 *
 * Any route not in this map = accessible to all authenticated users
 */
const ROUTE_PERMISSIONS: Record<string, { permission?: string; permissionsAny?: string[] }> = {};

// Auto-populate from menuConfig
menuItems.forEach((item) => {
    if (item.permission || item.permissionsAny) {
        ROUTE_PERMISSIONS[item.href] = {
            permission: item.permission,
            permissionsAny: item.permissionsAny,
        };
    }
});

// Additional sub-routes that inherit parent permissions
const ADDITIONAL_ROUTES: Record<string, string> = {
    "/roles": "roles.read",
    "/categories": "products.read",
};

Object.entries(ADDITIONAL_ROUTES).forEach(([route, perm]) => {
    if (!ROUTE_PERMISSIONS[route]) {
        ROUTE_PERMISSIONS[route] = { permission: perm };
    }
});

/**
 * Check if user has access to a given pathname
 */
export function usePagePermission(pathname: string): boolean {
    const hasPermission = useUserStore((s) => s.hasPermission);

    // Find matching route (longest prefix match)
    const matchingRoute = Object.keys(ROUTE_PERMISSIONS)
        .filter((route) => pathname === route || pathname.startsWith(route + "/"))
        .sort((a, b) => b.length - a.length)[0];

    // No matching route = public page (accessible to all authenticated users)
    if (!matchingRoute) return true;

    const config = ROUTE_PERMISSIONS[matchingRoute];

    // Check single permission
    if (config.permission && hasPermission(config.permission)) return true;

    // Check any of multiple permissions
    if (config.permissionsAny?.some((p) => hasPermission(p))) return true;

    // No permission match = blocked
    return !config.permission && !config.permissionsAny;
}
