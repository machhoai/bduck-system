import { randomUUID } from "crypto";

import type {
  ApprovalRecord,
  ProcessConfig,
  ProcessEntityType,
} from "@bduck/shared-types";

import * as approvalRepository from "../repositories/approvalRepository.js";

import { assertApprovalChainEligibility } from "./approvalEligibilityService.js";
import {
  getActiveApprovalChainForEntity,
  getActiveApprovalChainFromConfig,
  getConfigForEntity,
} from "./processConfigService.js";
import { resolveStepWarehouseId } from "./scopedRoleAccess.js";

interface ApprovalScopeInfo {
  sourceWarehouseId?: string | null;
  destinationWarehouseId?: string | null;
}

interface ApprovalPreparationOptions {
  minLevel?: number;
  maxLevel?: number;
  configEntityType?: ProcessEntityType;
  config?: ProcessConfig;
}

export interface PrepareApprovalsInput {
  entityType: ProcessEntityType;
  entityId: string;
  warehouseId: string;
  creatorId: string;
  displayInfo?: { voucher_number?: string; creator_name?: string };
  scopeInfo?: ApprovalScopeInfo;
  options?: ApprovalPreparationOptions;
}

export type PreparedApprovalPlan =
  | {
      mode: "AUTO_APPROVED";
      records: [];
      entityType: ProcessEntityType;
      entityId: string;
      warehouseId: string;
      configEntityType: ProcessEntityType;
      configId: string;
    }
  | {
      mode: "NO_APPROVAL";
      records: [];
      entityType: ProcessEntityType;
      entityId: string;
      warehouseId: string;
      configEntityType: ProcessEntityType;
      configId: string;
    }
  | {
      mode: "RECORDS";
      records: ApprovalRecord[];
      entityType: ProcessEntityType;
      entityId: string;
      warehouseId: string;
      configEntityType: ProcessEntityType;
      configId: string;
    };

export async function prepareApprovalsForEntity(
  input: PrepareApprovalsInput,
): Promise<PreparedApprovalPlan> {
  const configEntityType =
    input.options?.configEntityType ?? input.entityType;
  const config =
    input.options?.config ??
    (await getConfigForEntity(configEntityType, input.warehouseId));
  const base = {
    entityType: input.entityType,
    entityId: input.entityId,
    warehouseId: input.warehouseId,
    configEntityType,
    configId: config.id,
  };

  if (config.auto_approve === true) {
    return { ...base, mode: "AUTO_APPROVED", records: [] };
  }

  const configuredChain = input.options?.config
    ? getActiveApprovalChainFromConfig(config)
    : await getActiveApprovalChainForEntity(
        configEntityType,
        input.warehouseId,
      );
  const chain = configuredChain.filter((level) => {
    if (
      typeof input.options?.minLevel === "number" &&
      level.level < input.options.minLevel
    ) {
      return false;
    }
    if (
      typeof input.options?.maxLevel === "number" &&
      level.level > input.options.maxLevel
    ) {
      return false;
    }
    return true;
  });

  if (chain.length === 0) {
    return { ...base, mode: "NO_APPROVAL", records: [] };
  }

  await assertApprovalChainEligibility({
    chain,
    warehouseId: input.warehouseId,
    creatorId: input.creatorId,
    scopeInfo: input.scopeInfo,
  });

  const existingRecords = await approvalRepository.findByEntity(
    input.entityType,
    input.entityId,
  );
  const approvalAttempt =
    existingRecords.reduce(
      (max, record) => Math.max(max, record.approval_attempt ?? 1),
      0,
    ) + 1;
  const now = new Date();
  const records = chain.flatMap((level) => {
    const approvalScope = level.approval_scope ?? "ENTITY_WAREHOUSE";
    const approvalWarehouseId = resolveStepWarehouseId(
      approvalScope,
      input.warehouseId,
      input.scopeInfo?.sourceWarehouseId,
      input.scopeInfo?.destinationWarehouseId,
    );
    const count = Math.max(level.min_approvers || 1, 1);
    return Array.from({ length: count }, (): ApprovalRecord => ({
      id: randomUUID(),
      entity_type: input.entityType,
      config_entity_type: configEntityType,
      entity_id: input.entityId,
      warehouse_id: input.warehouseId,
      approval_warehouse_id: approvalWarehouseId,
      approval_scope: approvalScope,
      allow_global_fallback: level.allow_global_fallback === true,
      level: level.level,
      approval_attempt: approvalAttempt,
      role_id: level.role_id,
      status: "PENDING",
      approver_id: null,
      approved_at: null,
      rejected_reason: null,
      comments: null,
      creator_id: input.creatorId,
      action_time: now,
      sync_time: now,
      created_at: now,
      voucher_number: input.displayInfo?.voucher_number,
      creator_name: input.displayInfo?.creator_name,
    }));
  });

  return { ...base, mode: "RECORDS", records };
}
