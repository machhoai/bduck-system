"use client";

import { LayoutDashboard } from "lucide-react";
import { useTranslation } from "../../../lib/i18n";
import { useUserStore } from "../../../stores/useUserStore";

export default function DashboardPage() {
  const { t } = useTranslation();
  const user = useUserStore((s) => s.user);
  const displayName = user?.full_name?.split(" ").pop() || "";

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-1">
        <p className="text-sm font-normal text-[var(--color-text-muted)]">
          {t.dashboard.title}
        </p>
        <h1 className="font-[var(--font-display)] text-[34px] font-semibold leading-[1.1] tracking-[-0.28px] text-[var(--color-text-primary)] lg:text-[40px]">
          {t.dashboard.welcome}
          {displayName ? `, ${displayName}` : ""}
        </h1>
        <p className="text-[17px] font-normal leading-[1.47] text-[var(--color-text-secondary)]">
          Joy World Cityfuns WMS
        </p>
      </header>

      <section className="flex min-h-80 flex-col items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] px-6 py-20 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface-pearl)] text-[var(--color-brand-primary)]">
          <LayoutDashboard size={26} strokeWidth={1.7} />
        </div>
        <p className="text-[17px] leading-[1.47] text-[var(--color-text-muted)]">
          {t.dashboard.emptyState}
        </p>
      </section>
    </div>
  );
}
