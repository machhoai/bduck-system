"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { GitBranch } from "lucide-react";

/**
 * ConditionNode has 2 source handles: "true" (right) and "false" (left).
 * This allows the admin to wire separate edges for each outcome.
 */
function ConditionNodeComponent({ data, selected }: NodeProps) {
  return (
    <div
      className={`min-w-[180px] rounded-[var(--radius-md)] border-2 bg-white px-4 py-3 shadow-sm transition-shadow ${
        selected
          ? "border-orange-500 shadow-md shadow-orange-500/20"
          : "border-orange-300"
      }`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!h-3 !w-3 !border-2 !border-white !bg-orange-500"
      />
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-orange-100 text-orange-600">
          <GitBranch size={14} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-orange-500">
            Condition
          </p>
          <p className="truncate text-sm font-medium text-[var(--color-text-primary)]">
            {(data as Record<string, unknown>).label as string}
          </p>
        </div>
      </div>
      {/* True branch → Bottom-right */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="true"
        className="!h-3 !w-3 !border-2 !border-white !bg-emerald-500"
        style={{ left: "30%" }}
      />
      {/* False branch → Bottom-left */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="false"
        className="!h-3 !w-3 !border-2 !border-white !bg-red-500"
        style={{ left: "70%" }}
      />
      <div className="mt-2 flex justify-between px-1 text-[9px] font-bold uppercase tracking-wider">
        <span className="text-emerald-500">True</span>
        <span className="text-red-500">False</span>
      </div>
    </div>
  );
}

export const ConditionNode = memo(ConditionNodeComponent);
