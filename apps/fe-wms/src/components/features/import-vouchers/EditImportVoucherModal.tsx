"use client";

import { X } from "lucide-react";
import CreateExportTab from "../export-vouchers/CreateExportTab";
import CreateTransferTab from "../transfers/CreateTransferTab";
import CreateVoucherTab from "./CreateVoucherTab";

interface EditImportVoucherModalProps {
    editData: Record<string, unknown>;
    onClose: () => void;
}

type VoucherType = "IMPORT" | "EXPORT" | "TRANSFER";

function getVoucherType(editData: Record<string, unknown>): VoucherType {
    if (editData.type === "EXPORT" || "export_type" in editData || "recipient_name" in editData) {
        return "EXPORT";
    }
    if (editData.type === "TRANSFER" || "transfer_type" in editData || "source_warehouse_id" in editData) {
        return "TRANSFER";
    }
    return "IMPORT";
}

export function EditImportVoucherModal({ editData, onClose }: EditImportVoucherModalProps) {
    const voucherType = getVoucherType(editData);
    const title =
        voucherType === "EXPORT"
            ? "S\u1eeda phi\u1ebfu xu\u1ea5t kho"
            : voucherType === "TRANSFER"
                ? "S\u1eeda l\u1ec7nh \u0111i\u1ec1u chuy\u1ec3n"
                : "S\u1eeda phi\u1ebfu nh\u1eadp kho";

    return (
        <>
            <div
                className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs transition-opacity"
                onClick={onClose}
            />

            <div className="fixed inset-4 md:inset-10 z-50 flex flex-col bg-[var(--color-surface-subtle)] rounded-xl shadow-2xl overflow-hidden">
                <div className="flex items-center justify-between border-b border-[var(--color-border-subtle)] bg-white px-4 py-3">
                    <h2 className="text-lg font-bold text-[var(--color-text-primary)]">
                        {title}
                    </h2>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg p-2 text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-neutral-100)] hover:text-[var(--color-text-secondary)]"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto relative">
                    {voucherType === "IMPORT" && (
                        <CreateVoucherTab
                            editData={editData}
                            isEdit={true}
                            onCreated={onClose}
                        />
                    )}
                    {voucherType === "EXPORT" && (
                        <CreateExportTab
                            editData={editData}
                            isEdit={true}
                            onCreated={onClose}
                        />
                    )}
                    {voucherType === "TRANSFER" && (
                        <CreateTransferTab
                            editData={editData}
                            isEdit={true}
                            onCreated={onClose}
                        />
                    )}
                </div>
            </div>
        </>
    );
}
