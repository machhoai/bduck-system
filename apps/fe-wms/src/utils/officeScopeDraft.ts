import type { OfficeScopeMode } from "@bduck/shared-types";

interface OfficeScopeDraftSummaryInput {
  baselineMode: OfficeScopeMode;
  baselineSelectedIds: readonly string[];
  baselineEffectiveIds: readonly string[];
  mode: OfficeScopeMode;
  selectedIds: readonly string[];
  manageableIds: readonly string[];
}

const normalized = (ids: readonly string[]) =>
  [...new Set(ids.filter(Boolean))].sort();

const equalIds = (left: readonly string[], right: readonly string[]) => {
  const normalizedLeft = normalized(left);
  const normalizedRight = normalized(right);
  return (
    normalizedLeft.length === normalizedRight.length &&
    normalizedLeft.every((id, index) => id === normalizedRight[index])
  );
};

export function buildOfficeScopeDraftSummary({
  baselineMode,
  baselineSelectedIds,
  baselineEffectiveIds,
  mode,
  selectedIds,
  manageableIds,
}: OfficeScopeDraftSummaryInput) {
  const beforeIds = normalized(baselineEffectiveIds);
  const afterIds = normalized(mode === "ALL" ? manageableIds : selectedIds);
  const beforeSet = new Set(beforeIds);
  const afterSet = new Set(afterIds);
  const baselineTargets =
    baselineMode === "ALL" ? [] : normalized(baselineSelectedIds);
  const nextTargets = mode === "ALL" ? [] : normalized(selectedIds);

  return {
    beforeIds,
    afterIds,
    addedIds: afterIds.filter((id) => !beforeSet.has(id)),
    removedIds: beforeIds.filter((id) => !afterSet.has(id)),
    isDirty:
      baselineMode !== mode || !equalIds(baselineTargets, nextTargets),
  };
}

export type OfficeScopeDraftSummary = ReturnType<
  typeof buildOfficeScopeDraftSummary
>;
