"use client";

/**
 * useMenuBadges — Realtime badge counts for menu items
 *
 * LUẬT THÉP: Realtime via onSnapshot, no reload buttons.
 * Badge counts:
 * - tasks: pending approval records assigned to current user's roles
 * - importVouchers: vouchers in processing status
 * - exportVouchers: export vouchers in processing status
 * - transfers: transfers in processing status
 */

import { useEffect, useState, useMemo } from "react";
import {
    collection,
    query,
    where,
    onSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useUserStore } from "@/stores/useUserStore";

export interface MenuBadges {
    tasks: number;
    importVouchers: number;
    exportVouchers: number;
    transfers: number;
}

export function useMenuBadges(): MenuBadges {
    const [pendingRecords, setPendingRecords] = useState<
        Array<{ role_id?: string; creator_id?: string }>
    >([]);
    const [importVoucherCount, setImportVoucherCount] = useState(0);
    const [exportVoucherCount, setExportVoucherCount] = useState(0);
    const [transferCount, setTransferCount] = useState(0);

    const user = useUserStore((s) => s.user);
    const roleIds = useUserStore((s) => s.roleIds);
    const permissions = useUserStore((s) => s.permissions);

    // Calculate accessible warehouse IDs for vouchers
    const accessibleVoucherScopes = useMemo(() => {
        if (!permissions) return { isGlobal: false, ids: [] as string[] };
        const globalPerms = permissions["global"] || {};
        if (globalPerms["*"] === true || globalPerms["vouchers.read"] === true) {
            return { isGlobal: true, ids: [] as string[] };
        }
        const ids: string[] = [];
        for (const [scope, perms] of Object.entries(permissions)) {
            if (scope === "global") continue;
            if (perms["*"] === true || perms["vouchers.read"] === true) {
                ids.push(scope);
            }
        }
        return { isGlobal: false, ids };
    }, [permissions]);

    // Calculate accessible warehouse IDs for transfers
    const accessibleTransferScopes = useMemo(() => {
        if (!permissions) return { isGlobal: false, ids: [] as string[] };
        const globalPerms = permissions["global"] || {};
        if (globalPerms["*"] === true || globalPerms["transfers.read"] === true) {
            return { isGlobal: true, ids: [] as string[] };
        }
        const ids: string[] = [];
        for (const [scope, perms] of Object.entries(permissions)) {
            if (scope === "global") continue;
            if (
                perms["*"] === true ||
                perms["transfers.read"] === true ||
                perms["vouchers.read"] === true
            ) {
                ids.push(scope);
            }
        }
        return { isGlobal: false, ids };
    }, [permissions]);

    // ── Pending approvals count (realtime) ──
    useEffect(() => {
        if (!user?.id || roleIds.length === 0) return;

        const roleSlice = roleIds.slice(0, 30);

        const q = query(
            collection(db, "pending_approvals"),
            where("role_id", "in", roleSlice),
            where("status", "==", "PENDING"),
        );

        const unsub = onSnapshot(
            q,
            (snap) => {
                const records = snap.docs.map((doc) => ({
                    role_id: doc.data().role_id as string | undefined,
                    creator_id: doc.data().creator_id as string | undefined,
                }));
                setPendingRecords(records);
            },
            (err) => {
                console.error("[useMenuBadges] approvals error:", err);
            },
        );

        return () => unsub();
    }, [user?.id, roleIds]);

    const tasksCount = useMemo(() => {
        if (!user?.id) return 0;
        return pendingRecords.filter((r) => r.creator_id !== user.id).length;
    }, [pendingRecords, user?.id]);

    // ── Import vouchers in processing (realtime) ──
    useEffect(() => {
        if (!user?.id) return;

        const q = query(
            collection(db, "import_vouchers"),
            where("status", "in", ["PENDING_APPROVAL", "APPROVED", "RECEIVING"]),
            where("is_deleted", "==", false),
        );

        const unsub = onSnapshot(
            q,
            (snap) => {
                let count = 0;
                snap.forEach((doc) => {
                    const data = doc.data();
                    if (accessibleVoucherScopes.isGlobal) {
                        count++;
                    } else {
                        const isCreator = data.creator_id === user.id;
                        const inScope = accessibleVoucherScopes.ids.includes(data.warehouse_id);
                        if (isCreator || inScope) count++;
                    }
                });
                setImportVoucherCount(count);
            },
            (err) => console.error("[useMenuBadges] import vouchers error:", err),
        );

        return () => unsub();
    }, [user?.id, accessibleVoucherScopes]);

    // ── Export vouchers in processing (realtime) ──
    useEffect(() => {
        if (!user?.id) return;

        const q = query(
            collection(db, "export_vouchers"),
            where("status", "in", ["PENDING_APPROVAL", "APPROVED", "PICKING", "SHIPPED"]),
            where("is_deleted", "==", false),
        );

        const unsub = onSnapshot(
            q,
            (snap) => {
                let count = 0;
                snap.forEach((doc) => {
                    const data = doc.data();
                    if (accessibleVoucherScopes.isGlobal) {
                        count++;
                    } else {
                        const isCreator = data.creator_id === user.id;
                        const inScope = accessibleVoucherScopes.ids.includes(data.warehouse_id);
                        if (isCreator || inScope) count++;
                    }
                });
                setExportVoucherCount(count);
            },
            (err) => console.error("[useMenuBadges] export vouchers error:", err),
        );

        return () => unsub();
    }, [user?.id, accessibleVoucherScopes]);

    // ── Transfers in processing (realtime) ──
    useEffect(() => {
        if (!user?.id) return;

        const q = query(
            collection(db, "transfer_orders"),
            where("status", "in", ["PENDING_APPROVAL", "APPROVED", "EXPORT_PENDING", "EXPORT_CREATED", "PICKING", "IN_TRANSIT", "PENDING_RECEIVE", "RECEIVING"]),
            where("is_deleted", "==", false),
        );

        const unsub = onSnapshot(
            q,
            (snap) => {
                let count = 0;
                snap.forEach((doc) => {
                    const data = doc.data();
                    if (accessibleTransferScopes.isGlobal) {
                        count++;
                    } else {
                        const isCreator = data.creator_id === user.id;
                        const srcInScope = accessibleTransferScopes.ids.includes(data.source_warehouse_id);
                        const dstInScope = accessibleTransferScopes.ids.includes(data.destination_warehouse_id);
                        if (isCreator || srcInScope || dstInScope) count++;
                    }
                });
                setTransferCount(count);
            },
            (err) => console.error("[useMenuBadges] transfers error:", err),
        );

        return () => unsub();
    }, [user?.id, accessibleTransferScopes]);

    return {
        tasks: tasksCount,
        importVouchers: importVoucherCount,
        exportVouchers: exportVoucherCount,
        transfers: transferCount,
    };
}
