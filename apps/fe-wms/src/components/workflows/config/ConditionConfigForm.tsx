/**
 * ConditionConfigForm — Config sub-form for CONDITION nodes.
 *
 * Fields:
 *   - field (text input — dot-notation path, e.g. "total_amount")
 *   - operator (enum select: EQ | NEQ | GT | GTE | LT | LTE | CONTAINS | NOT_CONTAINS)
 *   - value (text input — compared against the field value at runtime)
 *
 * Sync strategy: on-blur for text inputs → immediate Zustand update.
 */
"use client";

import { useCallback, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { useWorkflowCanvasStore } from "@/stores/useWorkflowCanvasStore";
import { ConditionOperator } from "@bduck/shared-types";
import {
  ConfigField,
  ConfigInput,
  ConfigSelect,
} from "./ConfigFieldComponents";

interface ConditionConfigFormProps {
  nodeId: string;
  config: Record<string, unknown>;
}

/** Human-readable operator labels */
const OPERATOR_LABELS: Record<ConditionOperator, string> = {
  [ConditionOperator.EQ]: "= (Bằng)",
  [ConditionOperator.NEQ]: "≠ (Khác)",
  [ConditionOperator.GT]: "> (Lớn hơn)",
  [ConditionOperator.GTE]: "≥ (Lớn hơn hoặc bằng)",
  [ConditionOperator.LT]: "< (Nhỏ hơn)",
  [ConditionOperator.LTE]: "≤ (Nhỏ hơn hoặc bằng)",
  [ConditionOperator.CONTAINS]: "Chứa",
  [ConditionOperator.NOT_CONTAINS]: "Không chứa",
};

export function ConditionConfigForm({
  nodeId,
  config,
}: ConditionConfigFormProps) {
  const { t } = useTranslation();
  const updateNodeConfig = useWorkflowCanvasStore(
    (s) => s.updateNodeConfig,
  );

  // Local state for text fields (sync on blur to avoid excessive re-renders)
  const [localField, setLocalField] = useState(
    (config.field as string) || "",
  );
  const [localValue, setLocalValue] = useState(
    String(config.value ?? ""),
  );

  const syncField = useCallback(
    (field: string, value: unknown) => {
      updateNodeConfig(nodeId, { [field]: value });
    },
    [nodeId, updateNodeConfig],
  );

  const operatorOptions = Object.values(ConditionOperator).map((op) => ({
    value: op,
    label: OPERATOR_LABELS[op],
  }));

  return (
    <div className="space-y-3">
      {/* Target Field */}
      <ConfigField
        label={t.workflows.config.field}
        hint='VD: "total_amount", "expected_quantity"'
      >
        <ConfigInput
          value={localField}
          onChange={setLocalField}
          onBlur={() => syncField("field", localField)}
          placeholder="total_amount"
        />
      </ConfigField>

      {/* Operator */}
      <ConfigField label={t.workflows.config.operator}>
        <ConfigSelect
          value={(config.operator as string) || ""}
          onChange={(val) => syncField("operator", val)}
          options={operatorOptions}
          placeholder={t.workflows.config.operator}
        />
      </ConfigField>

      {/* Expected Value */}
      <ConfigField
        label={t.workflows.config.value}
        hint="Số hoặc chuỗi so sánh"
      >
        <ConfigInput
          value={localValue}
          onChange={setLocalValue}
          onBlur={() => {
            // Auto-coerce numeric strings to numbers for GT/LT/GTE/LTE
            const numericOps = [
              ConditionOperator.GT,
              ConditionOperator.GTE,
              ConditionOperator.LT,
              ConditionOperator.LTE,
            ];
            const op = config.operator as ConditionOperator;
            const parsed = Number(localValue);
            const finalValue =
              numericOps.includes(op) && !Number.isNaN(parsed)
                ? parsed
                : localValue;
            syncField("value", finalValue);
          }}
          placeholder="100"
        />
      </ConfigField>
    </div>
  );
}
