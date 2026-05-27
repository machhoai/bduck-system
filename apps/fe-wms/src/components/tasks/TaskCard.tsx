"use client";

/**
 * TaskCard — Individual task card in the Task Inbox
 *
 * Renders differently based on node_type:
 * - APPROVAL: Shows Approve/Reject action buttons
 * - DATA_INPUT: Shows "Open Receiving Session" button
 * - Other: Shows info only (system tasks shouldn't appear here)
 */

import { useMemo } from "react";
import {
  CheckCircle,
  XCircle,
  ClipboardEdit,
  Clock,
  User,
  AlertTriangle,
} from "lucide-react";
import { WorkflowNodeType } from "@bduck/shared-types";
import type { WorkflowTask } from "@bduck/shared-types";

interface TaskCardProps {
  task: WorkflowTask;
  onApprove: (task: WorkflowTask) => void;
  onReject: (task: WorkflowTask) => void;
  onOpenDataInput: (task: WorkflowTask) => void;
}

/** Node type → human-readable label + color */
const NODE_META: Record<
  string,
  { label: string; color: string; icon: React.ElementType }
> = {
  [WorkflowNodeType.APPROVAL]: {
    label: "Phê duyệt",
    color: "bg-amber-50 text-amber-700 border-amber-200",
    icon: CheckCircle,
  },
  [WorkflowNodeType.DATA_INPUT]: {
    label: "Nhập liệu",
    color: "bg-blue-50 text-blue-700 border-blue-200",
    icon: ClipboardEdit,
  },
};

export default function TaskCard({
  task,
  onApprove,
  onReject,
  onOpenDataInput,
}: TaskCardProps) {
  const meta = useMemo(
    () =>
      NODE_META[task.node_type] || {
        label: task.node_type,
        color: "bg-gray-50 text-gray-600 border-gray-200",
        icon: Clock,
      },
    [task.node_type],
  );

  const isOverdue = useMemo(() => {
    if (!task.due_at) return false;
    const dueDate =
      task.due_at instanceof Date ? task.due_at : new Date(task.due_at as any);
    return dueDate < new Date();
  }, [task.due_at]);

  const IconComponent = meta.icon;

  return (
    <div
      className={`group relative rounded-xl border bg-white p-4 shadow-sm 
        transition-all duration-200 hover:shadow-md hover:-translate-y-0.5
        ${isOverdue ? "border-red-300 bg-red-50/30" : "border-gray-100"}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div
            className={`flex h-9 w-9 items-center justify-center rounded-lg ${meta.color}`}
          >
            <IconComponent className="h-4.5 w-4.5" />
          </div>
          <div>
            <span
              className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${meta.color}`}
            >
              {meta.label}
            </span>
            <p className="mt-0.5 text-sm font-semibold text-gray-900">
              {task.instance_id?.slice(0, 8)}...
            </p>
          </div>
        </div>

        {isOverdue && (
          <div className="flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
            <AlertTriangle className="h-3 w-3" />
            Quá hạn
          </div>
        )}
      </div>

      {/* Meta info */}
      <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
        {task.assigned_role_id && (
          <div className="flex items-center gap-1">
            <User className="h-3 w-3" />
            <span>{task.assigned_role_id.slice(0, 8)}</span>
          </div>
        )}
        {task.started_at && (
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>
              {new Date(task.started_at as any).toLocaleDateString("vi-VN")}
            </span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="mt-3 flex items-center gap-2">
        {task.node_type === WorkflowNodeType.APPROVAL && (
          <>
            <button
              type="button"
              onClick={() => onApprove(task)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg 
                bg-emerald-600 px-3 py-2 text-sm font-medium text-white 
                transition-colors hover:bg-emerald-700 active:bg-emerald-800"
            >
              <CheckCircle className="h-4 w-4" />
              Duyệt
            </button>
            <button
              type="button"
              onClick={() => onReject(task)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg 
                border border-red-200 bg-white px-3 py-2 text-sm font-medium 
                text-red-600 transition-colors hover:bg-red-50 active:bg-red-100"
            >
              <XCircle className="h-4 w-4" />
              Từ chối
            </button>
          </>
        )}

        {task.node_type === WorkflowNodeType.DATA_INPUT && (
          <button
            type="button"
            onClick={() => onOpenDataInput(task)}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg 
              bg-blue-600 px-3 py-2 text-sm font-medium text-white 
              transition-colors hover:bg-blue-700 active:bg-blue-800"
          >
            <ClipboardEdit className="h-4 w-4" />
            Mở phiên kiểm đếm
          </button>
        )}
      </div>
    </div>
  );
}
