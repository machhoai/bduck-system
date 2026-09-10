"use client";

import type { RevenueDataSource } from "@bduck/shared-types";
import { Cloud, DatabaseZap } from "lucide-react";

import { useTranslation } from "@/lib/i18n";

export default function RevenueSourceTabs({
  value,
  onChange,
}: {
  value: RevenueDataSource;
  onChange: (source: RevenueDataSource) => void;
}) {
  const { t } = useTranslation();
  const copy = t.revenue.sources;
  const tabs = [
    {
      value: "OPEN_API" as const,
      label: copy.openApi,
      description: copy.openApiDescription,
      icon: Cloud,
    },
    {
      value: "LOCAL_POS" as const,
      label: copy.localPos,
      description: copy.localPosDescription,
      icon: DatabaseZap,
    },
  ];

  return (
    <div
      role="tablist"
      aria-label={t.revenue.title}
      className="grid grid-cols-2 gap-1 rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-1 shadow-sm"
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const active = value === tab.value;
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.value)}
            className={`flex min-h-12 min-w-0 items-center gap-2.5 rounded-[var(--radius-md)] px-3 py-2 text-left transition-all ${
              active
                ? "bg-white text-[var(--color-brand-primary)] shadow-sm ring-1 ring-black/[0.04]"
                : "text-[var(--color-text-muted)] hover:bg-white/70 hover:text-[var(--color-text-primary)]"
            }`}
          >
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-sm)] ${
                active
                  ? "bg-[var(--color-brand-primary-muted)] text-[var(--color-brand-primary)]"
                  : "bg-white text-[var(--color-text-muted)]"
              }`}
            >
              <Icon size={16} aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold">
                {tab.label}
              </span>
              <span className="mt-0.5 hidden truncate text-xxs text-[var(--color-text-muted)] lg:block">
                {tab.description}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
