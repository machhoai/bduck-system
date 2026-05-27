"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { UserCheck } from "lucide-react";

/**
 * ApprovalNode has 2 source handles: "approved" (left) and "rejected" (right).
 * This allows the admin to wire separate edges for approve/reject outcomes.
 * Mirrors the ConditionNode pattern with "true"/"false" handles.
 */
function ApprovalNodeComponent({ data, selected }: NodeProps) {
  return (
    <div
      className={`min-w-[180px] rounded-[var(--radius-md)] border-2 bg-white px-4 py-3 shadow-sm transition-shadow ${
        selected
          ? "border-blue-500 shadow-md shadow-blue-500/20"
          : "border-blue-300"
      }`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!h-3 !w-3 !border-2 !border-white !bg-blue-500"
      />
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-blue-600">
          <UserCheck size={14} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-blue-500">
            Approval
          </p>
          <p className="truncate text-sm font-medium text-[var(--color-text-primary)]">
            {(data as Record<string, unknown>).label as string}
          </p>
        </div>
      </div>
      {/* Approved branch → Bottom-left */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="approved"
        className="!h-3 !w-3 !border-2 !border-white !bg-emerald-500"
        style={{ left: "30%" }}
      />
      {/* Rejected branch → Bottom-right */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="rejected"
        className="!h-3 !w-3 !border-2 !border-white !bg-red-500"
        style={{ left: "70%" }}
      />
      <div className="mt-2 flex justify-between px-1 text-[9px] font-bold uppercase tracking-wider">
        <span className="text-emerald-500">Duyệt</span>
        <span className="text-red-500">Từ chối</span>
      </div>
    </div>
  );
}

export const ApprovalNode = memo(ApprovalNodeComponent);
