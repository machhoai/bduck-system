import type { ApprovalLevel } from "@bduck/shared-types";

import { notificationRepository } from "../repositories/notificationRepository.js";
import { roleRepository } from "../repositories/roleRepository.js";
import * as userRepository from "../repositories/userRepository.js";
import { warehouseRepository } from "../repositories/warehouseRepository.js";

import {
  getDistinctNonCreatorApprovers,
  hasEnoughEligibleApprovers,
  type ApprovalEligibilityResult,
} from "./approvalEligibilityPolicy.js";
import { resolveStepWarehouseId } from "./scopedRoleAccess.js";

interface ApprovalScopeInfo {
  sourceWarehouseId?: string | null;
  destinationWarehouseId?: string | null;
}

export interface AssertApprovalEligibilityInput {
  chain: ApprovalLevel[];
  warehouseId: string;
  creatorId: string;
  scopeInfo?: ApprovalScopeInfo;
}

async function findEligibleUserIds(
  level: ApprovalLevel,
  warehouseId: string,
  creatorId: string,
  scopeInfo?: ApprovalScopeInfo,
): Promise<{
  eligibleUserIds: string[];
  approvalWarehouseId: string | null;
}> {
  const approvalScope = level.approval_scope ?? "ENTITY_WAREHOUSE";
  const approvalWarehouseId = resolveStepWarehouseId(
    approvalScope,
    warehouseId,
    scopeInfo?.sourceWarehouseId,
    scopeInfo?.destinationWarehouseId,
  );
  const assignedUserIds =
    await notificationRepository.findActiveUserIdsByRoleIds(
      [level.role_id],
      approvalWarehouseId,
      {
        allowGlobalFallback: level.allow_global_fallback === true,
        requireGlobal: approvalScope === "GLOBAL",
      },
    );
  const activeUsers = await userRepository.getUsersByIds(assignedUserIds);
  return {
    eligibleUserIds: getDistinctNonCreatorApprovers(
      activeUsers.map((user) => user.id),
      creatorId,
    ),
    approvalWarehouseId,
  };
}

async function createEligibilityError(
  result: ApprovalEligibilityResult,
  approvalWarehouseId: string | null,
): Promise<Error & { statusCode: number; messages: Record<string, string> }> {
  const [role, warehouse] = await Promise.all([
    roleRepository.findById(result.level.role_id),
    approvalWarehouseId
      ? warehouseRepository.findById(approvalWarehouseId)
      : Promise.resolve(null),
  ]);
  const roleName = role?.name || result.level.label.vi || result.level.role_id;
  const warehouseName = warehouse?.name || approvalWarehouseId;
  const isGlobal = result.level.approval_scope === "GLOBAL";
  const vi =
    result.requiredApprovers === 1
      ? isGlobal
        ? `Không có ${roleName} hợp lệ được gán role toàn hệ thống để duyệt.`
        : `Không có ${roleName} hợp lệ để duyệt tại kho ${warehouseName}.`
      : isGlobal
        ? `Không có đủ ${roleName} hợp lệ được gán role toàn hệ thống để duyệt. Cần ${result.requiredApprovers}, hiện có ${result.eligibleUserIds.length}.`
        : `Không có đủ ${roleName} hợp lệ để duyệt tại kho ${warehouseName}. Cần ${result.requiredApprovers}, hiện có ${result.eligibleUserIds.length}.`;
  const zh = isGlobal
    ? `全局范围内没有足够的有效 ${roleName} 审批人。需要 ${result.requiredApprovers} 人，目前有 ${result.eligibleUserIds.length} 人。`
    : `仓库 ${warehouseName} 没有足够的有效 ${roleName} 审批人。需要 ${result.requiredApprovers} 人，目前有 ${result.eligibleUserIds.length} 人。`;
  const error = new Error(vi) as Error & {
    statusCode: number;
    messages: Record<string, string>;
  };
  error.statusCode = 422;
  error.messages = { vi, zh };
  return error;
}

export async function assertApprovalChainEligibility(
  input: AssertApprovalEligibilityInput,
): Promise<void> {
  for (const level of input.chain) {
    const eligibility = await findEligibleUserIds(
      level,
      input.warehouseId,
      input.creatorId,
      input.scopeInfo,
    );
    const result: ApprovalEligibilityResult = {
      level,
      eligibleUserIds: eligibility.eligibleUserIds,
      requiredApprovers: Math.max(level.min_approvers || 1, 1),
    };
    if (!hasEnoughEligibleApprovers(result)) {
      throw await createEligibilityError(
        result,
        eligibility.approvalWarehouseId,
      );
    }
  }
}
