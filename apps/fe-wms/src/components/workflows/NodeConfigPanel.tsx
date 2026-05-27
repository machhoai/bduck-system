/**
 * NodeConfigPanel — Right-side panel for editing selected node config.
 *
 * ═══════════════════════════════════════════════════════════════
 * ARCHITECTURE:
 * - Reads selectedNodeId from Zustand store
 * - Finds the node in the store's nodes array
 * - Routes to the correct sub-form component based on WorkflowNodeType
 * - Sub-forms call store.updateNodeConfig() on blur → Canvas re-renders
 * ═══════════════════════════════════════════════════════════════
 */
"use client";

import { useCallback, useState } from "react";
import { Settings2 } from "lucide-react";
import { WorkflowNodeType } from "@bduck/shared-types";
import { useTranslation } from "@/lib/i18n";
import {
  useWorkflowCanvasStore,
  type WorkflowNodeData,
} from "@/stores/useWorkflowCanvasStore";
import { ConfigField, ConfigInput } from "./config/ConfigFieldComponents";
import { TriggerConfigForm } from "./config/TriggerConfigForm";
import { ApprovalConfigForm } from "./config/ApprovalConfigForm";
import { ConditionConfigForm } from "./config/ConditionConfigForm";
import { TimerConfigForm } from "./config/TimerConfigForm";
import { SystemActionConfigForm } from "./config/SystemActionConfigForm";
import { NotificationConfigForm } from "./config/NotificationConfigForm";
import { JoinConfigForm } from "./config/JoinConfigForm";
import { WebhookConfigForm } from "./config/WebhookConfigForm";
import { DataInputConfigForm } from "./config/DataInputConfigForm";

/**
 * Empty state shown when no node is selected.
 */
function EmptyState({ text }: { text: string }) {
  return (
    <aside className="flex w-[280px] shrink-0 flex-col items-center justify-center border-l border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] px-4 text-center">
      <Settings2
        size={32}
        className="mb-3 text-[var(--color-text-muted)] opacity-40"
      />
      <p className="text-sm text-[var(--color-text-muted)]">{text}</p>
    </aside>
  );
}

export function NodeConfigPanel() {
  const { t } = useTranslation();
  const selectedNodeId = useWorkflowCanvasStore((s) => s.selectedNodeId);
  const nodes = useWorkflowCanvasStore((s) => s.nodes);
  const updateNodeLabel = useWorkflowCanvasStore((s) => s.updateNodeLabel);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) ?? null;

  // Local label state for debounced sync on blur
  const [localLabel, setLocalLabel] = useState("");
  const [lastNodeId, setLastNodeId] = useState<string | null>(null);

  // Sync local label when selection changes
  if (selectedNode && selectedNode.id !== lastNodeId) {
    const data = selectedNode.data as WorkflowNodeData;
    setLocalLabel(data.label || "");
    setLastNodeId(selectedNode.id);
  }

  const handleLabelBlur = useCallback(() => {
    if (selectedNode) {
      updateNodeLabel(selectedNode.id, localLabel);
    }
  }, [selectedNode, localLabel, updateNodeLabel]);

  if (!selectedNode) {
    return <EmptyState text={t.workflows.config.noSelection} />;
  }

  const nodeType = selectedNode.type as WorkflowNodeType;
  const nodeData = (selectedNode.data || {
    label: "",
    config: {},
  }) as WorkflowNodeData;

  return (
    <aside className="flex w-[280px] shrink-0 flex-col border-l border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)]">
      {/* Header */}
      <div className="border-b border-[var(--color-border-subtle)] px-4 py-3">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
          {t.workflows.config.title}
        </h3>
        <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
          {nodeType}
        </p>
      </div>

      {/* Config Form */}
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {/* Label — shared across all node types */}
        <ConfigField label={t.workflows.config.label}>
          <ConfigInput
            value={localLabel}
            onChange={setLocalLabel}
            onBlur={handleLabelBlur}
          />
        </ConfigField>

        {/* Node ID (read-only) */}
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]">
            Node ID
          </label>
          <p className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-pearl)] px-3 py-2 font-mono text-xs text-[var(--color-text-muted)]">
            {selectedNode.id}
          </p>
        </div>

        {/* Divider */}
        <div className="border-t border-[var(--color-border-subtle)]" />

        {/* Type-specific config form */}
        <TypeSpecificConfigRouter
          nodeType={nodeType}
          nodeId={selectedNode.id}
          config={nodeData.config}
        />
      </div>
    </aside>
  );
}

/**
 * Routes to the correct sub-form based on node type.
 */
function TypeSpecificConfigRouter({
  nodeType,
  nodeId,
  config,
}: {
  nodeType: WorkflowNodeType;
  nodeId: string;
  config: Record<string, unknown>;
}) {
  switch (nodeType) {
    case WorkflowNodeType.TRIGGER:
      return <TriggerConfigForm nodeId={nodeId} config={config} />;
    case WorkflowNodeType.APPROVAL:
      return <ApprovalConfigForm nodeId={nodeId} config={config} />;
    case WorkflowNodeType.CONDITION:
      return <ConditionConfigForm nodeId={nodeId} config={config} />;
    case WorkflowNodeType.TIMER:
      return <TimerConfigForm nodeId={nodeId} config={config} />;
    case WorkflowNodeType.SYSTEM_ACTION:
      return <SystemActionConfigForm nodeId={nodeId} config={config} />;
    case WorkflowNodeType.NOTIFICATION:
      return <NotificationConfigForm nodeId={nodeId} config={config} />;
    case WorkflowNodeType.JOIN:
      return <JoinConfigForm nodeId={nodeId} config={config} />;
    case WorkflowNodeType.WEBHOOK:
      return <WebhookConfigForm nodeId={nodeId} config={config} />;
    case WorkflowNodeType.DATA_INPUT:
      return <DataInputConfigForm nodeId={nodeId} config={config} />;
    case WorkflowNodeType.FORK:
    case WorkflowNodeType.SUB_WORKFLOW:
      return (
        <p className="text-xs italic text-[var(--color-text-muted)]">
          Không cần cấu hình.
        </p>
      );
    default:
      return null;
  }
}
