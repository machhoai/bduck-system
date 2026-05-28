"use client";

/**
 * useMenuBadges — Realtime badge counts for menu items
 *
 * LUẬT THÉP: Realtime via onSnapshot, no reload buttons.
 * Badge counts:
 * - tasks: pending workflow tasks assigned to current user/role
 * - importVouchers: vouchers in processing status
 */

import { useEffect, useState, useMemo } from "react";
import {
    collection,
    collectionGroup,
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
    const [rawTaskCount, setRawTaskCount] = useState(0);
    const [rawTasks, setRawTasks] = useState<Array<{ assigned_to?: string; assigned_role_id?: string }>>([]);
    const [voucherCount, setVoucherCount] = useState(0);

    const user = useUserStore((s) => s.user);
    const roleIds = useUserStore((s) => s.roleIds);

    // ── Pending tasks count (realtime) ──
    // Uses same collectionGroup pattern as useWorkflowTasks
    useEffect(() => {
        if (!user?.id) return;

        const q = query(
            collectionGroup(db, "tasks"),
            where("status", "in", ["PENDING", "IN_PROGRESS"]),
        );

        const unsub = onSnapshot(
            q,
            (snap) => {
                const tasks = snap.docs.map((doc) => ({
                    assigned_to: doc.data().assigned_to as string | undefined,
                    assigned_role_id: doc.data().assigned_role_id as string | undefined,
                }));
                setRawTasks(tasks);
            },
            (err) => {
                console.error("[useMenuBadges] tasks error:", err);
            },
        );

        return () => unsub();
    }, [user?.id]);

    // Filter client-side for user-specific count
    const tasksCount = useMemo(() => {
        if (!user?.id) return 0;
        return rawTasks.filter((t) => {
            if (t.assigned_to === user.id) return true;
            if (t.assigned_role_id && roleIds.includes(t.assigned_role_id)) return true;
            if (!t.assigned_to && !t.assigned_role_id) return true;
            return false;
        }).length;
    }, [rawTasks, user?.id, roleIds]);

    // ── Import vouchers in processing (realtime) ──
    useEffect(() => {
        if (!user?.id) return;

        const vouchersRef = collection(db, "import_vouchers");
        const q = query(
            vouchersRef,
            where("status", "in", ["PENDING_APPROVAL", "IN_PROGRESS"]),
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
