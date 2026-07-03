"use client";

import { X } from "lucide-react";
import type { useLanFileTransfer } from "@/hooks/useLanFileTransfer";
import { useTranslation } from "@/lib/i18n";
import { formatLanFileSize } from "@/utils/lanFileTransfer";
import LanIncomingRequests from "./LanIncomingRequests";
import LanSendPanel from "./LanSendPanel";

type LanTransferApi = ReturnType<typeof useLanFileTransfer>;

interface LanFileTransferModalProps {
    transfer: LanTransferApi;
    onClose: () => void;
}

export default function LanFileTransferModal({
    transfer,
    onClose,
}: LanFileTransferModalProps) {
    const { t } = useTranslation();

    return (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/30 p-4">
            <div className="grid h-[calc(100vh-100px)] absolute bottom-10 right-20 w-4/5 grid-rows-[auto_1fr] gap-3 overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] p-4 shadow-xl">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <h2 className="text-base font-bold text-[var(--color-text-primary)]">
                            {t.lanTransfer.title}
                        </h2>
                        <p className="text-xs text-[var(--color-text-muted)]">
                            {t.lanTransfer.subtitle}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-text-muted)] transition hover:bg-[var(--color-surface-subtle)]"
                        aria-label={t.lanTransfer.close}
                        title={t.lanTransfer.close}
                    >
                        <X size={16} />
                    </button>
                </div>

                <div className="grid min-h-0 gap-3 overflow-y-auto lg:grid-cols-[1fr_360px]">
                    <LanSendPanel transfer={transfer} />
                    <div className="flex flex-col h-full min-h-0 gap-3">
                        <LanIncomingRequests transfer={transfer} />
                        {transfer.progress && (
                            <div className="grid gap-2 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-3">
                                <p className="truncate text-xs font-bold text-[var(--color-text-primary)]">
                                    {transfer.progress.fileName || t.lanTransfer.transferring}
                                </p>
                                <progress
                                    className="h-2 w-full"
                                    value={transfer.progress.sentBytes}
                                    max={transfer.progress.totalBytes || 1}
                                />
                                <p className="text-xs text-[var(--color-text-muted)]">
                                    {formatLanFileSize(transfer.progress.sentBytes)} /{" "}
                                    {formatLanFileSize(transfer.progress.totalBytes)}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
