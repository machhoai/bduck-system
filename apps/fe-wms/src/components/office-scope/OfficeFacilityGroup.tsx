"use client";

import { useMemo, useState } from "react";
import { Building2, Search, Store } from "lucide-react";
import type { OfficeScopeFacilityOption } from "@bduck/shared-types";
import { useTranslation } from "@/lib/i18n";

interface OfficeFacilityGroupProps {
  title: string;
  facilities: OfficeScopeFacilityOption[];
  selectedIds: Set<string>;
  editableIds: Set<string>;
  disabled: boolean;
  onToggle: (facilityId: string) => void;
  onSetFacilities: (facilityIds: readonly string[], selected: boolean) => void;
}

export function OfficeFacilityGroup({
  title,
  facilities,
  selectedIds,
  editableIds,
  disabled,
  onToggle,
  onSetFacilities,
}: OfficeFacilityGroupProps) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const Icon = facilities[0]?.type === "STORE" ? Store : Building2;
  const visibleFacilities = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase("vi");
    if (!keyword) return facilities;
    return facilities.filter((facility) =>
      `${facility.name} ${facility.code}`
        .toLocaleLowerCase("vi")
        .includes(keyword),
    );
  }, [facilities, search]);
  const visibleEditableIds = visibleFacilities
    .filter((facility) => editableIds.has(facility.id))
    .map((facility) => facility.id);
  const allVisibleSelected =
    visibleEditableIds.length > 0 &&
    visibleEditableIds.every((facilityId) => selectedIds.has(facilityId));

  return (
    <section className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-white">
      <div className="flex items-center justify-between border-b border-[var(--color-border-soft)] bg-[var(--color-surface-card)] px-4 py-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text-primary)]">
          <Icon size={16} />
          {title}
        </h3>
        <span className="rounded-full bg-white px-2.5 py-1 text-xs text-[var(--color-text-muted)]">
          {facilities.filter((facility) => selectedIds.has(facility.id)).length}
          /{facilities.length}
        </span>
      </div>
      <div className="flex items-center gap-2 border-b border-[var(--color-border-soft)] p-3">
        <label className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-full border border-[var(--color-border-subtle)] bg-white px-3">
          <Search size={14} className="text-[var(--color-text-muted)]" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t.officeScope.searchFacilities}
            className="min-w-0 flex-1 bg-transparent text-xs outline-none"
          />
        </label>
        {!disabled && visibleEditableIds.length > 0 && (
          <button
            type="button"
            onClick={() =>
              onSetFacilities(visibleEditableIds, !allVisibleSelected)
            }
            className="h-9 shrink-0 rounded-full bg-[var(--color-surface-card)] px-3 text-xs font-semibold text-[var(--color-text-secondary)] active:scale-95"
          >
            {allVisibleSelected
              ? t.officeScope.deselectVisible
              : t.officeScope.selectVisible}
          </button>
        )}
      </div>
      <div className="grid gap-2 p-3 sm:grid-cols-2">
        {visibleFacilities.length === 0 && (
          <p className="py-5 text-center text-sm text-[var(--color-text-muted)] sm:col-span-2">
            {t.officeScope.noFacilityMatches}
          </p>
        )}
        {visibleFacilities.map((facility) => {
          const checked = selectedIds.has(facility.id);
          // A facility removed from the ceiling may still be selected by an
          // older revision. It remains removable, but cannot be selected again.
          const itemDisabled =
            disabled || (!editableIds.has(facility.id) && !checked);
          return (
            <label
              key={facility.id}
              className={`flex min-h-14 items-center gap-3 rounded-[var(--radius-sm)] border px-3 py-2 transition-colors ${
                checked
                  ? "border-[var(--color-brand-primary)] bg-[var(--color-surface-pearl)]"
                  : "border-[var(--color-border-subtle)] bg-white"
              } ${itemDisabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
            >
              <input
                type="checkbox"
                checked={checked}
                disabled={itemDisabled}
                onChange={() => onToggle(facility.id)}
                className="h-4 w-4 accent-[var(--color-brand-primary)]"
              />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-[var(--color-text-primary)]">
                  {facility.name}
                </span>
                <span className="block truncate text-xs text-[var(--color-text-muted)]">
                  {facility.code}
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </section>
  );
}
