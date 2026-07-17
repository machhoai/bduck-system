"use client";

import { useEffect, useMemo, useState } from "react";
import { ShieldAlert } from "lucide-react";
import { gooeyToast } from "goey-toast";
import {
  WarehouseType,
  type OfficeScopeCeilingUpdateRequest,
  type OfficeScopeFacilityOption,
  type OfficeScopeMode,
  type OfficeScopeSnapshot,
} from "@bduck/shared-types";
import { useTranslation } from "@/lib/i18n";
import { OfficeFacilityGroup } from "./OfficeFacilityGroup";

export function OfficeScopeCeilingEditor({
  scope,
  facilities,
  onSave,
}: {
  scope: OfficeScopeSnapshot;
  facilities: OfficeScopeFacilityOption[];
  onSave: (
    payload: OfficeScopeCeilingUpdateRequest,
  ) => Promise<OfficeScopeSnapshot>;
}) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<OfficeScopeMode>(
    scope.ceiling?.scope_mode ?? "SELECTED",
  );
  const [selectedIds, setSelectedIds] = useState(
    new Set(scope.ceiling?.target_facility_ids ?? []),
  );
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setMode(scope.ceiling?.scope_mode ?? "SELECTED");
    setSelectedIds(new Set(scope.ceiling?.target_facility_ids ?? []));
  }, [scope.ceiling]);

  const baselineIds = useMemo(
    () => [...(scope.ceiling?.target_facility_ids ?? [])].sort(),
    [scope.ceiling?.target_facility_ids],
  );
  const nextIds = [...selectedIds].sort();
  const isDirty =
    mode !== (scope.ceiling?.scope_mode ?? "SELECTED") ||
    baselineIds.join("|") !== (mode === "ALL" ? "" : nextIds.join("|"));
  const editableIds = new Set(facilities.map((facility) => facility.id));
  const warehouses = facilities.filter(
    (facility) => facility.type === WarehouseType.MAIN,
  );
  const stores = facilities.filter(
    (facility) => facility.type === WarehouseType.STORE,
  );
  const toggle = (facilityId: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(facilityId)) next.delete(facilityId);
      else next.add(facilityId);
      return next;
    });
  };
  const setMany = (facilityIds: readonly string[], selected: boolean) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      facilityIds.forEach((id) => (selected ? next.add(id) : next.delete(id)));
      return next;
    });
  };
  const save = async () => {
    if (!isDirty || isSaving) return;
    setIsSaving(true);
    const operation = onSave({
      scope_mode: mode,
      target_facility_ids: mode === "ALL" ? [] : nextIds,
      expected_revision: scope.ceiling?.revision ?? 0,
    });
    try {
      void gooeyToast.promise(operation, {
        loading: t.officeScope.savingCeiling,
        success: t.officeScope.saveCeilingSuccess,
        error: t.officeScope.saveCeilingError,
        description: {
          success: t.officeScope.saveCeilingSuccessDesc,
          error: t.officeScope.saveCeilingErrorDesc,
        },
        action: {
          error: { label: t.common.retry, onClick: () => void save() },
        },
      });
      await operation;
    } catch (error) {
      console.error("[OfficeScopeCeilingEditor] save error:", error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <details className="rounded-[var(--radius-lg)] border border-amber-200 bg-amber-50/60">
      <summary className="flex cursor-pointer list-none items-center gap-3 p-4 sm:p-5">
        <ShieldAlert size={19} className="text-amber-700" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-amber-900">
            {t.officeScope.ceilingTitle}
          </span>
          <span className="mt-1 block text-xs text-amber-800">
            {t.officeScope.ceilingDescription}
          </span>
        </span>
        <span className="rounded-full bg-white px-2.5 py-1 text-xs text-amber-800">
          {t.officeScope.revision}: {scope.ceiling?.revision ?? 0}
        </span>
      </summary>
      <div className="grid gap-4 border-t border-amber-200 p-4 sm:p-5">
        <div className="grid gap-2 sm:grid-cols-2">
          {(["ALL", "SELECTED"] as const).map((value) => (
            <label
              key={value}
              className="flex cursor-pointer items-start gap-2 rounded-[var(--radius-md)] border border-amber-200 bg-white p-3 text-sm"
            >
              <input
                type="radio"
                checked={mode === value}
                disabled={isSaving}
                onChange={() => setMode(value)}
              />
              <span>{t.officeScope.ceilingModes[value]}</span>
            </label>
          ))}
        </div>
        {mode === "SELECTED" && (
          <div className="grid gap-4 xl:grid-cols-2">
            <OfficeFacilityGroup
              title={t.officeScope.warehouses}
              facilities={warehouses}
              selectedIds={selectedIds}
              editableIds={editableIds}
              disabled={isSaving}
              onToggle={toggle}
              onSetFacilities={setMany}
            />
            <OfficeFacilityGroup
              title={t.officeScope.stores}
              facilities={stores}
              selectedIds={selectedIds}
              editableIds={editableIds}
              disabled={isSaving}
              onToggle={toggle}
              onSetFacilities={setMany}
            />
          </div>
        )}
        <button
          type="button"
          disabled={!isDirty || isSaving}
          onClick={() => void save()}
          className="h-10 rounded-full bg-amber-700 px-5 text-sm font-semibold text-white disabled:opacity-40 sm:ml-auto"
        >
          {t.officeScope.saveCeiling}
        </button>
      </div>
    </details>
  );
}
