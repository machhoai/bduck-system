/**
 * Process Config Service — Admin CRUD + Default Seeding
 *
 * Manages ProcessConfig documents in Firestore.
 * Provides default configs when none exist.
 */

import { z } from "zod";
import type {
  ProcessConfig,
  ProcessEntityType,
  ApprovalLevel,
  StepOption,
} from "@bduck/shared-types";
import * as repo from "../repositories/processConfigRepository.js";
import { roleRepository } from "../repositories/roleRepository.js";

// ─────────────────────────────────────────────
// ZOD SCHEMAS — Input validation (LUẬT THÉP)
// ─────────────────────────────────────────────

const approvalLevelSchema = z.object({
  level: z.number().int().min(0),
  role_id: z.string().min(1),
  label: z.object({
    vi: z.string().min(1),
    zh: z.string().min(1),
  }),
  required: z.boolean(),
  enabled: z.boolean(),
  min_approvers: z.number().int().min(1).default(1),
});

const stepOptionSchema = z.object({
  require_evidence: z.boolean(),
  require_barcode_scan: z.boolean(),
  allowed_role_id: z.string().nullable(),
  label: z
    .object({
      vi: z.string().min(1),
      zh: z.string().min(1),
    })
    .nullable(),
});

export const updateConfigSchema = z.object({
  approval_chain: z.array(approvalLevelSchema).optional(),
  step_options: z.record(z.string(), stepOptionSchema).optional(),
});

export type UpdateConfigInput = z.infer<typeof updateConfigSchema>;

// ─────────────────────────────────────────────
// DEFAULT CONFIGS (Hardcoded fallbacks)
// ─────────────────────────────────────────────

/**
 * Default approval chains per entity type.
 * Used when no ProcessConfig exists in Firestore.
 * Admin can override via the Config UI.
 */
const DEFAULT_CHAINS: Partial<
  Record<ProcessEntityType, ApprovalLevel[]>
> = {
  IMPORT_VOUCHER: [
    {
      level: 0,
      role_id: "WAREHOUSE_MANAGER",
      label: { vi: "Quản lý kho duyệt", zh: "仓库经理审批" },
      required: true,
      enabled: true,
      min_approvers: 1,
    },
    {
      level: 1,
      role_id: "DIRECTOR",
      label: { vi: "Ban giám đốc duyệt", zh: "总监审批" },
      required: false,
      enabled: false,
      min_approvers: 1,
    },
  ],
  EXPORT_VOUCHER: [
    {
      level: 0,
      role_id: "WAREHOUSE_MANAGER",
      label: { vi: "Quản lý kho duyệt", zh: "仓库经理审批" },
      required: true,
      enabled: true,
      min_approvers: 1,
    },
    {
      level: 1,
      role_id: "DIRECTOR",
      label: { vi: "Ban giám đốc duyệt", zh: "总监审批" },
      required: false,
      enabled: false,
      min_approvers: 1,
    },
  ],
};

const DEFAULT_STEP_OPTIONS: Record<string, StepOption> = {
  receiving: {
    require_evidence: false,
    require_barcode_scan: false,
    allowed_role_id: null,
    label: null,
  },
};

// ─────────────────────────────────────────────
// SERVICE
// ─────────────────────────────────────────────

/** List all configs (admin view) */
export async function getAllConfigs(): Promise<ProcessConfig[]> {
  return repo.findAll();
}

/**
 * Get config for an entity type + warehouse.
 * Falls back to global, then hardcoded defaults.
 */
export async function getConfigForEntity(
  entityType: ProcessEntityType,
  warehouseId?: string | null,
): Promise<ProcessConfig> {
  const config = await repo.findByEntityType(entityType, warehouseId);

  if (config) return config;

  // Return hardcoded default (not persisted until admin saves)
  return {
    id: `default_${entityType}`,
    entity_type: entityType,
    warehouse_id: null,
    approval_chain: DEFAULT_CHAINS[entityType] ?? [],
    step_options: DEFAULT_STEP_OPTIONS,
    is_deleted: false,
    created_at: new Date(),
    updated_at: new Date(),
  };
}

/**
 * Update an existing config.
 * If the config is a default (not yet persisted), creates it first.
 */
export async function updateConfig(
  id: string,
  input: UpdateConfigInput,
): Promise<ProcessConfig> {
  const existing = await repo.findById(id);
  const now = new Date();

  if (!existing) {
    // Config doesn't exist yet — might be a default that needs persisting
    // Reject: caller must create first via seedConfig
    const err = new Error("Config not found") as Error & {
      statusCode: number;
      messages: Record<string, string>;
    };
    err.statusCode = 404;
    err.messages = {
      vi: "Không tìm thấy cấu hình quy trình.",
      zh: "未找到流程配置。",
    };
    throw err;
  }

  const updateData: Partial<
    Pick<ProcessConfig, "approval_chain" | "step_options" | "updated_at">
  > = { updated_at: now };

  if (input.approval_chain) {
    updateData.approval_chain = input.approval_chain;
  }
  if (input.step_options) {
    updateData.step_options = input.step_options;
  }

  await repo.update(id, updateData);

  return { ...existing, ...updateData };
}

/**
 * Seed a default config for an entity type if none exists.
 * IMPORTANT: Looks up actual role Firestore doc IDs by name.
 * Called during app bootstrap or when admin first visits config page.
 */
export async function seedConfigIfMissing(
  entityType: ProcessEntityType,
): Promise<ProcessConfig> {
  const existing = await repo.findByEntityType(entityType);

  if (existing) return existing;

  // Resolve hardcoded role names → actual Firestore doc IDs
  const defaultChain = DEFAULT_CHAINS[entityType] ?? [];
  const resolvedChain: ApprovalLevel[] = [];

  for (const level of defaultChain) {
    const role = await roleRepository.findByName(level.role_id);
    if (role) {
      resolvedChain.push({
        ...level,
        role_id: role.id, // Use actual Firestore doc ID
      });
      console.log(
        `[seedConfig] Resolved role "${level.role_id}" → "${role.id}" (${role.name})`,
      );
    } else {
      console.warn(
        `[seedConfig] Role "${level.role_id}" not found in DB — skipping level ${level.level}`,
      );
    }
  }

  const now = new Date();
  return repo.create({
    entity_type: entityType,
    warehouse_id: null,
    approval_chain: resolvedChain,
    step_options: DEFAULT_STEP_OPTIONS,
    is_deleted: false,
    created_at: now,
    updated_at: now,
  });
}

/**
 * Force re-seed: soft-delete existing config, create fresh one
 * with resolved role IDs. Fixes bad configs with hardcoded role names.
 */
export async function reseedConfig(
  entityType: ProcessEntityType,
): Promise<ProcessConfig> {
  const existing = await repo.findByEntityType(entityType);

  if (existing) {
    // Soft-delete old config
    await repo.update(existing.id, {
      approval_chain: existing.approval_chain,
      updated_at: new Date(),
    });
    // Mark as deleted via direct Firestore update
    const { db } = await import("../config/firebase.js");
    await db.collection("process_configs").doc(existing.id).update({
      is_deleted: true,
      updated_at: new Date(),
    });
    console.log(
      `[reseedConfig] Soft-deleted old config ${existing.id} for ${entityType}`,
    );
  }

  // Resolve hardcoded role names → actual Firestore doc IDs
  const defaultChain = DEFAULT_CHAINS[entityType] ?? [];
  const resolvedChain: ApprovalLevel[] = [];

  for (const level of defaultChain) {
    const role = await roleRepository.findByName(level.role_id);
    if (role) {
      resolvedChain.push({
        ...level,
        role_id: role.id,
      });
      console.log(
        `[reseedConfig] Resolved role "${level.role_id}" → "${role.id}" (${role.name})`,
      );
    } else {
      console.warn(
        `[reseedConfig] Role "${level.role_id}" not found — skipping level ${level.level}`,
      );
    }
  }

  const now = new Date();
  const newConfig = await repo.create({
    entity_type: entityType,
    warehouse_id: null,
    approval_chain: resolvedChain,
    step_options: DEFAULT_STEP_OPTIONS,
    is_deleted: false,
    created_at: now,
    updated_at: now,
  });

  console.log(
    `[reseedConfig] Created new config ${newConfig.id} for ${entityType} with ${resolvedChain.length} levels`,
  );
  return newConfig;
}
