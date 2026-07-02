"use client";

import { useState } from "react";
import { Network } from "lucide-react";
import { useLanFileTransfer } from "@/hooks/useLanFileTransfer";
import { useTranslation } from "@/lib/i18n";
import LanFileTransferModal from "./LanFileTransferModal";

export default function LanFileTransferButton() {
  const { t } = useTranslation();
  const transfer = useLanFileTransfer();
  const [isOpen, setIsOpen] = useState(false);

  if (!transfer.isAvailable) return null;

  return (
    <div className="relative z-50">
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="relative flex h-8 w-8 items-center justify-center rounded-full bg-white text-[var(--color-text-muted)] shadow-sm transition hover:bg-[var(--color-surface-card)] hover:text-[var(--color-brand-primary)]"
        title={t.lanTransfer.buttonTitle}
        aria-label={t.lanTransfer.buttonTitle}
      >
        <Network size={18} />
        {transfer.pendingCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-[var(--color-accent-error)] px-1 text-xxs font-bold text-white">
            {transfer.pendingCount > 99 ? "99+" : transfer.pendingCount}
          </span>
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
