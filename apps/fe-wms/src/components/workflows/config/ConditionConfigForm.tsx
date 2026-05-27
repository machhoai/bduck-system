/**
 * ConditionConfigForm — Config sub-form for CONDITION nodes.
 *
 * Fields:
 *   - field (dropdown — common entity fields)
 *   - operator (enum select: EQ | NEQ | GT | GTE | LT | LTE | CONTAINS | NOT_CONTAINS)
 *   - value (text input — compared against the field value at runtime)
 *
 * Sync strategy: dropdown → immediate Zustand update, text → on-blur.
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

/** Common entity data fields available in entityPayload */
const FIELD_OPTIONS: { value: string; label: string }[] = [
  { value: "has_discrepancy", label: "Có chênh lệch (has_discrepancy)" },
  { value: "total_actual", label: "Tổng thực nhận (total_actual)" },
  { value: "total_expected", label: "Tổng dự kiến (total_expected)" },
  { value: "items_count", label: "Số lượng sản phẩm (items_count)" },
  { value: "receiving_completed", label: "Đã kiểm đếm (receiving_completed)" },
  { value: "approved", label: "Đã duyệt (approved)" },
  { value: "status", label: "Trạng thái (status)" },
  { value: "voucher_id", label: "Mã phiếu (voucher_id)" },
  { value: "entity_type", label: "Loại đối tượng (entity_type)" },
];

export function ConditionConfigForm({
  nodeId,
  config,
}: ConditionConfigFormProps) {
  const { t } = useTranslation();
  const updateNodeConfig = useWorkflowCanvasStore(
    (s) => s.updateNodeConfig,
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
      {/* Target Field — dropdown */}
      <ConfigField
        label={t.workflows.config.field}
        hint="Trường dữ liệu từ entityPayload"
      >
        <ConfigSelect
          value={(config.field as string) || ""}
          onChange={(val) => syncField("field", val)}
          options={FIELD_OPTIONS}
          placeholder="Chọn trường dữ liệu..."
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
        hint="Số hoặc chuỗi so sánh (VD: true, 100)"
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
            // Also handle "true"/"false" as booleans
            let finalValue: unknown = localValue;
            if (localValue === "true") finalValue = true;
            else if (localValue === "false") finalValue = false;
            else if (numericOps.includes(op) && !Number.isNaN(parsed))
              finalValue = parsed;
            syncField("value", finalValue);
          }}
          placeholder="true"
        />
      </ConfigField>
    </div>
  );
}
