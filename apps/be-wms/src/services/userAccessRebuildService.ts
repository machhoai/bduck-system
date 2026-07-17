import {
  completeUserAccessRebuild,
  enqueueUserAccessRebuilds,
  failUserAccessRebuild,
  findPendingUserAccessRebuilds,
} from "../repositories/userAccessRebuildRequestRepository.js";
import { materializeUserAccess } from "./userAccessMaterializationService.js";
import {
  findUserIdsByWorkplace,
  findUsers,
} from "../repositories/userRepository.js";
import { UserStatus } from "@bduck/shared-types";

export interface UserAccessRebuildBatchResult {
  requested: number;
  completed: number;
  failed: Array<{ userId: string; error: string }>;
}

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : "USER_ACCESS_REBUILD_FAILED";

export const rebuildUserAccessForUsers = async (
  userIds: readonly string[],
  reason: string,
  requestedBy: string,
  options: { enqueue?: boolean } = {},
): Promise<UserAccessRebuildBatchResult> => {
  const ids = Array.from(new Set(userIds.filter(Boolean))).sort();
  if (options.enqueue !== false) {
    await enqueueUserAccessRebuilds(ids, reason, requestedBy);
  }
  const result: UserAccessRebuildBatchResult = {
    requested: ids.length,
    completed: 0,
    failed: [],
  };
  for (const userId of ids) {
    try {
      const materialized = await materializeUserAccess(userId, requestedBy);
      await completeUserAccessRebuild(userId, materialized.accessVersion);
      result.completed += 1;
    } catch (error) {
      const message = errorMessage(error);
      await failUserAccessRebuild(userId, message);
      result.failed.push({ userId, error: message });
    }
  }
  return result;
};

export const repairPendingUserAccessRebuilds = async (
  requestedBy: string,
  limit = 100,
): Promise<UserAccessRebuildBatchResult> => {
  const pending = await findPendingUserAccessRebuilds(limit);
  return rebuildUserAccessForUsers(
    pending.map((request) => request.user_id),
    "REPAIR_PENDING",
    requestedBy,
  );
};

export const rebuildUserAccessForOffice = async (
  officeId: string,
  requestedBy: string,
): Promise<UserAccessRebuildBatchResult> =>
  rebuildUserAccessForUsers(
    await findUserIdsByWorkplace(officeId),
    "OFFICE_SCOPE_CHANGED",
    requestedBy,
  );

export const rebuildAllActiveUserAccess = async (
  reason: string,
  requestedBy: string,
): Promise<UserAccessRebuildBatchResult> =>
  rebuildUserAccessForUsers(
    (await findUsers())
      .filter((user) => user.status === UserStatus.ACTIVE)
      .map((user) => user.id),
    reason,
    requestedBy,
  );
