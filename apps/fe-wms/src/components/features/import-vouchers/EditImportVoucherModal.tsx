"use client";

import { X } from "lucide-react";
import CreateVoucherTab from "./CreateVoucherTab";

interface EditImportVoucherModalProps {
    editData: Record<string, unknown>;
    onClose: () => void;
}

export function EditImportVoucherModal({ editData, onClose }: EditImportVoucherModalProps) {
    return (
        <>
            <div
                className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs transition-opacity"
                onClick={onClose}
            />

            <div className="fixed inset-4 md:inset-10 z-50 flex flex-col bg-[var(--color-surface-subtle)] rounded-xl shadow-2xl overflow-hidden">
                <div className="flex items-center justify-between border-b border-[var(--color-border-subtle)] bg-white px-4 py-3">
                    <h2 className="text-lg font-bold text-[var(--color-text-primary)]">
                        Sửa phiếu nhập kho
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
                    <CreateVoucherTab
                        editData={editData}
                        isEdit={true}
                        onCreated={onClose}
                    />
                </div>
            </div>
        </>
    );
}
