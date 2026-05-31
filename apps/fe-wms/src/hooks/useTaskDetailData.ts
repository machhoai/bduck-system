"use client";

/**
 * useTaskDetailData — Hook to load & resolve approval task detail data
 *
 * REPLACES: Old version that loaded WorkflowInstance → then entity.
 *
 * NEW DESIGN:
 * - ApprovalRecord already contains entity_type + entity_id
 * - No intermediate workflow_instances lookup needed
 * - Direct: ApprovalRecord → ImportVoucher → Items + Product resolution
 *
 * LUẬT THÉP: Realtime via onSnapshot, no reload buttons
 */

import { useEffect, useState } from "react";
import {
    doc,
    collection,
    query as fsQuery,
    onSnapshot,
    getDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { ApprovalRecord, ENTITY_COLLECTIONS, ProcessEntityType } from "@bduck/shared-types";
import type { ImportVoucher } from "@bduck/shared-types";

/** Enriched item with product details resolved */
export interface EnrichedVoucherItem {
    id: string;
    product_id: string;
    product_name: string;
    product_code: string; // SKU
    barcode: string | null;
    unit: string;
    expected_quantity: number;
    actual_quantity: number;
    unit_price: number;
    condition: string;
    notes: string | null;
}

interface TaskDetailState {
    voucher: ImportVoucher | null;
    items: EnrichedVoucherItem[];
    creatorName: string;
    warehouseName: string;
    loadingVoucher: boolean;
    loadingItems: boolean;
}

/** Map entity_type to Firestore collection name */
const COLLECTION_MAP: Record<string, string> = {
    IMPORT_VOUCHER: "import_vouchers",
    EXPORT_VOUCHER: "export_vouchers",
    TRANSFER_ORDER: "transfer_orders",
    PURCHASE_ORDER: "purchase_orders",
    ADJUSTMENT_VOUCHER: "adjustment_vouchers",
    GIFT_SESSION: "gift_sessions",
};

export function useTaskDetailData(approval: ApprovalRecord): TaskDetailState {
    const [voucher, setVoucher] = useState<ImportVoucher | null>(null);
    const [items, setItems] = useState<EnrichedVoucherItem[]>([]);
    const [creatorName, setCreatorName] = useState("");
    const [warehouseName, setWarehouseName] = useState("");
    const [loadingVoucher, setLoadingVoucher] = useState(true);
    const [loadingItems, setLoadingItems] = useState(true);

    const collectionName = COLLECTION_MAP[approval.entity_type] || "import_vouchers";

    // ── Step 1: Load voucher + resolve creator/warehouse ──
    useEffect(() => {
        if (!approval.entity_id) {
            setLoadingVoucher(false);
            return;
        }

        const unsub = onSnapshot(
            doc(db, collectionName, approval.entity_id),
            async (snap) => {
                if (snap.exists()) {
                    const data = { id: snap.id, ...snap.data() } as ImportVoucher;
                    setVoucher(data);

                    // Resolve creator name
                    if (data.creator_id) {
                        try {
                            const userSnap = await getDoc(doc(db, "users", data.creator_id));
                            if (userSnap.exists()) {
                                const u = userSnap.data();
                                setCreatorName(u?.full_name || u?.email || data.creator_id);
                            }
                        } catch {
                            setCreatorName(data.creator_id);
                        }
                    }

                    // Resolve warehouse name
                    if (data.warehouse_id) {
                        try {
                            const whSnap = await getDoc(doc(db, "warehouses", data.warehouse_id));
                            if (whSnap.exists()) {
                                setWarehouseName(whSnap.data()?.name || data.warehouse_id);
                            }
                        } catch {
                            setWarehouseName(data.warehouse_id);
                        }
                    }
                }
                setLoadingVoucher(false);
            },
            (err) => {
                console.error("[useTaskDetailData] voucher error:", err);
                setLoadingVoucher(false);
            },
        );
        return () => unsub();
    }, [approval.entity_id, collectionName]);

    // ── Step 2: Load items + resolve product info ──
    useEffect(() => {
        if (!approval.entity_id) {
            setLoadingItems(false);
            return;
        }

        const itemsQuery = fsQuery(
            collection(db, collectionName, approval.entity_id, "items"),
        );

        const unsub = onSnapshot(itemsQuery, async (snap) => {
            const rawItems = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

            // Resolve product details for each item
            const enriched: EnrichedVoucherItem[] = await Promise.all(
                rawItems.map(async (item: Record<string, unknown>) => {
                    let productName = (item.product_id as string) || "";
                    let productCode = "";
                    let barcode: string | null = null;
                    let unit = "";

                    if (item.product_id) {
                        try {
                            const pSnap = await getDoc(doc(db, "products", item.product_id as string));
                            if (pSnap.exists()) {
                                const p = pSnap.data();
                                productName = p?.name || (item.product_id as string);
                                productCode = p?.code || "";
                                barcode = p?.barcode || null;
                                unit = p?.unit || "";
                            }
                        } catch {
                            // Fallback to ID
                        }
                    }

                    return {
                        id: item.id as string,
                        product_id: (item.product_id as string) || "",
                        product_name: productName,
                        product_code: productCode,
                        barcode,
                        unit,
                        // Export items use `quantity`, import items use `expected_quantity`
                        expected_quantity: (item.expected_quantity as number) || (item.quantity as number) || 0,
                        actual_quantity: (item.actual_quantity as number) || (item.picked_quantity as number) || 0,
                        unit_price: (item.unit_price as number) || 0,
                        condition: (item.condition as string) || "",
                        notes: (item.notes as string) || null,
                    };
                }),
            );

            setItems(enriched);
            setLoadingItems(false);
        });

        return () => unsub();
    }, [approval.entity_id, collectionName]);

    return {
        voucher,
        items,
        creatorName,
        warehouseName,
        loadingVoucher,
        loadingItems,
    };
}
