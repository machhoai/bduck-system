"use client";

import { useEffect, useMemo, useState } from "react";
import CreateVoucherTab from "../import-vouchers/CreateVoucherTab";
import CreateExportTab from "../export-vouchers/CreateExportTab";
import CreateTransferTab from "../transfers/CreateTransferTab";
import { ArrowDownCircle, ArrowUpCircle, ArrowRightCircle } from "lucide-react";
import { useTranslation } from "../../../lib/i18n";
import { useUserStore } from "../../../stores/useUserStore";

type VoucherType = "IMPORT" | "EXPORT" | "TRANSFER";

interface UnifiedCreateTabProps {
    cloneData?: Record<string, unknown> | null;
    prefillWarehouseId?: string;
    prefillVoucherType?: VoucherType;
    onCreated: () => void;
}

function resolveVoucherType(
    allowedTypes: VoucherType[],
    cloneData?: Record<string, unknown> | null,
    prefillVoucherType?: VoucherType,
): VoucherType {
    const fallback = allowedTypes[0] ?? "IMPORT";

    if (cloneData) {
        const clonedType = cloneData.type
            ? (cloneData.type as VoucherType)
            : "export_type" in cloneData
                ? "EXPORT"
                : "transfer_type" in cloneData
                    ? "TRANSFER"
                    : "IMPORT";
        return allowedTypes.includes(clonedType) ? clonedType : fallback;
    }

    if (prefillVoucherType && allowedTypes.includes(prefillVoucherType)) {
        return prefillVoucherType;
    }

    return fallback;
}

export default function UnifiedCreateTab({ cloneData, prefillWarehouseId, prefillVoucherType, onCreated }: UnifiedCreateTabProps) {
    const { t } = useTranslation();
    const hasPermission = useUserStore((state) => state.hasPermission);
    const canCreateVoucher = hasPermission("vouchers.write", prefillWarehouseId);
    const canCreateTransfer = hasPermission("transfers.write", prefillWarehouseId);
    const allowedTypes = useMemo<VoucherType[]>(
        () => [
            ...(canCreateVoucher ? (["IMPORT", "EXPORT"] as VoucherType[]) : []),
            ...(canCreateTransfer ? (["TRANSFER"] as VoucherType[]) : []),
        ],
        [canCreateTransfer, canCreateVoucher],
    );

    const [voucherType, setVoucherType] = useState<VoucherType>(() =>
        resolveVoucherType(allowedTypes, cloneData, prefillVoucherType),
    );

    useEffect(() => {
        setVoucherType(resolveVoucherType(allowedTypes, cloneData, prefillVoucherType));
    }, [allowedTypes, cloneData, prefillVoucherType]);

    if (allowedTypes.length === 0) {
        return null;
    }

    return (
        <div className="flex flex-col flex-1 h-full">
            {/* Type Selector Header */}
            <div className="flex flex-col gap-3 px-4 pt-4 pb-0">
                <p className="text-sm font-semibold text-[var(--color-text-primary)]">{t.vouchers?.createTab?.selectType || "Chọn loại phiếu cần tạo:"}</p>
                <div className="flex gap-3">
                    {canCreateVoucher && (
                        <button
                            type="button"
                            onClick={() => setVoucherType("IMPORT")}
                            className={`flex items-center gap-2 rounded-lg border px-4 py-3 transition-all ${voucherType === "IMPORT"
                                ? "border-blue-600 bg-blue-50 text-blue-700 shadow-sm"
                                : "border-[var(--color-border-subtle)] bg-white text-[var(--color-text-secondary)] hover:border-blue-300 hover:bg-blue-50/50"
                                }`}
                        >
                            <ArrowDownCircle size={20} className={voucherType === "IMPORT" ? "text-blue-600" : "text-gray-400"} />
                            <div className="flex flex-col items-start">
                                <span className="text-sm font-bold">{t.vouchers?.createTab?.import || "Phiếu nhập kho"}</span>
                            </div>
                        </button>
                    )}

                    {canCreateVoucher && (
                        <button
                            type="button"
                            onClick={() => setVoucherType("EXPORT")}
                            className={`flex items-center gap-2 rounded-lg border px-4 py-3 transition-all ${voucherType === "EXPORT"
                                ? "border-amber-500 bg-amber-50 text-amber-700 shadow-sm"
                                : "border-[var(--color-border-subtle)] bg-white text-[var(--color-text-secondary)] hover:border-amber-300 hover:bg-amber-50/50"
                                }`}
                        >
                            <ArrowUpCircle size={20} className={voucherType === "EXPORT" ? "text-amber-600" : "text-gray-400"} />
                            <div className="flex flex-col items-start">
                                <span className="text-sm font-bold">{t.vouchers?.createTab?.export || "Phiếu xuất kho"}</span>
                            </div>
                        </button>
                    )}

                    {canCreateTransfer && (
                        <button
                            type="button"
                            onClick={() => setVoucherType("TRANSFER")}
                            className={`flex items-center gap-2 rounded-lg border px-4 py-3 transition-all ${voucherType === "TRANSFER"
                                ? "border-purple-600 bg-purple-50 text-purple-700 shadow-sm"
                                : "border-[var(--color-border-subtle)] bg-white text-[var(--color-text-secondary)] hover:border-purple-300 hover:bg-purple-50/50"
                                }`}
                        >
                            <ArrowRightCircle size={20} className={voucherType === "TRANSFER" ? "text-purple-600" : "text-gray-400"} />
                            <div className="flex flex-col items-start">
                                <span className="text-sm font-bold">{t.vouchers?.createTab?.transfer || "Lệnh điều chuyển"}</span>
                            </div>
                        </button>
                    )}
                </div>
            </div>

            {/* Form Container */}
            <div className="flex-1 mt-2">
                {voucherType === "IMPORT" && (
                    <CreateVoucherTab
                        cloneData={cloneData}
                        prefillWarehouseId={prefillWarehouseId}
                        onCreated={onCreated}
                    />
                )}
                {voucherType === "EXPORT" && (
                    <CreateExportTab
                        cloneData={cloneData}
                        prefillWarehouseId={prefillWarehouseId}
                        onCreated={onCreated}
                    />
                )}
                {voucherType === "TRANSFER" && (
                    <CreateTransferTab
                        cloneData={cloneData}
                        prefillWarehouseId={prefillWarehouseId}
                        onCreated={onCreated}
                    />
                )}
            </div>
        </div>
    );
}
