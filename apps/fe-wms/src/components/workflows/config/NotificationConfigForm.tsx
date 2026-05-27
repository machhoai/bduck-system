/**
 * NotificationConfigForm — Config sub-form for NOTIFICATION nodes.
 * Fields: channel (enum), template_key (string)
 */
"use client";

import { useCallback, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { useWorkflowCanvasStore } from "@/stores/useWorkflowCanvasStore";
import { NotificationChannel } from "@bduck/shared-types";
import {
  ConfigField,
  ConfigInput,
  ConfigSelect,
} from "./ConfigFieldComponents";

interface NotificationConfigFormProps {
  nodeId: string;
  config: Record<string, unknown>;
}

export function NotificationConfigForm({
  nodeId,
  config,
}: NotificationConfigFormProps) {
  const { t } = useTranslation();
  const updateNodeConfig = useWorkflowCanvasStore(
    (s) => s.updateNodeConfig,
  );

  const [templateKey, setTemplateKey] = useState(
    (config.template_key as string) || "",
  );

  const channelOptions = Object.values(NotificationChannel).map((v) => ({
    value: v,
    label: v,
  }));

  const syncChannel = useCallback(
    (val: string) => updateNodeConfig(nodeId, { channel: val }),
    [nodeId, updateNodeConfig],
  );

  return (
    <div className="space-y-3">
      <ConfigField label={t.workflows.config.channel}>
        <ConfigSelect
          value={(config.channel as string) || ""}
          onChange={syncChannel}
          options={channelOptions}
          placeholder={t.workflows.config.channel}
        />
      </ConfigField>

      <ConfigField label={t.workflows.config.templateKey}>
        <ConfigInput
          value={templateKey}
          onChange={setTemplateKey}
          onBlur={() =>
            updateNodeConfig(nodeId, { template_key: templateKey })
          }
          placeholder="import_voucher_approved"
        />
      </ConfigField>
    </div>
  );
}
