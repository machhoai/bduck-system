"use client";

import { useMemo } from "react";
import { useImportVouchers } from "./useImportVouchers";
import { useExportVouchers } from "./useExportVouchers";
import { useTransferOrders } from "./useTransferOrders";
import type { UnifiedVoucher } from "../types/unified-voucher";

interface UseUnifiedVouchersReturn {
    activeVouchers: UnifiedVoucher[];
    completedVouchers: UnifiedVoucher[];
    allVouchers: UnifiedVoucher[];
    loading: boolean;
}

export function useUnifiedVouchers(): UseUnifiedVouchersReturn {
    const { 
        activeVouchers: activeImports, 
        completedVouchers: completedImports,
        allVouchers: allImports,
        loading: loadingImports 
    } = useImportVouchers();

    const { 
        activeVouchers: activeExports, 
        completedVouchers: completedExports,
        loading: loadingExports 
    } = useExportVouchers();

    const { 
        activeOrders: activeTransfers, 
        completedOrders: completedTransfers,
        loading: loadingTransfers 
    } = useTransferOrders();

    const loading = loadingImports || loadingExports || loadingTransfers;

    const allExportVouchers = useMemo(() => [...activeExports, ...completedExports], [activeExports, completedExports]);
    const allTransferOrders = useMemo(() => [...activeTransfers, ...completedTransfers], [activeTransfers, completedTransfers]);

    const activeVouchers = useMemo(() => {
        const unifiedImports: UnifiedVoucher[] = activeImports.map(v => ({
            id: v.id,
            type: "IMPORT",
            voucher_number: v.voucher_number,
            status: v.status,
            warehouse_id: v.warehouse_id,
            creator_id: v.creator_id,
            approver_id: v.approver_id,
            created_at: v.created_at,
            action_time: v.action_time,
            notes: v.notes,
            raw: v
        }));

        const unifiedExports: UnifiedVoucher[] = activeExports.map(v => ({
            id: v.id,
            type: "EXPORT",
            voucher_number: v.voucher_number,
            status: v.status,
            warehouse_id: v.warehouse_id,
            creator_id: v.creator_id,
            approver_id: v.approver_id,
            created_at: v.created_at,
            action_time: v.action_time,
            notes: v.notes,
            raw: v
        }));

        const unifiedTransfers: UnifiedVoucher[] = activeTransfers.map(v => ({
            id: v.id,
            type: "TRANSFER",
            voucher_number: v.order_number,
            status: v.status,
            warehouse_id: v.source_warehouse_id,
            destination_warehouse_id: v.destination_warehouse_id,
            creator_id: v.creator_id,
            approver_id: v.approver_id,
            created_at: v.created_at,
            action_time: v.action_time,
            notes: v.notes,
            raw: v
        }));

        return [...unifiedImports, ...unifiedExports, ...unifiedTransfers].sort((a, b) => {
            const aTime = a.created_at instanceof Date ? a.created_at.getTime() : new Date(a.created_at as any).getTime();
            const bTime = b.created_at instanceof Date ? b.created_at.getTime() : new Date(b.created_at as any).getTime();
            return (isNaN(bTime) ? 0 : bTime) - (isNaN(aTime) ? 0 : aTime);
        });
    }, [activeImports, activeExports, activeTransfers]);

    const completedVouchers = useMemo(() => {
        const unifiedImports: UnifiedVoucher[] = completedImports.map(v => ({
            id: v.id,
            type: "IMPORT",
            voucher_number: v.voucher_number,
            status: v.status,
            warehouse_id: v.warehouse_id,
            creator_id: v.creator_id,
            approver_id: v.approver_id,
            created_at: v.created_at,
            action_time: v.action_time,
            notes: v.notes,
            raw: v
        }));

        const unifiedExports: UnifiedVoucher[] = completedExports.map(v => ({
            id: v.id,
            type: "EXPORT",
            voucher_number: v.voucher_number,
            status: v.status,
            warehouse_id: v.warehouse_id,
            creator_id: v.creator_id,
            approver_id: v.approver_id,
            created_at: v.created_at,
            action_time: v.action_time,
            notes: v.notes,
            raw: v
        }));

        const unifiedTransfers: UnifiedVoucher[] = completedTransfers.map(v => ({
            id: v.id,
            type: "TRANSFER",
            voucher_number: v.order_number,
            status: v.status,
            warehouse_id: v.source_warehouse_id,
            destination_warehouse_id: v.destination_warehouse_id,
            creator_id: v.creator_id,
            approver_id: v.approver_id,
            created_at: v.created_at,
            action_time: v.action_time,
            notes: v.notes,
            raw: v
        }));

        return [...unifiedImports, ...unifiedExports, ...unifiedTransfers].sort((a, b) => {
            const aTime = a.created_at instanceof Date ? a.created_at.getTime() : new Date(a.created_at as any).getTime();
            const bTime = b.created_at instanceof Date ? b.created_at.getTime() : new Date(b.created_at as any).getTime();
            return (isNaN(bTime) ? 0 : bTime) - (isNaN(aTime) ? 0 : aTime);
        });
    }, [completedImports, completedExports, completedTransfers]);

    const allVouchers = useMemo(() => [...activeVouchers, ...completedVouchers].sort((a, b) => {
        const aTime = a.created_at instanceof Date ? a.created_at.getTime() : new Date(a.created_at as any).getTime();
        const bTime = b.created_at instanceof Date ? b.created_at.getTime() : new Date(b.created_at as any).getTime();
        return (isNaN(bTime) ? 0 : bTime) - (isNaN(aTime) ? 0 : aTime);
    }), [activeVouchers, completedVouchers]);

    return { activeVouchers, completedVouchers, allVouchers, loading };
}
