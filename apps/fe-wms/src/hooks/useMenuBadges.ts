"use client";

/**
 * useMenuBadges — Realtime badge counts for menu items
 *
 * LUẬT THÉP: Realtime via onSnapshot, no reload buttons.
 * Badge counts:
 * - tasks: approvals + warehouse sessions + voucher completions + nonconformities
 * - vouchers: import/export/transfer vouchers in processing status
 */

import { useEffect, useState, useMemo } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useUserStore } from "@/stores/useUserStore";

type PermissionScope = { isGlobal: boolean; ids: string[] };
type PermissionMap = Record<string, Record<string, unknown>>;

export interface MenuBadges {
    tasks: number;
    vouchers: number;
    importVouchers: number;
    exportVouchers: number;
    transfers: number;
    nonconformities: number;
}

function getScopedPermissionIds(
    permissions: PermissionMap | null | undefined,
    permissionKeys: string[],
): PermissionScope {
    if (!permissions) return { isGlobal: false, ids: [] };
    const globalPerms = permissions.global || {};
    if (globalPerms["*"] === true || permissionKeys.some((key) => globalPerms[key] === true)) {
        return { isGlobal: true, ids: [] };
    }
    const ids = Object.entries(permissions)
        .filter(([scope, perms]) => (
            scope !== "global" &&
            (perms["*"] === true || permissionKeys.some((key) => perms[key] === true))
        ))
        .map(([scope]) => scope);
    return { isGlobal: false, ids };
}

function canSeeWarehouseScoped(
    scope: PermissionScope,
    userId: string,
    creatorId?: string,
    warehouseId?: string,
) {
    return (
        scope.isGlobal ||
        creatorId === userId ||
        (!!warehouseId && scope.ids.includes(warehouseId))
    );
}

function canSeeTransferScoped(
    scope: PermissionScope,
    userId: string,
    data: { creator_id?: string; source_warehouse_id?: string; destination_warehouse_id?: string },
) {
    return (
        scope.isGlobal ||
        data.creator_id === userId ||
        (!!data.source_warehouse_id && scope.ids.includes(data.source_warehouse_id)) ||
        (!!data.destination_warehouse_id && scope.ids.includes(data.destination_warehouse_id))
    );
}

export function useMenuBadges(): MenuBadges {
    const [pendingRecords, setPendingRecords] = useState<
        Array<{
            role_id?: string;
            creator_id?: string;
            warehouse_id?: string;
            approval_warehouse_id?: string | null;
            approval_scope?: string;
            allow_global_fallback?: boolean;
        }>
    >([]);
    const [importVoucherCount, setImportVoucherCount] = useState(0);
    const [exportVoucherCount, setExportVoucherCount] = useState(0);
    const [transferCount, setTransferCount] = useState(0);
    const [importTaskCount, setImportTaskCount] = useState(0);
    const [exportTaskCount, setExportTaskCount] = useState(0);
    const [transferTaskCount, setTransferTaskCount] = useState(0);
    const [nonconformityCount, setNonconformityCount] = useState(0);

    const user = useUserStore((s) => s.user);
    const roleIds = useUserStore((s) => s.roleIds);
    const hasScopedRole = useUserStore((s) => s.hasScopedRole);
    const permissions = useUserStore((s) => s.permissions);

    const accessibleVoucherScopes = useMemo(
        () => getScopedPermissionIds(permissions, ["vouchers.read"]),
        [permissions],
    );
    const accessibleInventoryScopes = useMemo(
        () => getScopedPermissionIds(permissions, ["inventory.write"]),
        [permissions],
    );
    const accessibleTransferScopes = useMemo(
        () => getScopedPermissionIds(permissions, ["transfers.read", "vouchers.read"]),
        [permissions],
    );

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
                    warehouse_id: doc.data().warehouse_id as string | undefined,
                    approval_warehouse_id: doc.data().approval_warehouse_id as
                        | string
                        | null
                        | undefined,
                    approval_scope: doc.data().approval_scope as string | undefined,
                    allow_global_fallback: doc.data().allow_global_fallback as
                        | boolean
                        | undefined,
                }));
                setPendingRecords(
                    records.filter((record) =>
                        hasScopedRole(
                            record.role_id,
                            record.approval_warehouse_id === undefined
                                ? record.warehouse_id
                                : record.approval_warehouse_id,
                            {
                                allowGlobalFallback:
                                    record.allow_global_fallback === true,
                                requireGlobal: record.approval_scope === "GLOBAL",
                            },
                        ),
                    ),
                );
            },
            (err) => {
                console.error("[useMenuBadges] approvals error:", err);
            },
        );

        return () => unsub();
    }, [hasScopedRole, user?.id, roleIds]);

    const tasksCount = useMemo(() => {
        return pendingRecords.length;
    }, [pendingRecords]);

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
                let taskCount = 0;
                snap.forEach((doc) => {
                    const data = doc.data();
                    const canSee = canSeeWarehouseScoped(
                        accessibleVoucherScopes,
                        user.id,
                        data.creator_id,
                        data.warehouse_id,
                    );
                    if (canSee) count++;
                    if (canSee && ["APPROVED", "RECEIVING"].includes(data.status)) {
                        taskCount++;
                    }
                });
                setImportVoucherCount(count);
                setImportTaskCount(taskCount);
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
                let taskCount = 0;
                snap.forEach((doc) => {
                    const data = doc.data();
                    const canSee = canSeeWarehouseScoped(
                        accessibleVoucherScopes,
                        user.id,
                        data.creator_id,
                        data.warehouse_id,
                    );
                    if (canSee) count++;
                    if (canSee && ["APPROVED", "PICKING", "SHIPPED"].includes(data.status)) {
                        taskCount++;
                    }
                });
                setExportVoucherCount(count);
                setExportTaskCount(taskCount);
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
                let taskCount = 0;
                snap.forEach((doc) => {
                    const data = doc.data();
                    const canSee = canSeeTransferScoped(accessibleTransferScopes, user.id, data);
                    if (canSee) count++;
                    if (canSee && ["PENDING_RECEIVE", "RECEIVING"].includes(data.status)) {
                        taskCount++;
                    }
                });
                setTransferCount(count);
                setTransferTaskCount(taskCount);
            },
            (err) => console.error("[useMenuBadges] transfers error:", err),
        );

        return () => unsub();
    }, [user?.id, accessibleTransferScopes]);

    // ── Nonconformity reports needing resolution (realtime) ──
    useEffect(() => {
        if (!user?.id) return;

        const q = query(
            collection(db, "nonconformity_reports"),
            where("status", "in", ["OPEN", "QUARANTINED", "UNDER_REVIEW"]),
            where("is_deleted", "==", false),
        );

        const unsub = onSnapshot(
            q,
            (snap) => {
                let count = 0;
                snap.forEach((doc) => {
                    const data = doc.data();
                    if (data.reporter_id === user.id) return;
                    if (accessibleInventoryScopes.isGlobal) {
                        count++;
                    } else if (accessibleInventoryScopes.ids.includes(data.warehouse_id)) {
                        count++;
                    }
                });
                setNonconformityCount(count);
            },
            (err) => console.error("[useMenuBadges] nonconformities error:", err),
        );

        return () => unsub();
    }, [user?.id, accessibleInventoryScopes]);

    const taskActionCount = useMemo(() => {
        return (
            tasksCount +
            importTaskCount +
            exportTaskCount +
            transferTaskCount +
            nonconformityCount
        );
    }, [
        exportTaskCount,
        importTaskCount,
        nonconformityCount,
        tasksCount,
        transferTaskCount,
    ]);

    return {
        tasks: taskActionCount,
        vouchers: importVoucherCount + exportVoucherCount + transferCount,
        importVouchers: importVoucherCount,
        exportVouchers: exportVoucherCount,
        transfers: transferCount,
        nonconformities: nonconformityCount,
    };
}
