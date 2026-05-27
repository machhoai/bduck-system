/**
 * ApprovalConfigForm — Config sub-form for APPROVAL nodes.
 *
 * Fields:
 *   - assigned_role_id (select dropdown from useRoles())
 *   - timeout_hours (number)
 *   - timeout_action (select: AUTO_APPROVE | AUTO_REJECT | ESCALATE)
 *
 * Sync strategy: on-blur / onChange-select → immediate Zustand update.
 */
"use client";

import { useCallback } from "react";
import { useTranslation } from "@/lib/i18n";
import { useRoles } from "@/hooks/useRoles";
import { useWorkflowCanvasStore } from "@/stores/useWorkflowCanvasStore";
import { TimeoutAction } from "@bduck/shared-types";
import {
  ConfigField,
  ConfigInput,
  ConfigSelect,
} from "./ConfigFieldComponents";

interface ApprovalConfigFormProps {
  nodeId: string;
  config: Record<string, unknown>;
}

export function ApprovalConfigForm({
  nodeId,
  config,
}: ApprovalConfigFormProps) {
  const { t } = useTranslation();
  const { roles, isLoading: rolesLoading } = useRoles();
  const updateNodeConfig = useWorkflowCanvasStore(
    (s) => s.updateNodeConfig,
  );

  const syncField = useCallback(
    (field: string, value: unknown) => {
      updateNodeConfig(nodeId, { [field]: value });
    },
    [nodeId, updateNodeConfig],
  );

  const roleOptions = roles.map((r) => ({
    value: r.id,
    label: r.name,
  }));

  const timeoutActionOptions = Object.values(TimeoutAction).map((v) => ({
    value: v,
    label: v,
  }));

  return (
    <div className="space-y-3">
      {/* Role Dropdown */}
      <ConfigField label={t.workflows.config.role}>
        {rolesLoading ? (
          <div className="h-9 w-full animate-pulse rounded-[var(--radius-md)] bg-[var(--color-surface-pearl)]" />
        ) : (
          <ConfigSelect
            value={(config.assigned_role_id as string) || ""}
            onChange={(val) => syncField("assigned_role_id", val || null)}
            options={roleOptions}
            placeholder={t.workflows.config.role}
          />
        )}
      </ConfigField>

      {/* Timeout Hours */}
      <ConfigField
        label={t.workflows.config.timeoutHours}
        hint="0 = không giới hạn thời gian"
      >
        <ConfigInput
          type="number"
          value={(config.timeout_hours as number) ?? 0}
          onChange={(val) => syncField("timeout_hours", Number(val) || null)}
          onBlur={() =>
            syncField(
              "timeout_hours",
              (config.timeout_hours as number) || null,
            )
          }
          placeholder="24"
        />
      </ConfigField>

      {/* Timeout Action */}
      <ConfigField label={t.workflows.config.timeoutAction}>
        <ConfigSelect
          value={(config.timeout_action as string) || ""}
          onChange={(val) => syncField("timeout_action", val || null)}
          options={timeoutActionOptions}
          placeholder={t.workflows.config.timeoutAction}
        />
      </ConfigField>
    </div>
  );
}
