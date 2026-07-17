"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  OfficeScopeMode,
  OfficeScopeSnapshot,
} from "@bduck/shared-types";
import { buildOfficeScopeDraftSummary } from "@/utils/officeScopeDraft";

interface DraftState {
  baseRevision: number;
  baselineMode: OfficeScopeMode;
  baselineSelectedIds: string[];
  baselineEffectiveIds: string[];
  mode: OfficeScopeMode;
  selectedIds: Set<string>;
  isStale: boolean;
}

const fromSnapshot = (scope: OfficeScopeSnapshot): DraftState => {
  const mode = scope.config?.scope_mode ?? "SELECTED";
  const selectedIds = scope.edges.map((edge) => edge.target_facility_id);
  return {
    baseRevision: scope.config?.revision ?? 0,
    baselineMode: mode,
    baselineSelectedIds: selectedIds,
    baselineEffectiveIds: scope.effective_facility_ids,
    mode,
    selectedIds: new Set(selectedIds),
    isStale: false,
  };
};

const emptyDraft: DraftState = {
  baseRevision: -1,
  baselineMode: "SELECTED",
  baselineSelectedIds: [],
  baselineEffectiveIds: [],
  mode: "SELECTED",
  selectedIds: new Set(),
  isStale: false,
};

const draftIsDirty = (draft: DraftState) =>
  buildOfficeScopeDraftSummary({
    baselineMode: draft.baselineMode,
    baselineSelectedIds: draft.baselineSelectedIds,
    baselineEffectiveIds: draft.baselineEffectiveIds,
    mode: draft.mode,
    selectedIds: [...draft.selectedIds],
    manageableIds: [],
  }).isDirty;

export function useOfficeScopeDraft(
  scope: OfficeScopeSnapshot | null,
  manageableIds: readonly string[],
) {
  const [draft, setDraft] = useState<DraftState>(emptyDraft);

  useEffect(() => {
    if (!scope) return;
    setDraft((current) => {
      if (current.baseRevision < 0 || !draftIsDirty(current)) {
        return fromSnapshot(scope);
      }
      if ((scope.config?.revision ?? 0) !== current.baseRevision) {
        return { ...current, isStale: true };
      }
      return current;
    });
  }, [scope]);

  const summary = useMemo(
    () =>
      buildOfficeScopeDraftSummary({
        baselineMode: draft.baselineMode,
        baselineSelectedIds: draft.baselineSelectedIds,
        baselineEffectiveIds: draft.baselineEffectiveIds,
        mode: draft.mode,
        selectedIds: [...draft.selectedIds],
        manageableIds,
      }),
    [draft, manageableIds],
  );
  const setMode = useCallback((mode: OfficeScopeMode) => {
    setDraft((current) => ({ ...current, mode }));
  }, []);
  const toggleFacility = useCallback((facilityId: string) => {
    setDraft((current) => {
      const selectedIds = new Set(current.selectedIds);
      if (selectedIds.has(facilityId)) selectedIds.delete(facilityId);
      else selectedIds.add(facilityId);
      return { ...current, selectedIds };
    });
  }, []);
  const setFacilities = useCallback(
    (facilityIds: readonly string[], selected: boolean) => {
      setDraft((current) => {
        const selectedIds = new Set(current.selectedIds);
        facilityIds.forEach((facilityId) =>
          selected ? selectedIds.add(facilityId) : selectedIds.delete(facilityId),
        );
        return { ...current, selectedIds };
      });
    },
    [],
  );
  const resetFromSnapshot = useCallback((snapshot: OfficeScopeSnapshot) => {
    setDraft(fromSnapshot(snapshot));
  }, []);

  return {
    mode: draft.mode,
    selectedIds: draft.selectedIds,
    expectedRevision: draft.baseRevision,
    isStale: draft.isStale,
    summary,
    setMode,
    toggleFacility,
    setFacilities,
    resetFromSnapshot,
  };
}
