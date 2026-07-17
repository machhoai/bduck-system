"use client";

import { useState } from "react";
import Link from "next/link";
import { Building2, ChevronLeft, MapPin, Pencil } from "lucide-react";
import type { Warehouse } from "@bduck/shared-types";
import { WarehouseFormModal } from "@/components/warehouses/WarehouseFormModal";
import { useTranslation } from "@/lib/i18n";
import { useUserStore } from "@/stores/useUserStore";
import { OfficeScopeEditor } from "./OfficeScopeEditor";
import { OfficeScopeHistory } from "./OfficeScopeHistory";

interface OfficeFacilityDetailProps {
  office: Warehouse;
  facilities: Warehouse[];
  managerName: string;
  onSaveOffice: (payload: unknown) => Promise<unknown>;
}

export function OfficeFacilityDetail({
  office,
  facilities,
  managerName,
  onSaveOffice,
}: OfficeFacilityDetailProps) {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const canEdit = useUserStore((state) =>
    state.hasPermission("warehouses.write", office.id),
  );
  return (
    <div className="mx-auto grid w-full max-w-7xl gap-4 pb-10">
      <Link
        href="/warehouses"
        className="inline-flex w-fit items-center gap-1 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
      >
        <ChevronLeft size={16} />
        {t.nav.warehouses}
      </Link>
      <header className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] p-4 sm:p-5">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-surface-pearl)] text-[var(--color-brand-primary)]">
            <Building2 size={28} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-[var(--color-surface-card)] px-2.5 py-1 text-xs font-semibold text-[var(--color-text-secondary)]">
                {office.code}
              </span>
              <span className="rounded-full bg-[var(--color-surface-card)] px-2.5 py-1 text-xs text-[var(--color-text-secondary)]">
                {t.warehouses.types[office.type]}
              </span>
            </div>
            <h1 className="mt-2 text-xl font-bold text-[var(--color-text-primary)]">
              {office.name}
            </h1>
            {office.address && (
              <p className="mt-2 flex items-start gap-2 text-sm text-[var(--color-text-muted)]">
                <MapPin size={15} className="mt-0.5 shrink-0" />
                {office.address}
              </p>
            )}
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
              {t.warehouses.managerId}: {managerName}
            </p>
          </div>
          {canEdit && (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--color-border-subtle)] bg-white text-[var(--color-text-secondary)]"
              aria-label={t.warehouses.editWarehouse}
            >
              <Pencil size={16} />
            </button>
          )}
        </div>
      </header>
      <OfficeScopeEditor officeId={office.id} facilities={facilities} />
      <OfficeScopeHistory officeId={office.id} facilities={facilities} />
      <WarehouseFormModal
        isOpen={isEditing}
        warehouse={office}
        onClose={() => setIsEditing(false)}
        onSave={onSaveOffice}
      />
    </div>
  );
}
