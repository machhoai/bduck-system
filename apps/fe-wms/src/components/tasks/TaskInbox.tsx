"use client";

/**
 * TaskInbox — Main Task Inbox component
 *
 * LUẬT THÉP:
 * - Realtime via useWorkflowTasks (onSnapshot)
 * - Skeleton loading (no spinners)
 * - Light Theme only
 */

import { useState, useCallback } from "react";
import { ClipboardCheck, Inbox } from "lucide-react";
import { WorkflowNodeType } from "@bduck/shared-types";
import type { WorkflowTask } from "@bduck/shared-types";
import { useWorkflowTasks } from "@/hooks/useWorkflowTasks";
import TaskCard from "./TaskCard";
import ApprovalModal from "./ApprovalModal";
import ReceivingSessionDrawer from "./ReceivingSessionDrawer";

/** Skeleton for loading state */
function TaskSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border border-gray-100 bg-white p-4">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-gray-200" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-16 rounded bg-gray-200" />
          <div className="h-3 w-24 rounded bg-gray-200" />
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <div className="h-3 w-20 rounded bg-gray-200" />
        <div className="h-3 w-20 rounded bg-gray-200" />
      </div>
      <div className="mt-3 flex gap-2">
        <div className="h-9 flex-1 rounded-lg bg-gray-200" />
        <div className="h-9 flex-1 rounded-lg bg-gray-200" />
      </div>
    </div>
  );
}

export default function TaskInbox() {
  const { myTasks, loading } = useWorkflowTasks();

  // Modal state
  const [approvalTask, setApprovalTask] = useState<WorkflowTask | null>(null);
  const [approvalMode, setApprovalMode] = useState<"approve" | "reject">(
    "approve",
  );

  // Receiving session state (will be handled by ReceivingSessionDrawer)
  const [receivingTask, setReceivingTask] = useState<WorkflowTask | null>(null);

  const handleApprove = useCallback((task: WorkflowTask) => {
    setApprovalTask(task);
    setApprovalMode("approve");
  }, []);

  const handleReject = useCallback((task: WorkflowTask) => {
    setApprovalTask(task);
    setApprovalMode("reject");
  }, []);

  const handleOpenDataInput = useCallback((task: WorkflowTask) => {
    setReceivingTask(task);
  }, []);

  const handleCloseApproval = useCallback(() => {
    setApprovalTask(null);
  }, []);

  return (
    <div className="mx-auto max-w-4xl">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100">
          <ClipboardCheck className="h-5.5 w-5.5 text-blue-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            Việc cần xử lý
          </h1>
          <p className="text-sm text-gray-500">
            {loading
              ? "Đang tải..."
              : `${myTasks.length} công việc đang chờ`}
          </p>
        </div>
      </div>

      {/* Task list */}
      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <TaskSkeleton key={i} />
          ))}
        </div>
      ) : myTasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50/50 py-16">
          <Inbox className="h-12 w-12 text-gray-300" />
          <p className="mt-3 text-sm font-medium text-gray-500">
            Không có công việc nào cần xử lý
          </p>
          <p className="mt-1 text-xs text-gray-400">
            Các task mới sẽ tự động hiển thị tại đây
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {myTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onApprove={handleApprove}
              onReject={handleReject}
              onOpenDataInput={handleOpenDataInput}
            />
          ))}
        </div>
      )}

      {/* Approval Modal */}
      {approvalTask && (
        <ApprovalModal
          task={approvalTask}
          mode={approvalMode}
          onClose={handleCloseApproval}
        />
      )}

      {/* Receiving Session Drawer — rendered when a DATA_INPUT task is opened */}
      {receivingTask &&
        receivingTask.node_type === WorkflowNodeType.DATA_INPUT && (
          <ReceivingSessionDrawer
            task={receivingTask}
            onClose={() => setReceivingTask(null)}
          />
        )}
    </div>
  );
}
