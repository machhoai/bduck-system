"use client";

import { Eye } from "lucide-react";
import type { OfficeScopeFacilityOption } from "@bduck/shared-types";
import { useTranslation } from "@/lib/i18n";

export function OfficeScopePreview({
  facilityIds,
  facilities,
}: {
  facilityIds: string[];
  facilities: OfficeScopeFacilityOption[];
}) {
  const { t } = useTranslation();
  const byId = new Map(facilities.map((facility) => [facility.id, facility]));
  return (
    <section className="mt-4 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text-primary)]">
        <Eye size={16} />
        {t.officeScope.preview}
      </h3>
      {facilityIds.length === 0 ? (
        <p className="mt-2 text-sm text-[var(--color-text-muted)]">
          {t.officeScope.noEffectiveScope}
        </p>
      ) : (
        <div className="mt-3 flex max-h-28 flex-wrap gap-2 overflow-y-auto">
          {facilityIds.map((facilityId) => {
            const facility = byId.get(facilityId);
            return (
              <span
                key={facilityId}
                className="rounded-full border border-[var(--color-border-subtle)] bg-white px-3 py-1 text-xs text-[var(--color-text-secondary)]"
              >
                {facility?.name ?? facilityId}
              </span>
            );
          })}
        </div>
      )}
    </section>
  );
}
