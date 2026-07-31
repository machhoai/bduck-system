import type { ApprovalLevel } from "@bduck/shared-types";

export interface ApprovalEligibilityResult {
  level: ApprovalLevel;
  eligibleUserIds: string[];
  requiredApprovers: number;
}

export function getDistinctNonCreatorApprovers(
  userIds: readonly string[],
  creatorId: string,
): string[] {
  return Array.from(
    new Set(userIds.filter((userId) => userId && userId !== creatorId)),
  );
}

export function hasEnoughEligibleApprovers(
  result: ApprovalEligibilityResult,
): boolean {
  return result.eligibleUserIds.length >= result.requiredApprovers;
}
