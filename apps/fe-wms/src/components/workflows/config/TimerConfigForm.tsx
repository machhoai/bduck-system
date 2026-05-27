/**
 * TimerConfigForm — Config sub-form for TIMER nodes.
 *
 * Fields:
 *   - duration_hours (number)
 *   - duration_minutes (number)
 *
 * Sync strategy: on-blur → immediate Zustand update.
 */
"use client";

import { useCallback, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { useWorkflowCanvasStore } from "@/stores/useWorkflowCanvasStore";
import { ConfigField, ConfigInput } from "./ConfigFieldComponents";

interface TimerConfigFormProps {
  nodeId: string;
  config: Record<string, unknown>;
}

export function TimerConfigForm({ nodeId, config }: TimerConfigFormProps) {
  const { t } = useTranslation();
  const updateNodeConfig = useWorkflowCanvasStore(
    (s) => s.updateNodeConfig,
  );

  const [hours, setHours] = useState(
    String((config.duration_hours as number) ?? 0),
  );
  const [minutes, setMinutes] = useState(
    String((config.duration_minutes as number) ?? 0),
  );

  const syncField = useCallback(
    (field: string, value: number) => {
      updateNodeConfig(nodeId, { [field]: Math.max(0, value) });
    },
    [nodeId, updateNodeConfig],
  );

  return (
    <div className="space-y-3">
      <ConfigField label={t.workflows.config.durationHours}>
        <ConfigInput
          type="number"
          value={hours}
          onChange={setHours}
          onBlur={() => syncField("duration_hours", Number(hours) || 0)}
          placeholder="0"
        />
      </ConfigField>

      <ConfigField label={t.workflows.config.durationMinutes}>
        <ConfigInput
          type="number"
          value={minutes}
          onChange={setMinutes}
          onBlur={() =>
            syncField("duration_minutes", Number(minutes) || 0)
          }
          placeholder="30"
        />
      </ConfigField>
    </div>
  );
}
