"use client";

/**
 * useTaskDetailData — Hook to load & resolve task detail data
 *
 * Resolves:
 * - WorkflowInstance from task.instance_id
 * - ImportVoucher from instance.entity_id (realtime)
 * - Voucher items with product info (name, SKU, barcode)
 * - Creator name from users collection
 * - Warehouse name from warehouses collection
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
import type { WorkflowTask, WorkflowInstance } from "@bduck/shared-types";
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
    instance: WorkflowInstance | null;
    voucher: ImportVoucher | null;
    items: EnrichedVoucherItem[];
    creatorName: string;
    warehouseName: string;
    loadingInstance: boolean;
    loadingVoucher: boolean;
    loadingItems: boolean;
}

export function useTaskDetailData(task: WorkflowTask): TaskDetailState {
    const [instance, setInstance] = useState<WorkflowInstance | null>(null);
    const [voucher, setVoucher] = useState<ImportVoucher | null>(null);
    const [items, setItems] = useState<EnrichedVoucherItem[]>([]);
    const [creatorName, setCreatorName] = useState("");
    const [warehouseName, setWarehouseName] = useState("");
    const [loadingInstance, setLoadingInstance] = useState(true);
    const [loadingVoucher, setLoadingVoucher] = useState(true);
    const [loadingItems, setLoadingItems] = useState(true);

    // ── Step 1: Load workflow instance ──
    useEffect(() => {
        const unsub = onSnapshot(
            doc(db, "workflow_instances", task.instance_id),
            (snap) => {
                if (snap.exists()) {
                    setInstance({ id: snap.id, ...snap.data() } as WorkflowInstance);
                }
                setLoadingInstance(false);
            },
            (err) => {
                console.error("[useTaskDetailData] instance error:", err);
                setLoadingInstance(false);
            },
        );
        return () => unsub();
    }, [task.instance_id]);

    // ── Step 2: Load voucher + resolve creator/warehouse ──
    useEffect(() => {
        if (!instance?.entity_id) {
            setLoadingVoucher(false);
            return;
        }

        const collectionName = "import_vouchers";
        const unsub = onSnapshot(
            doc(db, collectionName, instance.entity_id),
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
    }, [instance?.entity_id, instance?.entity_type]);

    // ── Step 3: Load items + resolve product info ──
    useEffect(() => {
        if (!instance?.entity_id) {
            setLoadingItems(false);
            return;
        }

        const itemsQuery = fsQuery(
            collection(db, "import_vouchers", instance.entity_id, "items"),
        );

        const unsub = onSnapshot(itemsQuery, async (snap) => {
            const rawItems = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

            // Resolve product details for each item
            const enriched: EnrichedVoucherItem[] = await Promise.all(
                rawItems.map(async (item: any) => {
                    let productName = item.product_id || "";
                    let productCode = "";
                    let barcode: string | null = null;
                    let unit = "";

                    if (item.product_id) {
                        try {
                            const pSnap = await getDoc(doc(db, "products", item.product_id));
                            if (pSnap.exists()) {
                                const p = pSnap.data();
                                productName = p?.name || item.product_id;
                                productCode = p?.code || "";
                                barcode = p?.barcode || null;
                                unit = p?.unit || "";
                            }
                        } catch {
                            // Fallback to ID
                        }
                    }

                    return {
                        id: item.id,
                        product_id: item.product_id || "",
                        product_name: productName,
                        product_code: productCode,
                        barcode,
                        unit,
                        expected_quantity: item.expected_quantity || 0,
                        actual_quantity: item.actual_quantity || 0,
                        unit_price: item.unit_price || 0,
                        condition: item.condition || "",
                        notes: item.notes || null,
                    };
                }),
            );

            setItems(enriched);
            setLoadingItems(false);
        });

        return () => unsub();
    }, [instance?.entity_id]);

    return {
        instance,
        voucher,
        items,
        creatorName,
        warehouseName,
        loadingInstance,
        loadingVoucher,
        loadingItems,
    };
}
