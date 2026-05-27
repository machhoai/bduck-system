/**
 * JoinConfigForm — Config sub-form for JOIN nodes.
 * Field: join_type (ALL or ANY)
 */
"use client";

import { useCallback } from "react";
import { useTranslation } from "@/lib/i18n";
import { useWorkflowCanvasStore } from "@/stores/useWorkflowCanvasStore";
import { JoinType } from "@bduck/shared-types";
import { ConfigField } from "./ConfigFieldComponents";

interface JoinConfigFormProps {
  nodeId: string;
  config: Record<string, unknown>;
}

export function JoinConfigForm({ nodeId, config }: JoinConfigFormProps) {
  const { t } = useTranslation();
  const updateNodeConfig = useWorkflowCanvasStore(
    (s) => s.updateNodeConfig,
  );

  const currentJoinType = (config.join_type as string) || JoinType.ALL;

  const setJoinType = useCallback(
    (val: string) => updateNodeConfig(nodeId, { join_type: val }),
    [nodeId, updateNodeConfig],
  );

  return (
    <div className="space-y-3">
      <ConfigField label={t.workflows.config.joinType}>
        <div className="flex gap-2">
          {[
            { value: JoinType.ALL, label: t.workflows.config.joinAll },
            { value: JoinType.ANY, label: t.workflows.config.joinAny },
          ].map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setJoinType(option.value)}
              className={`flex-1 rounded-[var(--radius-md)] border px-3 py-2 text-sm font-medium transition-all ${
                currentJoinType === option.value
                  ? "border-[var(--color-brand-primary)] bg-[var(--color-brand-primary)]/10 text-[var(--color-brand-primary)]"
                  : "border-[var(--color-border-default)] bg-white text-[var(--color-text-secondary)] hover:border-[var(--color-brand-primary)]/40"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </ConfigField>
    </div>
  );
}
