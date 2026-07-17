"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { gooeyToast } from "goey-toast";
import {
  ActiveStatus,
  WarehouseType,
  type OfficeScopeFacilityOption,
  type Warehouse,
} from "@bduck/shared-types";
import { Skeleton } from "@/components/ui/Skeleton";
import { useOfficeScope } from "@/hooks/useOfficeScope";
import { useOfficeScopeDraft } from "@/hooks/useOfficeScopeDraft";
import { useTranslation } from "@/lib/i18n";
import { useUserStore } from "@/stores/useUserStore";
import type { DetailedApiError } from "@/utils/apiError";
import { OfficeFacilityGroup } from "./OfficeFacilityGroup";
import { OfficeScopeChangeReview } from "./OfficeScopeChangeReview";
import { OfficeScopeCeilingEditor } from "./OfficeScopeCeilingEditor";
import { OfficeScopeSummary } from "./OfficeScopeSummary";

interface OfficeScopeEditorProps {
  officeId: string;
  facilities: Warehouse[];
}

export function OfficeScopeEditor({
  officeId,
  facilities,
}: OfficeScopeEditorProps) {
  const { t } = useTranslation();
  const { scope, isLoading, error, refresh, updateScope, updateCeiling } =
    useOfficeScope(officeId);
  const hasPermission = useUserStore((state) => state.hasPermission);
  const permissions = useUserStore((state) => state.permissions);
  const isSystemAdmin = permissions.global?.["*"] === true;
  const canWrite = hasPermission("office_scopes.write", officeId);
  const [isSaving, setIsSaving] = useState(false);
  const [isReviewOpen, setIsReviewOpen] = useState(false);

  const manageable = useMemo(() => {
    const byId = new Map<string, OfficeScopeFacilityOption>();
    facilities
      .filter((facility) => !facility.is_deleted)
      .forEach(({ id, name, code, type, status }) =>
        byId.set(id, { id, name, code, type, status }),
      );
    scope?.editable_facilities?.forEach((facility) =>
      byId.set(facility.id, facility),
    );
    return Array.from(byId.values()).filter(
      (facility) =>
        facility.status === ActiveStatus.ACTIVE &&
        (facility.type === WarehouseType.MAIN ||
          facility.type === WarehouseType.STORE),
    );
  }, [facilities, scope?.editable_facilities]);
  const manageableIds = useMemo(
    () => manageable.map((facility) => facility.id),
    [manageable],
  );
  const warehouses = manageable.filter(
    (facility) => facility.type === WarehouseType.MAIN,
  );
  const stores = manageable.filter(
    (facility) => facility.type === WarehouseType.STORE,
  );
  const editableIds = useMemo(
    () => new Set(scope?.editable_facility_ids ?? []),
    [scope?.editable_facility_ids],
  );
  const draft = useOfficeScopeDraft(scope, manageableIds);

  useEffect(() => {
    if (draft.isStale || !canWrite) setIsReviewOpen(false);
  }, [canWrite, draft.isStale]);

  const reloadLatest = async () => {
    const latest = await refresh();
    if (latest) draft.resetFromSnapshot(latest);
    setIsReviewOpen(false);
  };

  const save = async () => {
    if (
      !canWrite ||
      isSaving ||
      draft.isStale ||
      !draft.summary.isDirty ||
      draft.expectedRevision < 0
    ) {
      return;
    }
    setIsSaving(true);
    const operation = updateScope({
      scope_mode: draft.mode,
      target_facility_ids: draft.mode === "ALL" ? [] : [...draft.selectedIds],
      expected_revision: draft.expectedRevision,
    });
    try {
      void gooeyToast.promise(operation, {
        loading: t.officeScope.saving,
        success: t.officeScope.saveSuccess,
        error: (saveError: unknown) =>
          saveError instanceof Error
            ? saveError.message
            : t.officeScope.saveError,
        description: {
          success: t.officeScope.saveSuccessDesc,
          error: t.officeScope.saveErrorDesc,
        },
        action: {
          error: { label: t.common.retry, onClick: () => void save() },
        },
      });
      const savedScope = await operation;
      draft.resetFromSnapshot(savedScope);
      setIsReviewOpen(false);
    } catch (saveError) {
      console.error("[OfficeScopeEditor] update error:", saveError);
      if ((saveError as DetailedApiError).statusCode === 409) {
        await reloadLatest();
      }
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <OfficeScopeSkeleton />;
  if (error) {
    return (
      <div className="rounded-[var(--radius-md)] border border-[var(--color-error-border)] bg-[var(--color-error-bg)] p-4 text-sm text-[var(--color-error-text)]">
        {error}
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {draft.isStale && (
        <div className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-amber-200 bg-amber-50 p-4 text-amber-800 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-start gap-2 text-sm">
            <AlertTriangle size={17} className="mt-0.5 shrink-0" />
            {t.officeScope.staleDraft}
          </p>
          <button
            type="button"
            onClick={() => void reloadLatest()}
            className="flex h-9 items-center justify-center gap-2 rounded-full bg-white px-4 text-sm font-semibold shadow-sm"
          >
            <RotateCcw size={15} />
            {t.officeScope.loadLatest}
          </button>
        </div>
      )}

      {isSystemAdmin && scope && (
        <OfficeScopeCeilingEditor
          scope={scope}
          facilities={manageable}
          onSave={updateCeiling}
        />
      )}
      {!isSystemAdmin && scope && (
        <div className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-3 text-sm text-[var(--color-text-secondary)]">
          <span className="font-semibold text-[var(--color-text-primary)]">
            {t.officeScope.ceilingTitle}:{" "}
          </span>
          {scope.ceiling
            ? `${t.officeScope.ceilingModes[scope.ceiling.scope_mode]} · ${scope.editable_facility_ids.length} ${t.officeScope.facilitiesCount}`
            : t.officeScope.ceilingNotConfigured}
        </div>
      )}

      <OfficeScopeSummary
        scope={scope}
        mode={draft.mode}
        facilities={manageable}
        previewIds={draft.summary.afterIds}
        canWrite={canWrite && !draft.isStale}
        isSystemAdmin={isSystemAdmin}
        canUseAll={isSystemAdmin || scope?.ceiling?.scope_mode === "ALL"}
        onModeChange={draft.setMode}
      />

      {manageable.length === 0 ? (
        <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-border-subtle)] bg-white p-6 text-center text-sm text-[var(--color-text-muted)]">
          {t.officeScope.noFacilities}
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          <OfficeFacilityGroup
            title={t.officeScope.warehouses}
            facilities={warehouses}
            selectedIds={draft.selectedIds}
            editableIds={editableIds}
            disabled={
              draft.mode === "ALL" || !canWrite || isSaving || draft.isStale
            }
            onToggle={draft.toggleFacility}
            onSetFacilities={draft.setFacilities}
          />
          <OfficeFacilityGroup
            title={t.officeScope.stores}
            facilities={stores}
            selectedIds={draft.selectedIds}
            editableIds={editableIds}
            disabled={
              draft.mode === "ALL" || !canWrite || isSaving || draft.isStale
            }
            onToggle={draft.toggleFacility}
            onSetFacilities={draft.setFacilities}
          />
        </div>
      )}

      {canWrite && (
        <div className="sticky bottom-3 z-10 flex flex-col gap-2 rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-white/95 p-3 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-[var(--color-text-muted)]">
            {draft.summary.isDirty
              ? t.officeScope.unsavedChanges
                  .replace("{added}", String(draft.summary.addedIds.length))
                  .replace("{removed}", String(draft.summary.removedIds.length))
              : t.officeScope.noUnsavedChanges}
          </p>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <button
              type="button"
              disabled={!draft.summary.isDirty || isSaving || !scope}
              onClick={() => scope && draft.resetFromSnapshot(scope)}
              className="h-10 rounded-full border border-[var(--color-border-subtle)] px-4 text-sm font-semibold text-[var(--color-text-secondary)] disabled:opacity-40"
            >
              {t.officeScope.discardDraft}
            </button>
            <button
              type="button"
              disabled={!draft.summary.isDirty || isSaving || draft.isStale}
              onClick={() => setIsReviewOpen(true)}
              className="h-10 rounded-full bg-[var(--color-brand-primary)] px-5 text-sm font-semibold text-white disabled:opacity-40"
            >
              {t.officeScope.reviewChanges}
            </button>
          </div>
        </div>
      )}

      <OfficeScopeChangeReview
        isOpen={isReviewOpen}
        mode={draft.mode}
        summary={draft.summary}
        facilities={manageable}
        affectedEmployeeCount={scope?.affected_employee_count ?? 0}
        isSaving={isSaving}
        onCancel={() => setIsReviewOpen(false)}
        onConfirm={() => void save()}
      />
    </div>
  );
}

function OfficeScopeSkeleton() {
  return (
    <div className="grid gap-4">
      <Skeleton className="h-64 rounded-[var(--radius-lg)]" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-64 rounded-[var(--radius-lg)]" />
        <Skeleton className="h-64 rounded-[var(--radius-lg)]" />
      </div>
    </div>
  );
}
