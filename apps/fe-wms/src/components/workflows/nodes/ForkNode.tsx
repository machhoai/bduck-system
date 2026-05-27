"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Split } from "lucide-react";

/**
 * ForkNode splits flow into parallel branches.
 * Has 1 target handle (top) and multiple source handles (bottom).
 * Admin connects multiple edges from this node's bottom to parallel nodes.
 */
function ForkNodeComponent({ data, selected }: NodeProps) {
  return (
    <div
      className={`min-w-[140px] rounded-[var(--radius-md)] border-2 bg-white px-4 py-3 shadow-sm transition-shadow ${
        selected
          ? "border-teal-500 shadow-md shadow-teal-500/20"
          : "border-teal-300"
      }`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!h-3 !w-3 !border-2 !border-white !bg-teal-500"
      />
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-teal-100 text-teal-600">
          <Split size={14} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-teal-500">
            Fork
          </p>
          <p className="truncate text-sm font-medium text-[var(--color-text-primary)]">
            {(data as Record<string, unknown>).label as string}
          </p>
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-3 !w-3 !border-2 !border-white !bg-teal-500"
      />
    </div>
  );
}

export const ForkNode = memo(ForkNodeComponent);
