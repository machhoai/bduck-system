"use client";

import { ShieldCheck } from "lucide-react";
import {
  WarehouseType,
  type FacilityAccessGrantSourceType,
  type Role,
  type Warehouse,
} from "@bduck/shared-types";
import { Skeleton } from "@/components/ui/Skeleton";
import { useOfficeScope } from "@/hooks/useOfficeScope";
import { useUserEffectiveAccess } from "@/hooks/useUserEffectiveAccess";
import { useTranslation } from "@/lib/i18n";
import { buildEffectiveAccessPreview } from "@/utils/effectiveAccessPreview";
import type { AssignmentDraft } from "./UserAssignmentEditor";

interface EffectiveAccessDraft {
  workplaceFacilityId: string;
  assignments: readonly AssignmentDraft[];
  roles: readonly Role[];
}

interface EffectiveAccessPreviewProps {
  userId?: string | null;
  facilities: Warehouse[];
  draft?: EffectiveAccessDraft;
}

export function EffectiveAccessPreview({
  userId,
  facilities,
  draft,
}: EffectiveAccessPreviewProps) {
  const { t } = useTranslation();
  const workplace = draft
    ? facilities.find((facility) => facility.id === draft.workplaceFacilityId)
    : null;
  const officeId =
    workplace?.type === WarehouseType.OFFICE &&
    draft?.assignments.some(
      (assignment) =>
        assignment.warehouse_id === workplace.id &&
        assignment.role_id &&
        assignment.is_active &&
        assignment.scope_origin !== "LEGACY_DIRECT",
    )
      ? workplace.id
      : null;
  const {
    scope: officeScope,
    isLoading: isOfficeScopeLoading,
    error: officeScopeError,
  } = useOfficeScope(officeId);
  const {
    data,
    isLoading: isPersistedAccessLoading,
    error: persistedAccessError,
  } = useUserEffectiveAccess(draft ? null : userId);
  const names = new Map(facilities.map((facility) => [facility.id, facility]));
  const draftGrants = draft
    ? buildEffectiveAccessPreview({
        workplaceFacilityId: draft.workplaceFacilityId,
        assignments: draft.assignments,
        roles: draft.roles,
        facilities,
        inheritedFacilityIds: officeScope?.effective_facility_ids ?? [],
      })
    : [];
  const grants = draft
    ? draftGrants
    : (data?.grants.map((grant) => ({
        facilityId: grant.facility_id,
        sourceTypes: Array.from(
          new Set(grant.sources.map((source) => source.type)),
        ),
      })) ?? []);
  const isLoading = !draft && isPersistedAccessLoading;
  const error = draft ? officeScopeError : persistedAccessError;

  return (
    <section className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-4">
      <div className="flex items-start gap-3">
        <ShieldCheck
          size={18}
          className="mt-0.5 shrink-0 text-[var(--color-brand-primary)]"
        />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
            {draft ? t.officeScope.preview : t.officeScope.inheritedScope}
          </h3>
          <p className="mt-1 text-xs leading-5 text-[var(--color-text-muted)]">
            {draft
              ? t.officeScope.draftPreviewHint
              : t.officeScope.inheritedHint}
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <Skeleton className="h-12 rounded-[var(--radius-sm)]" />
          <Skeleton className="h-12 rounded-[var(--radius-sm)]" />
        </div>
      ) : !draft && error ? (
        <p className="mt-3 text-xs text-[var(--color-error-text)]">{error}</p>
      ) : grants.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--color-text-muted)]">
          {draft
            ? t.officeScope.draftAccessUnavailable
            : t.officeScope.accessUnavailable}
        </p>
      ) : (
        <div className="mt-3 grid max-h-48 gap-2 overflow-y-auto sm:grid-cols-2">
          {grants.map((grant) => {
            const facility = names.get(grant.facilityId);
            return (
              <div
                key={grant.facilityId}
                className="rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-white px-3 py-2"
              >
                <p className="truncate text-sm font-semibold text-[var(--color-text-primary)]">
                  {facility?.name ?? grant.facilityId}
                </p>
                <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                  {grant.sourceTypes
                    .map((source) => sourceLabel(source, t.officeScope))
                    .join(" · ")}
                </p>
              </div>
            );
          })}
        </div>
      )}
      {draft && officeId && isOfficeScopeLoading && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <Skeleton className="h-12 rounded-[var(--radius-sm)]" />
          <Skeleton className="h-12 rounded-[var(--radius-sm)]" />
        </div>
      )}
      {draft && !isOfficeScopeLoading && error && (
        <p className="mt-3 text-xs text-[var(--color-error-text)]">{error}</p>
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
