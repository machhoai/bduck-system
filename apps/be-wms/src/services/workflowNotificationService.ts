import { randomUUID } from "crypto";
import type {
  ApprovalRecord,
  InAppNotification,
  NotificationDispatch,
  ProcessEntityType,
  User,
} from "@bduck/shared-types";
import { notificationRepository } from "../repositories/notificationRepository.js";
import * as userRepository from "../repositories/userRepository.js";
import * as approvalRepository from "../repositories/approvalRepository.js";
import { sendEmailNotification } from "./notificationService.js";

const ENTITY_LABELS: Record<ProcessEntityType, string> = {
  IMPORT_VOUCHER: "phiếu nhập kho",
  EXPORT_VOUCHER: "phiếu xuất kho",
  TRANSFER_ORDER: "lệnh chuyển kho",
  TRANSFER_INTRA: "lệnh chuyển nội bộ",
  PURCHASE_ORDER: "đơn mua hàng",
  ADJUSTMENT_VOUCHER: "phiếu điều chỉnh",
  GIFT_SESSION: "phiên quà tặng",
};

const ENTITY_ACTION_PATHS: Record<ProcessEntityType, string> = {
  IMPORT_VOUCHER: "/import-vouchers",
  EXPORT_VOUCHER: "/export-vouchers",
  TRANSFER_ORDER: "/transfers",
  TRANSFER_INTRA: "/transfers",
  PURCHASE_ORDER: "/tasks",
  ADJUSTMENT_VOUCHER: "/tasks",
  GIFT_SESSION: "/tasks",
};

const ENTITY_NEXT_STEPS: Record<ProcessEntityType, string> = {
  IMPORT_VOUCHER: "Mở phiếu nhập kho để bắt đầu hoặc theo dõi bước nhận hàng.",
  EXPORT_VOUCHER: "Mở phiếu xuất kho để bắt đầu hoặc theo dõi bước soạn hàng.",
  TRANSFER_ORDER: "Mở lệnh chuyển kho để theo dõi phiếu xuất/nhận liên quan.",
  TRANSFER_INTRA: "Mở lệnh chuyển kho để theo dõi trạng thái thực hiện.",
  PURCHASE_ORDER: "Mở công việc để thực hiện bước tiếp theo.",
  ADJUSTMENT_VOUCHER: "Mở công việc để thực hiện bước tiếp theo.",
  GIFT_SESSION: "Mở công việc để thực hiện bước tiếp theo.",
};

function uniqueValues(values: string[]): string[] {
  return Array.from(
    new Set(values.map((value) => value.trim()).filter(Boolean)),
  );
}

function getEntityLabel(entityType: ProcessEntityType): string {
  return ENTITY_LABELS[entityType] ?? "công việc";
}

function getDisplayCode(record: ApprovalRecord): string {
  return record.voucher_number || record.entity_id.slice(0, 12);
}

function getAppBaseUrl(): string {
  const corsOrigin = process.env.BE_WMS_CORS_ORIGIN?.split(",")[0]?.trim();
  return (
    process.env.WMS_APP_URL?.trim() ||
    process.env.FE_WMS_URL?.trim() ||
    corsOrigin ||
    "http://app.wms.localhost"
  ).replace(/\/+$/, "");
}

function buildAbsoluteUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${getAppBaseUrl()}${normalizedPath}`;
}

function getTaskActionUrl(record: ApprovalRecord): string {
  const params = new URLSearchParams({
    entityType: record.entity_type,
    entityId: record.entity_id,
  });
  return `/tasks?${params.toString()}`;
}

function getEntityActionUrl(record: ApprovalRecord): string {
  const basePath = ENTITY_ACTION_PATHS[record.entity_type] ?? "/tasks";
  return `${basePath}?entityId=${encodeURIComponent(record.entity_id)}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderEmailHtml(input: {
  title: string;
  body: string;
  nextStep: string;
  actionText: string;
  actionUrl: string;
}): string {
  return `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">
      <h2 style="margin:0 0 12px">${escapeHtml(input.title)}</h2>
      <p style="margin:0 0 12px">${escapeHtml(input.body)}</p>
      <p style="margin:0 0 20px"><strong>Bước tiếp theo:</strong> ${escapeHtml(input.nextStep)}</p>
      <a href="${escapeHtml(input.actionUrl)}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:700">
        ${escapeHtml(input.actionText)}
      </a>
    </div>
  `;
}

async function createInAppDispatch(input: {
  recipientUserIds: string[];
  title: string;
  body: string;
  actionUrl: string;
  templateKey: string;
  templateParams: Record<string, unknown>;
  sourceEntityId: string;
  sourceEntityType: string;
  createdBy: string;
}): Promise<NotificationDispatch | null> {
  const recipientUserIds = uniqueValues(input.recipientUserIds);
  if (recipientUserIds.length === 0) return null;

  const dispatchId = randomUUID();
  const notifications: Omit<
    InAppNotification,
    "id" | "is_deleted" | "created_at" | "updated_at" | "is_read" | "read_at"
  >[] = recipientUserIds.map((targetUserId) => ({
    target_user_id: targetUserId,
    target_role_id: null,
    template_key: input.templateKey,
    template_params: input.templateParams,
    channel: "IN_APP",
    title: input.title,
    body: input.body,
    action_url: input.actionUrl,
    priority: "HIGH",
    source_instance_id: dispatchId,
    source_entity_id: input.sourceEntityId,
    source_entity_type: input.sourceEntityType,
    created_by: input.createdBy,
  }));

  await notificationRepository.createInAppNotifications(notifications);

  return notificationRepository.createDispatch({
    id: dispatchId,
    channel: "IN_APP",
    status: "SENT",
    title: input.title,
    body_text: input.body,
    body_html: null,
    recipient_user_ids: recipientUserIds,
    recipient_role_ids: [],
    recipient_emails: [],
    cc_emails: [],
    bcc_emails: [],
    brevo_message_id: null,
    error_message: null,
    sent_count: recipientUserIds.length,
    failed_count: 0,
    created_by: input.createdBy,
    action_time: new Date(),
  });
}

async function sendEmailToUsers(input: {
  users: User[];
  subject: string;
  body: string;
  nextStep: string;
  actionText: string;
  actionUrl: string;
  createdBy: string;
}): Promise<void> {
  const emails = uniqueValues(input.users.map((user) => user.email || ""));
  if (emails.length === 0) return;

  await sendEmailNotification(
    {
      to: emails,
      subject: input.subject,
      html_content: renderEmailHtml({
        title: input.subject,
        body: input.body,
        nextStep: input.nextStep,
        actionText: input.actionText,
        actionUrl: input.actionUrl,
      }),
      text_content: `${input.body}\n\nBước tiếp theo: ${input.nextStep}\n${input.actionUrl}`,
    },
    input.createdBy,
  );
}

async function notifyApproversForRecords(
  records: ApprovalRecord[],
): Promise<void> {
  if (records.length === 0) return;

  const sample = records[0];
  const roleIds = uniqueValues(records.map((record) => record.role_id));
  const approverUserIds = (
    await notificationRepository.findActiveUserIdsByRoleIds(
      roleIds,
      sample.warehouse_id,
    )
  ).filter((userId) => userId !== sample.creator_id);

  const users = await userRepository.getUsersByIds(approverUserIds);
  const recipientUserIds = users.map((user) => user.id);
  if (recipientUserIds.length === 0) return;

  const approvalId = records[0].id;
  const entityLabel = getEntityLabel(sample.entity_type);
  const displayCode = getDisplayCode(sample);
  const title = `Cần duyệt ${entityLabel} ${displayCode}`;
  const body = `Có ${entityLabel} ${displayCode} cần bạn xử lý ở cấp duyệt ${sample.level + 1}. Người tạo: ${sample.creator_name || sample.creator_id}.`;
  const nextStep =
    "Mở công việc, kiểm tra nội dung và chọn duyệt hoặc từ chối.";
  const actionUrl = getTaskActionUrl(sample);

  await createInAppDispatch({
    recipientUserIds,
    title,
    body: `${body} Bước tiếp theo: ${nextStep}`,
    actionUrl,
    templateKey: "notification.approval_task_required",
    templateParams: {
      title,
      body,
      next_step: nextStep,
      action_url: actionUrl,
      approval_id: approvalId,
      entity_type: sample.entity_type,
      entity_id: sample.entity_id,
    },
    sourceEntityId: sample.entity_id,
    sourceEntityType: sample.entity_type,
    createdBy: sample.creator_id,
  });

  await sendEmailToUsers({
    users,
    subject: title,
    body,
    nextStep,
    actionText: "Mở công việc cần duyệt",
    actionUrl: buildAbsoluteUrl(actionUrl),
    createdBy: sample.creator_id,
  });
}

export async function notifyInitialApprovalTasks(
  records: ApprovalRecord[],
): Promise<void> {
  try {
    const pendingRecords = records.filter(
      (record) => record.status === "PENDING",
    );
    if (pendingRecords.length === 0) return;

    const firstLevel = Math.min(
      ...pendingRecords.map((record) => record.level),
    );
    await notifyApproversForRecords(
      pendingRecords.filter((record) => record.level === firstLevel),
    );
  } catch (error) {
    console.error(
      "[workflowNotificationService] Failed to notify approvers:",
      error,
    );
  }
}

export async function notifyNextApprovalLevel(
  record: ApprovalRecord,
): Promise<void> {
  try {
    const allRecords = await approvalRepository.findByEntity(
      record.entity_type,
      record.entity_id,
    );
    const nextLevel = Math.min(
      ...allRecords
        .filter(
          (candidate) =>
            candidate.status === "PENDING" && candidate.level > record.level,
        )
        .map((candidate) => candidate.level),
    );

    if (!Number.isFinite(nextLevel)) return;

    await notifyApproversForRecords(
      allRecords.filter(
        (candidate) =>
          candidate.status === "PENDING" && candidate.level === nextLevel,
      ),
    );
  } catch (error) {
    console.error(
      "[workflowNotificationService] Failed to notify next level:",
      error,
    );
  }
}

export async function notifyApprovalCompleted(
  record: ApprovalRecord,
  approverId: string,
): Promise<void> {
  try {
    const creator = await userRepository.getUserById(record.creator_id);
    if (!creator || creator.is_deleted || creator.status === "INACTIVE") return;

    const approver = await userRepository.getUserById(approverId);
    const approverName = approver?.full_name || approver?.email || approverId;
    const entityLabel = getEntityLabel(record.entity_type);
    const displayCode = getDisplayCode(record);
    const title = `${entityLabel} ${displayCode} đã được duyệt xong`;
    const body = `${entityLabel} ${displayCode} đã hoàn tất toàn bộ luồng duyệt. Người duyệt cuối: ${approverName}.`;
    const nextStep =
      ENTITY_NEXT_STEPS[record.entity_type] ??
      "Mở công việc để thực hiện bước tiếp theo.";
    const actionUrl = getEntityActionUrl(record);

    await createInAppDispatch({
      recipientUserIds: [creator.id],
      title,
      body: `${body} Bước tiếp theo: ${nextStep}`,
      actionUrl,
      templateKey: "notification.approval_completed",
      templateParams: {
        title,
        body,
        next_step: nextStep,
        action_url: actionUrl,
        approver_id: approverId,
        approver_name: approverName,
        entity_type: record.entity_type,
        entity_id: record.entity_id,
      },
      sourceEntityId: record.entity_id,
      sourceEntityType: record.entity_type,
      createdBy: approverId,
    });

    await sendEmailToUsers({
      users: [creator],
      subject: title,
      body,
      nextStep,
      actionText: "Mở công việc đã duyệt",
      actionUrl: buildAbsoluteUrl(actionUrl),
      createdBy: approverId,
    });
  } catch (error) {
    console.error(
      "[workflowNotificationService] Failed to notify creator:",
      error,
    );
  }
}
