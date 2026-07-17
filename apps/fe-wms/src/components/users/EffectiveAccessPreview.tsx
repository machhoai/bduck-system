"use client";

import { ShieldCheck } from "lucide-react";
import type {
  FacilityAccessGrantSourceType,
  Warehouse,
} from "@bduck/shared-types";
import { useUserEffectiveAccess } from "@/hooks/useUserEffectiveAccess";
import { useTranslation } from "@/lib/i18n";
import { Skeleton } from "@/components/ui/Skeleton";

interface EffectiveAccessPreviewProps {
  userId?: string | null;
  facilities: Warehouse[];
}

export function EffectiveAccessPreview({
  userId,
  facilities,
}: EffectiveAccessPreviewProps) {
  const { t } = useTranslation();
  const { data, isLoading, error } = useUserEffectiveAccess(userId);
  const names = new Map(facilities.map((facility) => [facility.id, facility]));

  return (
    <section className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-4">
      <div className="flex items-start gap-3">
        <ShieldCheck
          size={18}
          className="mt-0.5 shrink-0 text-[var(--color-brand-primary)]"
        />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
            {t.officeScope.inheritedScope}
          </h3>
          <p className="mt-1 text-xs leading-5 text-[var(--color-text-muted)]">
            {t.officeScope.inheritedHint}
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <Skeleton className="h-12 rounded-[var(--radius-sm)]" />
          <Skeleton className="h-12 rounded-[var(--radius-sm)]" />
        </div>
      ) : error ? (
        <p className="mt-3 text-xs text-[var(--color-error-text)]">{error}</p>
      ) : !userId || !data || data.grants.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--color-text-muted)]">
          {t.officeScope.accessUnavailable}
        </p>
      ) : (
        <div className="mt-3 grid max-h-48 gap-2 overflow-y-auto sm:grid-cols-2">
          {data.grants.map((grant) => {
            const facility = names.get(grant.facility_id);
            const sourceTypes = Array.from(
              new Set(grant.sources.map((source) => source.type)),
            );
            return (
              <div
                key={grant.facility_id}
                className="rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-white px-3 py-2"
              >
                <p className="truncate text-sm font-semibold text-[var(--color-text-primary)]">
                  {facility?.name ?? grant.facility_id}
                </p>
                <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                  {sourceTypes
                    .map((source) => sourceLabel(source, t.officeScope))
                    .join(" · ")}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function sourceLabel(
  source: FacilityAccessGrantSourceType,
  labels: {
    sourceInherited: string;
    sourceDirect: string;
    sourceLegacy: string;
    sourceSystem: string;
  },
) {
  if (source === "OFFICE_INHERITED") return labels.sourceInherited;
  if (source === "LEGACY_DIRECT") return labels.sourceLegacy;
  if (source === "SYSTEM_GLOBAL") return labels.sourceSystem;
  return labels.sourceDirect;
}
