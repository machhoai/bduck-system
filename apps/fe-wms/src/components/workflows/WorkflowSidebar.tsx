"use client";

import { useTranslation } from "@/lib/i18n";
import { WorkflowNodeType } from "@bduck/shared-types";
import {
  Zap,
  UserCheck,
  Cog,
  Clock,
  GitBranch,
  Bell,
  Split,
  Merge,
  Workflow,
  Globe,
  ClipboardEdit,
} from "lucide-react";
import type { DragEvent } from "react";

/** Node template for the sidebar palette */
interface NodeTemplate {
  type: WorkflowNodeType;
  icon: React.ElementType;
  colorClass: string;
}

const NODE_TEMPLATES: NodeTemplate[] = [
  { type: WorkflowNodeType.TRIGGER, icon: Zap, colorClass: "bg-emerald-100 text-emerald-600 border-emerald-200" },
  { type: WorkflowNodeType.APPROVAL, icon: UserCheck, colorClass: "bg-blue-100 text-blue-600 border-blue-200" },
  { type: WorkflowNodeType.SYSTEM_ACTION, icon: Cog, colorClass: "bg-violet-100 text-violet-600 border-violet-200" },
  { type: WorkflowNodeType.TIMER, icon: Clock, colorClass: "bg-amber-100 text-amber-600 border-amber-200" },
  { type: WorkflowNodeType.CONDITION, icon: GitBranch, colorClass: "bg-orange-100 text-orange-600 border-orange-200" },
  { type: WorkflowNodeType.NOTIFICATION, icon: Bell, colorClass: "bg-pink-100 text-pink-600 border-pink-200" },
  { type: WorkflowNodeType.FORK, icon: Split, colorClass: "bg-teal-100 text-teal-600 border-teal-200" },
  { type: WorkflowNodeType.JOIN, icon: Merge, colorClass: "bg-teal-100 text-teal-600 border-teal-200" },
  { type: WorkflowNodeType.SUB_WORKFLOW, icon: Workflow, colorClass: "bg-indigo-100 text-indigo-600 border-indigo-200" },
  { type: WorkflowNodeType.WEBHOOK, icon: Globe, colorClass: "bg-slate-100 text-slate-600 border-slate-200" },
  { type: WorkflowNodeType.DATA_INPUT, icon: ClipboardEdit, colorClass: "bg-cyan-100 text-cyan-600 border-cyan-200" },
];

/** i18n label key mapper */
const NODE_LABEL_MAP: Record<WorkflowNodeType, keyof typeof import("@/lib/i18n/vi").default.workflows.nodes> = {
  [WorkflowNodeType.TRIGGER]: "trigger",
  [WorkflowNodeType.APPROVAL]: "approval",
  [WorkflowNodeType.SYSTEM_ACTION]: "systemAction",
  [WorkflowNodeType.TIMER]: "timer",
  [WorkflowNodeType.CONDITION]: "condition",
  [WorkflowNodeType.NOTIFICATION]: "notification",
  [WorkflowNodeType.FORK]: "fork",
  [WorkflowNodeType.JOIN]: "join",
  [WorkflowNodeType.SUB_WORKFLOW]: "subWorkflow",
  [WorkflowNodeType.WEBHOOK]: "webhook",
  [WorkflowNodeType.DATA_INPUT]: "dataInput",
};

const NODE_DESC_MAP: Record<WorkflowNodeType, keyof typeof import("@/lib/i18n/vi").default.workflows.nodes> = {
  [WorkflowNodeType.TRIGGER]: "triggerDesc",
  [WorkflowNodeType.APPROVAL]: "approvalDesc",
  [WorkflowNodeType.SYSTEM_ACTION]: "systemActionDesc",
  [WorkflowNodeType.TIMER]: "timerDesc",
  [WorkflowNodeType.CONDITION]: "conditionDesc",
  [WorkflowNodeType.NOTIFICATION]: "notificationDesc",
  [WorkflowNodeType.FORK]: "forkDesc",
  [WorkflowNodeType.JOIN]: "joinDesc",
  [WorkflowNodeType.SUB_WORKFLOW]: "subWorkflowDesc",
  [WorkflowNodeType.WEBHOOK]: "webhookDesc",
  [WorkflowNodeType.DATA_INPUT]: "dataInputDesc",
};

export function WorkflowSidebar() {
  const { t } = useTranslation();

  const onDragStart = (event: DragEvent<HTMLDivElement>, nodeType: WorkflowNodeType) => {
    event.dataTransfer.setData("application/workflow-node-type", nodeType);
    event.dataTransfer.effectAllowed = "move";
  };

  return (
    <aside className="flex w-[260px] shrink-0 flex-col border-r border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)]">
      <div className="border-b border-[var(--color-border-subtle)] px-4 py-3">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
          {t.workflows.sidebar.title}
        </h3>
        <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
          {t.workflows.sidebar.hint}
        </p>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {NODE_TEMPLATES.map((template) => {
          const Icon = template.icon;
          const labelKey = NODE_LABEL_MAP[template.type];
          const descKey = NODE_DESC_MAP[template.type];

          return (
            <div
              key={template.type}
              draggable
              onDragStart={(e) => onDragStart(e, template.type)}
              className="flex cursor-grab items-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-white px-3 py-2.5 transition-all hover:border-[var(--color-brand-primary)] hover:shadow-sm active:cursor-grabbing active:scale-[0.98]"
            >
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${template.colorClass}`}
              >
                <Icon size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-[var(--color-text-primary)]">
                  {t.workflows.nodes[labelKey]}
                </p>
                <p className="truncate text-[11px] text-[var(--color-text-muted)]">
                  {t.workflows.nodes[descKey]}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
