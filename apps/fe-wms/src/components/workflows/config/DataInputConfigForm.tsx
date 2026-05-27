"use client";

/**
 * DataInputConfigForm — Config form for DATA_INPUT nodes
 *
 * Fields:
 * - input_type: Select (RECEIVING_SESSION, QUALITY_INSPECTION)
 * - assigned_role_id: Select from available roles
 */

import { useState, useCallback } from "react";
import { useWorkflowCanvasStore } from "@/stores/useWorkflowCanvasStore";
import {
  ConfigField,
  ConfigSelect,
} from "./ConfigFieldComponents";
import { useRoles } from "@/hooks/useRoles";

const INPUT_TYPE_OPTIONS = [
  { value: "RECEIVING_SESSION", label: "Phiên kiểm đếm (Receiving)" },
  { value: "QUALITY_INSPECTION", label: "Kiểm tra chất lượng (QC)" },
];

interface DataInputConfigFormProps {
  nodeId: string;
  config: Record<string, unknown>;
}

export function DataInputConfigForm({ nodeId, config }: DataInputConfigFormProps) {
  const updateNodeConfig = useWorkflowCanvasStore((s) => s.updateNodeConfig);
  const { roles } = useRoles();

  const [inputType, setInputType] = useState(
    (config.input_type as string) || "RECEIVING_SESSION",
  );
  const [roleId, setRoleId] = useState(
    (config.assigned_role_id as string) || "",
  );

  const handleInputTypeChange = useCallback(
    (val: string) => {
      setInputType(val);
      updateNodeConfig(nodeId, { input_type: val });
    },
    [nodeId, updateNodeConfig],
  );

  const handleRoleChange = useCallback(
    (val: string) => {
      setRoleId(val);
      updateNodeConfig(nodeId, { assigned_role_id: val || null });
    },
    [nodeId, updateNodeConfig],
  );

  const roleOptions = [
    { value: "", label: "— Bất kỳ ai —" },
    ...roles.map((r) => ({ value: r.id, label: r.name })),
  ];

  return (
    <div className="space-y-3">
      <ConfigField label="Loại nhập liệu">
        <ConfigSelect
          value={inputType}
          onChange={handleInputTypeChange}
          options={INPUT_TYPE_OPTIONS}
        />
      </ConfigField>

      <ConfigField label="Vai trò thực hiện">
        <ConfigSelect
          value={roleId}
          onChange={handleRoleChange}
          options={roleOptions}
        />
      </ConfigField>
    </div>
  );
}
