"use client";

import { useState } from "react";
import { Network, UsersRound } from "lucide-react";
import { useLanFileTransfer } from "@/hooks/useLanFileTransfer";
import { useTranslation } from "@/lib/i18n";
import LanFileTransferModal from "./LanFileTransferModal";

interface LanFileTransferButtonProps {
    isCollapsed?: boolean;
}

export default function LanFileTransferButton({
    isCollapsed = false,
}: LanFileTransferButtonProps) {
    const { t } = useTranslation();
    const transfer = useLanFileTransfer();
    const [isOpen, setIsOpen] = useState(false);
    const isDevMode = process.env.NODE_ENV === "development";
    const onlineCount = transfer.peers.length;
    const shouldShow = isDevMode || transfer.isAvailable;
    const onlineLabel = t.lanTransfer.onlineCount.replace(
        "{{count}}",
        String(onlineCount),
    );

    if (!shouldShow) return null;

    if (isCollapsed) {
        return (
            <div className="relative z-50 grid place-items-center">
                <button
                    type="button"
                    onClick={() => setIsOpen(true)}
                    className="relative flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] text-white/75 transition hover:bg-white/10 hover:text-white"
                    title={t.lanTransfer.buttonTitle}
                    aria-label={t.lanTransfer.buttonTitle}
                >
                    <Network size={18} />
                    {(onlineCount > 0 || isDevMode) && (
                        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-emerald-500 px-1 text-xxs font-bold text-white">
                            {onlineCount > 99 ? "99+" : onlineCount}
                        </span>
                    )}
                    {transfer.pendingCount > 0 && (
                        <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-[var(--color-accent-error)] ring-2 ring-[var(--color-surface-nav)]" />
                    )}
                </button>

                {isOpen && (
                    <LanFileTransferModal
                        transfer={transfer}
                        onClose={() => setIsOpen(false)}
                    />
                )}
            </div>
        );
    }

    return (
        <div className="relative z-50">
            <button
                type="button"
                onClick={() => setIsOpen(true)}
                className="grid w-full grid-cols-[32px_1fr_auto] items-center gap-2 rounded-[var(--radius-md)] px-2 py-2 text-left text-white/80 transition hover:bg-white/10 hover:text-white"
                title={t.lanTransfer.buttonTitle}
                aria-label={t.lanTransfer.buttonTitle}
            >
                <span className="relative flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] bg-white/10">
                    <Network size={17} />
                    {transfer.pendingCount > 0 && (
                        <span className="absolute -right-1 -top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-[var(--color-accent-error)] px-1 text-xxs font-bold text-white">
                            {transfer.pendingCount > 99 ? "99+" : transfer.pendingCount}
                        </span>
                    )}
                </span>
                <span className="grid min-w-0 gap-0.5">
                    <span className="truncate text-xs font-bold">
                        {t.lanTransfer.sidebarTitle}
                    </span>
                    <span className="truncate text-xxs text-white/45">
                        {t.lanTransfer.buttonTitle}
                    </span>
                </span>
                {(onlineCount > 0 || isDevMode) && (
                    <span className="flex items-center gap-1 rounded-[var(--radius-sm)] bg-emerald-500/15 px-1.5 py-1 text-xxs font-bold text-emerald-100">
                        <UsersRound size={12} />
                        {onlineLabel}
                    </span>
                )}
                {transfer.pendingCount > 0 && (
                    <span className="sr-only">{transfer.pendingCount}</span>
                )}
            </button>

            {isOpen && (
                <LanFileTransferModal
                    transfer={transfer}
                    onClose={() => setIsOpen(false)}
                />
            )}
        </div>
    );
}
