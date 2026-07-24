import {
  LeaveApprovalTaskStatus,
  LeaveRequestStatus,
  type LeaveApprovalTask,
  type LeaveRequest,
} from "@bduck/shared-types";
import { notificationRepository } from "../repositories/notificationRepository.js";
import { sendPushForInAppNotifications } from "./pushNotificationService.js";

const dispatchPush = (
  notifications: Awaited<
    ReturnType<typeof notificationRepository.createInAppNotifications>
  >,
) => {
  void sendPushForInAppNotifications(notifications).catch((error) => {
    console.error("[leaveNotificationService] push failed:", error);
  });
};

const recipientsForTask = async (task: LeaveApprovalTask) => {
  if (task.assignment.mode === "USER") {
    return task.assignment.assigned_user_id === task.employee_user_id
      ? []
      : [task.assignment.assigned_user_id];
  }
  return notificationRepository.findActiveUserIdsByRoleIds(
    [task.assignment.role_id],
    task.workplace_warehouse_id,
  );
};

export const notifyPendingLeaveApprover = async (
  task: LeaveApprovalTask,
  request: LeaveRequest,
  actorId: string,
) => {
  if (task.status !== LeaveApprovalTaskStatus.PENDING) return;
  const recipients = await recipientsForTask(task);
  const notifications = await notificationRepository.createInAppNotifications(
    recipients.map((userId) => ({
      target_user_id: userId,
      target_role_id:
        task.assignment.mode === "ROLE" ? task.assignment.role_id : null,
      template_key: "notification.leave_approval_required",
      template_params: {
        request_id: request.id,
        level: task.level,
        title_vi: "Có đơn nghỉ phép cần duyệt",
        title_zh: "有休假申请需要审批",
        body_vi: `Đơn nghỉ phép đang chờ duyệt cấp ${task.level}.`,
        body_zh: `休假申请正在等待第 ${task.level} 级审批。`,
      },
      channel: "IN_APP" as const,
      title: "Có đơn nghỉ phép cần duyệt",
      body: `Đơn nghỉ phép đang chờ duyệt cấp ${task.level}.`,
      action_url: "/employee-admin",
      priority: "HIGH" as const,
      source_instance_id: task.id,
      source_entity_id: request.id,
      source_entity_type: "leave_request",
      created_by: actorId,
    })),
  );
  dispatchPush(notifications);
};

export const notifyLeaveRequestStatus = async (
  request: LeaveRequest,
  actorId: string,
) => {
  const statusCopy: Partial<
    Record<LeaveRequestStatus, { title: string; body: string }>
  > = {
    [LeaveRequestStatus.APPROVED]: {
      title: "Đơn nghỉ phép đã được duyệt",
      body: "Quy trình duyệt đơn nghỉ phép của bạn đã hoàn tất.",
    },
    [LeaveRequestStatus.REJECTED]: {
      title: "Đơn nghỉ phép bị từ chối",
      body: "Vui lòng xem lịch sử đơn để biết lý do từ chối.",
    },
    [LeaveRequestStatus.APPROVER_UNAVAILABLE]: {
      title: "Đơn nghỉ phép đang chờ phân công lại",
      body: "Người duyệt hiện tại không khả dụng. HR đang xử lý.",
    },
  };
  const copy = statusCopy[request.status];
  if (!copy || !request.employee_user_id) return;
  const notification = await notificationRepository.createInAppNotification({
    target_user_id: request.employee_user_id,
    target_role_id: null,
    template_key: `notification.leave_${request.status.toLowerCase()}`,
    template_params: {
      request_id: request.id,
      title_vi: copy.title,
      title_zh:
        request.status === LeaveRequestStatus.APPROVED
          ? "休假申请已批准"
          : request.status === LeaveRequestStatus.REJECTED
            ? "休假申请已拒绝"
            : "休假申请等待重新指派",
      body_vi: copy.body,
      body_zh:
        request.status === LeaveRequestStatus.APPROVED
          ? "您的休假审批流程已完成。"
          : request.status === LeaveRequestStatus.REJECTED
            ? "请查看申请历史中的拒绝原因。"
            : "当前审批人不可用，HR 正在处理。",
    },
    channel: "IN_APP",
    title: copy.title,
    body: copy.body,
    action_url: "/employee-admin",
    priority: request.status === LeaveRequestStatus.REJECTED ? "HIGH" : "NORMAL",
    source_instance_id: request.id,
    source_entity_id: request.id,
    source_entity_type: "leave_request",
    created_by: actorId,
  });
  dispatchPush([notification]);
};

export const notifyLeaveReassignmentRequired = async (
  task: LeaveApprovalTask,
  actorId: string,
) => {
  const recipients =
    await notificationRepository.findActiveUserIdsByPermission(
      "leave.approver.reassign",
      task.workplace_warehouse_id,
      task.employee_user_id,
    );
  const notifications = await notificationRepository.createInAppNotifications(
    recipients.map((userId) => ({
      target_user_id: userId,
      target_role_id: null,
      template_key: "notification.leave_approver_unavailable",
      template_params: {
        request_id: task.leave_request_id,
        task_id: task.id,
        level: task.level,
        title_vi: "Cần phân công lại người duyệt nghỉ phép",
        title_zh: "需要重新指派休假审批人",
        body_vi: `Đơn nghỉ phép đang thiếu người duyệt hợp lệ ở cấp ${task.level}.`,
        body_zh: `休假申请第 ${task.level} 级缺少有效审批人。`,
      },
      channel: "IN_APP" as const,
      title: "Cần phân công lại người duyệt nghỉ phép",
      body: `Đơn nghỉ phép đang thiếu người duyệt hợp lệ ở cấp ${task.level}.`,
      action_url: "/employee-admin",
      priority: "URGENT" as const,
      source_instance_id: task.id,
      source_entity_id: task.leave_request_id,
      source_entity_type: "leave_request",
      created_by: actorId,
    })),
  );
  dispatchPush(notifications);
};
