"use client";

import { doc, getDoc } from "firebase/firestore";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AuditLog } from "@bduck/shared-types";
import { db } from "@/lib/firebase";

/**
 * Map entity_type → Firestore collection name for resolving display names.
 * Must match the backend ENTITY_COLLECTION_MAP.
 */
const ENTITY_COLLECTION_MAP: Record<string, string> = {
    products: "products",
    product_categories: "product_categories",
    product_bom: "products",
    inventory: "inventory",
    warehouses: "warehouses",
    warehouse_locations: "warehouse_locations",
    organizations: "organizations",
    roles: "roles",
    users: "users",
    workflow_definitions: "workflow_definitions",
    workflow_versions: "workflow_definitions",
    workflow_instances: "workflow_instances",
    workflow_tasks: "workflow_tasks",
    IMPORT_VOUCHER: "import_vouchers",
    NONCONFORMITY_REPORT: "nonconformity_reports",
};

/** Fields to try (in order) when resolving an entity's display name */
const NAME_FIELDS = ["name", "code", "voucher_number", "title", "sku", "full_name", "username", "email"];

function extractName(data: Record<string, unknown>): string | null {
    for (const field of NAME_FIELDS) {
        const val = data[field];
        if (typeof val === "string" && val.trim()) return val.trim();
        if (typeof val === "number") return String(val);
    }
    return null;
}

type NameCache = Map<string, string>;

/**
 * Hook that resolves raw IDs (user_id, entity_id, warehouse_id) in audit logs
 * into human-readable names. Uses an in-memory cache so repeated lookups are instant.
 */
export function useAuditNameResolver(logs: AuditLog[]) {
    const [nameMap, setNameMap] = useState<NameCache>(new Map());
    const cacheRef = useRef<NameCache>(new Map());
    const pendingRef = useRef(new Set<string>());

    useEffect(() => {
        if (logs.length === 0) return;

        const cache = cacheRef.current;
        const preResolved = new Map<string, string>();
        const idsToResolve = new Map<string, { collection: string; id: string }>();

        for (const log of logs) {
            // ── Pre-cache backend-enriched names ──
            if (log.user_name && !cache.has(log.user_id)) {
                preResolved.set(log.user_id, log.user_name);
            }
            const entityKey = `${log.entity_type}::${log.entity_id}`;
            if (log.entity_name && !cache.has(entityKey)) {
                preResolved.set(entityKey, log.entity_name);
            }

            // ── Queue IDs that need Firestore lookup ──
            if (log.user_id && !cache.has(log.user_id) && !preResolved.has(log.user_id) && !pendingRef.current.has(log.user_id)) {
                idsToResolve.set(log.user_id, { collection: "users", id: log.user_id });
            }
            if (log.warehouse_id && !cache.has(log.warehouse_id) && !pendingRef.current.has(log.warehouse_id)) {
                idsToResolve.set(log.warehouse_id, { collection: "warehouses", id: log.warehouse_id });
            }
            if (!cache.has(entityKey) && !preResolved.has(entityKey) && !pendingRef.current.has(entityKey)) {
                const collectionName = ENTITY_COLLECTION_MAP[log.entity_type];
                if (collectionName) {
                    idsToResolve.set(entityKey, { collection: collectionName, id: log.entity_id });
                }
            }
        }

        // Flush pre-resolved names immediately
        if (preResolved.size > 0) {
            for (const [key, name] of preResolved) {
                cache.set(key, name);
            }
            setNameMap(new Map(cache));
        }

        if (idsToResolve.size === 0) return;

        // Mark as pending
        for (const key of idsToResolve.keys()) {
            pendingRef.current.add(key);
        }

        // Batch resolve from Firestore
        const entries = Array.from(idsToResolve.entries());
        const promises = entries.map(async ([key, { collection, id }]) => {
            try {
                const snap = await getDoc(doc(db, collection, id));
                if (snap.exists()) {
                    const name = extractName(snap.data() as Record<string, unknown>);
                    if (name) return { key, name };
                }
            } catch {
                // Silently ignore — display ID fallback
            }
            return null;
        });

        void Promise.all(promises).then((results) => {
            const resolved = results.filter(Boolean) as { key: string; name: string }[];
            if (resolved.length === 0) {
                for (const key of idsToResolve.keys()) pendingRef.current.delete(key);
                return;
            }

            for (const { key, name } of resolved) {
                cache.set(key, name);
            }
            setNameMap(new Map(cache));

            for (const key of idsToResolve.keys()) {
                pendingRef.current.delete(key);
            }
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [logs]);

    /** Resolve a user_id to a display name */
    const resolveUser = useCallback(
        (userId: string): string => nameMap.get(userId) || userId,
        [nameMap],
    );

    /** Resolve a warehouse_id to a display name */
    const resolveWarehouse = useCallback(
        (warehouseId: string): string => nameMap.get(warehouseId) || warehouseId,
        [nameMap],
    );

    /** Resolve an entity_type + entity_id to a display name */
    const resolveEntity = useCallback(
        (entityType: string, entityId: string): string =>
            nameMap.get(`${entityType}::${entityId}`) || entityId,
        [nameMap],
    );

    return { resolveUser, resolveWarehouse, resolveEntity, nameMap };
}
