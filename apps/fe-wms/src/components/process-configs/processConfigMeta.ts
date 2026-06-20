import {
  ClipboardCheck,
  ClipboardList,
  Gift,
  MoveHorizontal,
  Package,
  PackageCheck,
  PackagePlus,
  RotateCcw,
  type LucideIcon,
} from "lucide-react";
import type {
  ProcessConfig,
  ProcessEntityType,
  StepOption,
} from "@bduck/shared-types";
import {
  PROCESS_CONFIG_ENTITY_TEXT,
  PROCESS_CONFIG_STEP_TEXT,
  PROCESS_CONFIG_TEXT,
} from "@/lib/i18n/componentTranslations";

export type Locale = "vi" | "zh";

export type EntityMeta = {
  icon: LucideIcon;
  label: Record<Locale, string>;
  description: Record<Locale, string>;
};

export type EntityStepMeta = {
  key: string;
  label: Record<Locale, string>;
  description: Record<Locale, string>;
};

export const ENTITY_ORDER: ProcessEntityType[] = [
  "IMPORT_VOUCHER",
  "EXPORT_VOUCHER",
  "TRANSFER_ORDER",
  "TRANSFER_INTRA",
  "PURCHASE_ORDER",
  "ADJUSTMENT_VOUCHER",
  "GIFT_SESSION",
];

export const ENTITY_META: Record<ProcessEntityType, EntityMeta> = {
  IMPORT_VOUCHER: {
    icon: PackagePlus,
    ...PROCESS_CONFIG_ENTITY_TEXT.IMPORT_VOUCHER,
  },
  EXPORT_VOUCHER: {
    icon: PackageCheck,
    ...PROCESS_CONFIG_ENTITY_TEXT.EXPORT_VOUCHER,
  },
  TRANSFER_ORDER: {
    icon: RotateCcw,
    ...PROCESS_CONFIG_ENTITY_TEXT.TRANSFER_ORDER,
  },
  PURCHASE_ORDER: {
    icon: ClipboardList,
    ...PROCESS_CONFIG_ENTITY_TEXT.PURCHASE_ORDER,
  },
  ADJUSTMENT_VOUCHER: {
    icon: ClipboardCheck,
    ...PROCESS_CONFIG_ENTITY_TEXT.ADJUSTMENT_VOUCHER,
  },
  GIFT_SESSION: {
    icon: Gift,
    ...PROCESS_CONFIG_ENTITY_TEXT.GIFT_SESSION,
  },
  TRANSFER_INTRA: {
    icon: MoveHorizontal,
    ...PROCESS_CONFIG_ENTITY_TEXT.TRANSFER_INTRA,
  },
};

export const ENTITY_STEPS: Partial<
  Record<ProcessEntityType, EntityStepMeta[]>
> = PROCESS_CONFIG_STEP_TEXT;

export const DEFAULT_STEP_OPTION: StepOption = {
  assignment_mode: "CREATOR",
  assigned_role_id: null,
  label: null,
  assignment_scope: "ENTITY_WAREHOUSE",
  allow_global_fallback: false,
};

export const TEXT = PROCESS_CONFIG_TEXT;

export function getConfigSummary(config?: ProcessConfig) {
  if (!config) {
    return { activeLevels: 0, requiredLevels: 0, optionalEnabled: 0 };
  }

  const activeLevels = config.approval_chain.filter(
    (level) => level.required || level.enabled,
  ).length;
  const requiredLevels = config.approval_chain.filter(
    (level) => level.required,
  ).length;

  return {
    activeLevels,
    requiredLevels,
    optionalEnabled: activeLevels - requiredLevels,
  };
}

export function getEntitySteps(entityType: ProcessEntityType) {
  return ENTITY_STEPS[entityType] ?? [];
}

export function getEntityMeta(entityType: ProcessEntityType) {
  return (
    ENTITY_META[entityType] ?? {
      icon: Package,
      label: { vi: entityType, zh: entityType },
      description: { vi: entityType, zh: entityType },
    }
  );
}
