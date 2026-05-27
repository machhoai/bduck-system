/**
 * WebhookConfigForm — Config sub-form for WEBHOOK nodes.
 * Fields: url, method, timeout_seconds
 */
"use client";

import { useCallback, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { useWorkflowCanvasStore } from "@/stores/useWorkflowCanvasStore";
import { WebhookMethod } from "@bduck/shared-types";
import {
  ConfigField,
  ConfigInput,
  ConfigSelect,
} from "./ConfigFieldComponents";

interface WebhookConfigFormProps {
  nodeId: string;
  config: Record<string, unknown>;
}

export function WebhookConfigForm({
  nodeId,
  config,
}: WebhookConfigFormProps) {
  const { t } = useTranslation();
  const updateNodeConfig = useWorkflowCanvasStore(
    (s) => s.updateNodeConfig,
  );

  const [url, setUrl] = useState((config.url as string) || "");
  const [timeout, setTimeout] = useState(
    String((config.timeout_seconds as number) ?? 30),
  );

  const methodOptions = Object.values(WebhookMethod).map((v) => ({
    value: v,
    label: v,
  }));

  const syncMethod = useCallback(
    (val: string) => updateNodeConfig(nodeId, { method: val }),
    [nodeId, updateNodeConfig],
  );

  return (
    <div className="space-y-3">
      <ConfigField label={t.workflows.config.webhookUrl}>
        <ConfigInput
          value={url}
          onChange={setUrl}
          onBlur={() => updateNodeConfig(nodeId, { url })}
          placeholder="https://api.example.com/webhook"
        />
      </ConfigField>

      <ConfigField label={t.workflows.config.webhookMethod}>
        <ConfigSelect
          value={(config.method as string) || "POST"}
          onChange={syncMethod}
          options={methodOptions}
          placeholder={t.workflows.config.webhookMethod}
        />
      </ConfigField>

      <ConfigField label={t.workflows.config.webhookTimeout}>
        <ConfigInput
          type="number"
          value={timeout}
          onChange={setTimeout}
          onBlur={() =>
            updateNodeConfig(nodeId, {
              timeout_seconds: Number(timeout) || 30,
            })
          }
          placeholder="30"
        />
      </ConfigField>
    </div>
  );
}
