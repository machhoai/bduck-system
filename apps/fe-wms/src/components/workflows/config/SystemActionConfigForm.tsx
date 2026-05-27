/**
 * SystemActionConfigForm — Config sub-form for SYSTEM_ACTION nodes.
 * Field: action_type (select from known system actions)
 */
"use client";

import { useCallback, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { useWorkflowCanvasStore } from "@/stores/useWorkflowCanvasStore";
import {
  ConfigField,
  ConfigInput,
  ConfigSelect,
} from "./ConfigFieldComponents";

interface SystemActionConfigFormProps {
  nodeId: string;
  config: Record<string, unknown>;
}

const SYSTEM_ACTIONS = [
  { value: "UPDATE_INVENTORY", label: "Cập nhật tồn kho" },
  { value: "AUTO_APPROVE", label: "Tự động duyệt" },
  { value: "CHANGE_STATUS", label: "Đổi trạng thái" },
  { value: "CREATE_NONCONFORMITY_REPORT", label: "Tạo biên bản sai lệch" },
];

export function SystemActionConfigForm({
  nodeId,
  config,
}: SystemActionConfigFormProps) {
  const { t } = useTranslation();
  const updateNodeConfig = useWorkflowCanvasStore(
    (s) => s.updateNodeConfig,
  );

  const [statusValue, setStatusValue] = useState(
    String((config.params as Record<string, unknown>)?.target_status ?? ""),
  );

  const syncAction = useCallback(
    (val: string) => updateNodeConfig(nodeId, { action_type: val }),
    [nodeId, updateNodeConfig],
  );

  return (
    <div className="space-y-3">
      <ConfigField label={t.workflows.config.actionType}>
        <ConfigSelect
          value={(config.action_type as string) || ""}
          onChange={syncAction}
          options={SYSTEM_ACTIONS}
          placeholder={t.workflows.config.actionType}
        />
      </ConfigField>

      {config.action_type === "CHANGE_STATUS" && (
        <ConfigField label="Trạng thái đích" hint="VD: APPROVED, REJECTED">
          <ConfigInput
            value={statusValue}
            onChange={setStatusValue}
            onBlur={() =>
              updateNodeConfig(nodeId, {
                params: { target_status: statusValue },
              })
            }
            placeholder="APPROVED"
          />
        </ConfigField>
      )}
    </div>
  );
}
