"use client";

/**
 * useMenuBadges — Realtime badge counts for menu items
 *
 * LUẬT THÉP: Realtime via onSnapshot, no reload buttons.
 * Badge counts:
 * - tasks: pending approval records assigned to current user's roles
 * - importVouchers: vouchers in processing status
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
}

export function useMenuBadges(): MenuBadges {
    const [pendingRecords, setPendingRecords] = useState<
        Array<{ role_id?: string; creator_id?: string }>
    >([]);
    const [voucherCount, setVoucherCount] = useState(0);

    const user = useUserStore((s) => s.user);
    const roleIds = useUserStore((s) => s.roleIds);

    // ── Pending approvals count (realtime) ──
    // Queries flat pending_approvals collection (no collectionGroup needed)
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

    // Filter out self-created records (Self-Approval Block for badge)
    const tasksCount = useMemo(() => {
        if (!user?.id) return 0;
        return pendingRecords.filter((r) => r.creator_id !== user.id).length;
    }, [pendingRecords, user?.id]);

    // ── Import vouchers in processing (realtime) ──
    useEffect(() => {
        if (!user?.id) return;

        const vouchersRef = collection(db, "import_vouchers");
        const q = query(
            vouchersRef,
            where("status", "in", ["PENDING_APPROVAL", "APPROVED", "RECEIVING"]),
            where("is_deleted", "==", false),
        );

        const unsub = onSnapshot(
            q,
            (snap) => {
                setVoucherCount(snap.size);
            },
            (err) => {
                console.error("[useMenuBadges] vouchers error:", err);
            },
        );

        return () => unsub();
    }, [user?.id]);

    return {
        tasks: tasksCount,
        importVouchers: voucherCount,
    };
}
