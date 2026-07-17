"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Building2,
  ChevronRight,
  CircleAlert,
  Search,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import {
  WarehouseType,
  type OfficeScopeOverviewItem,
  type Warehouse,
} from "@bduck/shared-types";
import { Skeleton } from "@/components/ui/Skeleton";
import { useOfficeScopeOverview } from "@/hooks/useOfficeScopeOverview";
import { useTranslation } from "@/lib/i18n";

export function OfficeScopeOverviewPanel({
  facilities,
}: {
  facilities: Warehouse[];
}) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const officeIds = useMemo(
    () =>
      facilities
        .filter((facility) => facility.type === WarehouseType.OFFICE)
        .map((office) => office.id),
    [facilities],
  );
  const { items, isLoading, error } = useOfficeScopeOverview(officeIds);
  const visibleItems = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase("vi");
    if (!keyword) return items;
    return items.filter((item) =>
      `${item.office_name} ${item.office_code}`
        .toLocaleLowerCase("vi")
        .includes(keyword),
    );
  }, [items, search]);
  const configuredCount = items.filter(
    (item) => item.scope_status === "ACTIVE",
  ).length;
  const attentionCount = items.length - configuredCount;

  return (
    <div className="grid gap-4">
      <section className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
              {t.officeScope.overviewTitle}
            </h2>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              {t.officeScope.overviewDescription}
            </p>
          </div>
          <label className="flex h-10 w-full items-center gap-2 rounded-full border border-[var(--color-border-subtle)] bg-white px-4 lg:max-w-sm">
            <Search size={16} className="text-[var(--color-text-muted)]" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t.officeScope.searchPlaceholder}
              className="min-w-0 flex-1 bg-transparent text-sm outline-none"
            />
          </label>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
          <SummaryMetric
            icon={Building2}
            label={t.officeScope.officeCount}
            value={items.length}
          />
          <SummaryMetric
            icon={ShieldCheck}
            label={t.officeScope.configuredCount}
            value={configuredCount}
          />
          <SummaryMetric
            icon={CircleAlert}
            label={t.officeScope.attentionCount}
            value={attentionCount}
          />
        </div>
      </section>

      {isLoading ? (
        <OverviewSkeleton />
      ) : error ? (
        <div className="rounded-[var(--radius-md)] border border-[var(--color-error-border)] bg-[var(--color-error-bg)] p-4 text-sm text-[var(--color-error-text)]">
          {error}
        </div>
      ) : visibleItems.length === 0 ? (
        <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border-subtle)] bg-white p-8 text-center">
          <Building2 className="mx-auto text-[var(--color-text-muted)]" />
          <p className="mt-3 text-sm font-semibold text-[var(--color-text-primary)]">
            {items.length === 0
              ? t.officeScope.noOffices
              : t.officeScope.noSearchResults}
          </p>
          {items.length === 0 && (
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              {t.officeScope.noOfficesHint}
            </p>
          )}
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visibleItems.map((item) => (
            <OfficeScopeCard key={item.office_id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

function OfficeScopeCard({ item }: { item: OfficeScopeOverviewItem }) {
  const { t } = useTranslation();
  const statusStyles =
    item.scope_status === "ACTIVE"
      ? "bg-emerald-50 text-emerald-700"
      : item.scope_status === "EMPTY"
        ? "bg-amber-50 text-amber-700"
        : "bg-slate-100 text-slate-600";
  return (
    <Link
      href={`/warehouses/${item.office_id}`}
      className="group rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md active:scale-[0.99]"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-surface-pearl)] text-[var(--color-brand-primary)]">
          <Building2 size={21} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-[var(--color-text-primary)]">
            {item.office_name}
          </p>
          <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
            {item.office_code} · {t.officeScope.revision} {item.revision}
          </p>
        </div>
        <ChevronRight
          size={18}
          className="text-[var(--color-text-muted)] transition-transform group-hover:translate-x-0.5"
        />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
        <span className={`rounded-full px-2.5 py-1 font-semibold ${statusStyles}`}>
          {t.officeScope.scopeStatuses[item.scope_status]}
        </span>
        <span className="rounded-full bg-[var(--color-surface-card)] px-2.5 py-1 text-[var(--color-text-secondary)]">
          {item.scope_mode
            ? t.officeScope.modes[item.scope_mode]
            : t.officeScope.modes.UNCONFIGURED}
        </span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 border-t border-[var(--color-border-soft)] pt-3 text-xs text-[var(--color-text-secondary)]">
        <span className="flex items-center gap-1.5">
          <ShieldCheck size={14} />
          {item.effective_facility_count} {t.officeScope.facilitiesCount}
        </span>
        <span className="flex items-center gap-1.5">
          <UsersRound size={14} />
          {item.affected_employee_count} {t.officeScope.employeeCount}
        </span>
      </div>
    </Link>
  );
}

function SummaryMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Building2;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-[var(--radius-md)] bg-[var(--color-surface-card)] p-3">
      <Icon size={16} className="text-[var(--color-brand-primary)]" />
      <p className="mt-2 text-lg font-bold text-[var(--color-text-primary)]">
        {value}
      </p>
      <p className="truncate text-[11px] text-[var(--color-text-muted)]">
        {label}
      </p>
    </div>
  );
}

function OverviewSkeleton() {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <Skeleton key={index} className="h-44 rounded-[var(--radius-lg)]" />
      ))}
    </div>
  );
}
