"use client";

import type { WarehouseType } from "@bduck/shared-types";
import { useTranslation } from "@/lib/i18n";

export function WarehouseGroupHeading({
  type,
  count,
}: {
  type: WarehouseType;
  count: number;
}) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-2">
      <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
        {t.warehouses.types[type]}
      </h3>
      <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-[var(--color-surface-card)] px-2 py-0.5 text-xs font-semibold tabular-nums text-[var(--color-text-muted)]">
        {count}
      </span>
      <div className="h-px flex-1 bg-[var(--color-border-soft)]" />
    </div>
  );
}
