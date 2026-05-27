"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Clock } from "lucide-react";

function TimerNodeComponent({ data, selected }: NodeProps) {
  return (
    <div
      className={`min-w-[180px] rounded-[var(--radius-md)] border-2 bg-white px-4 py-3 shadow-sm transition-shadow ${
        selected
          ? "border-amber-500 shadow-md shadow-amber-500/20"
          : "border-amber-300"
      }`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!h-3 !w-3 !border-2 !border-white !bg-amber-500"
      />
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-100 text-amber-600">
          <Clock size={14} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-amber-500">
            Timer
          </p>
          <p className="truncate text-sm font-medium text-[var(--color-text-primary)]">
            {(data as Record<string, unknown>).label as string}
          </p>
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-3 !w-3 !border-2 !border-white !bg-amber-500"
      />
    </div>
  );
}

export const TimerNode = memo(TimerNodeComponent);
