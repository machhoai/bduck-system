"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Workflow } from "lucide-react";

function SubWorkflowNodeComponent({ data, selected }: NodeProps) {
  return (
    <div
      className={`min-w-[180px] rounded-[var(--radius-md)] border-2 border-dashed bg-white px-4 py-3 shadow-sm transition-shadow ${
        selected
          ? "border-indigo-500 shadow-md shadow-indigo-500/20"
          : "border-indigo-300"
      }`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!h-3 !w-3 !border-2 !border-white !bg-indigo-500"
      />
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
          <Workflow size={14} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-500">
            Sub-process
          </p>
          <p className="truncate text-sm font-medium text-[var(--color-text-primary)]">
            {(data as Record<string, unknown>).label as string}
          </p>
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-3 !w-3 !border-2 !border-white !bg-indigo-500"
      />
    </div>
  );
}

export const SubWorkflowNode = memo(SubWorkflowNodeComponent);
