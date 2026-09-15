"use client";

import { RefreshCw } from "lucide-react";

import { useTranslation } from "@/lib/i18n";
import { PARTNER_INVENTORY_TEXT } from "@/lib/i18n/partnerInventoryTranslations";
import { useUserStore } from "@/stores/useUserStore";

export function PartnerInventorySyncButton({
  warehouseId,
  onClick,
  compact = false,
}: {
  warehouseId: string;
  onClick: () => void;
  compact?: boolean;
}) {
  const { lang } = useTranslation();
  const canRead = useUserStore((state) =>
    state.hasPermission("partner_inventory.read", warehouseId),
  );
  if (!canRead) return null;
  const copy = PARTNER_INVENTORY_TEXT[lang === "zh" ? "zh" : "vi"];
  return (
    <button
      type="button"
      onClick={onClick}
      title={copy.open}
      className={compact
        ? "flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-brand-primary)] bg-white text-[var(--color-brand-primary)] active:scale-95"
        : "flex h-12 flex-1 items-center justify-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-brand-primary)] bg-white px-3 text-sm font-semibold text-[var(--color-brand-primary)] shadow-sm transition-all hover:bg-[var(--color-brand-primary-muted)] active:scale-[0.98]"}
    >
      <RefreshCw size={18} />
      {!compact && copy.open}
    </button>
  );
}
