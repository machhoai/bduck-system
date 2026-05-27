/**
 * TriggerConfigForm — Config sub-form for TRIGGER nodes.
 * Field: event (select from known domain events)
 */
"use client";

import { useCallback } from "react";
import { useTranslation } from "@/lib/i18n";
import { useWorkflowCanvasStore } from "@/stores/useWorkflowCanvasStore";
import { ApprovalEntityType } from "@bduck/shared-types";
import { ConfigField, ConfigSelect } from "./ConfigFieldComponents";

interface TriggerConfigFormProps {
  nodeId: string;
  config: Record<string, unknown>;
}

const EVENT_OPTIONS = Object.values(ApprovalEntityType).map((v) => ({
  value: `${v}_CREATED`,
  label: `${v}_CREATED`,
}));

export function TriggerConfigForm({
  nodeId,
  config,
}: TriggerConfigFormProps) {
  const { t } = useTranslation();
  const updateNodeConfig = useWorkflowCanvasStore(
    (s) => s.updateNodeConfig,
  );

  const syncEvent = useCallback(
    (val: string) => updateNodeConfig(nodeId, { event: val }),
    [nodeId, updateNodeConfig],
  );

  return (
    <div className="space-y-3">
      <ConfigField label={t.workflows.config.event}>
        <ConfigSelect
          value={(config.event as string) || ""}
          onChange={syncEvent}
          options={EVENT_OPTIONS}
          placeholder={t.workflows.config.event}
        />
      </ConfigField>
    </div>
  );
}
