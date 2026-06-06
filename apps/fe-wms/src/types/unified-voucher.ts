import type { 
    ImportVoucher, 
    ExportVoucher, 
    TransferOrder,
    ImportVoucherStatus,
    ExportVoucherStatus,
    TransferOrderStatus
} from "@bduck/shared-types";

export type UnifiedVoucherType = "IMPORT" | "EXPORT" | "TRANSFER";

export interface UnifiedVoucher {
    id: string;
    type: UnifiedVoucherType;
    voucher_number: string;
    status: ImportVoucherStatus | ExportVoucherStatus | TransferOrderStatus;
    warehouse_id: string; // Destination for IMPORT, Source for EXPORT and TRANSFER
    destination_warehouse_id?: string; // Only for TRANSFER
    creator_id: string;
    approver_id: string | null;
    created_at: Date;
    action_time: Date;
    notes: string | null;
    // For specific rendering when needed
    raw: ImportVoucher | ExportVoucher | TransferOrder;
}
