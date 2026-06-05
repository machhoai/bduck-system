import { AuditAction } from "@bduck/shared-types";
import type {
  InAppNotification,
  NotificationDispatch,
  SendEmailNotificationPayload,
  SendInAppNotificationPayload,
} from "@bduck/shared-types";
import { randomUUID } from "crypto";
import { notificationRepository } from "../repositories/notificationRepository.js";
import { sanitizeEmailHtml, stripHtmlToText } from "../utils/notificationSanitizer.js";
import { sendBrevoEmail } from "./brevoEmailService.js";
import { logAudit, type AuditMetadata } from "./auditService.js";

export interface CreateNotificationInput {
  target_user_id: string | null;
  target_role_id: string | null;
  template_key: string;
  template_params: Record<string, unknown>;
  channel: string;
  source_instance_id: string | null;
  source_entity_id: string | null;
  source_entity_type: string | null;
}

function uniqueValues(values: string[]): string[] {
  return Array.from(
    new Set(values.map((value) => value.trim()).filter(Boolean)),
  );
}

function getManualTemplateParams(title: string, body: string) {
  return { title, body };
}

function getErrorMessage(error: unknown): string {
  const apiError = error as { messages?: { vi?: string }; message?: string };
  return apiError.messages?.vi || apiError.message || String(error);
}

async function writeAuditForDispatch(
  dispatch: NotificationDispatch,
  userId: string,
  auditMetadata?: AuditMetadata,
) {
  await logAudit({
    entity_type: "notification_dispatches",
    entity_id: dispatch.id,
    action: AuditAction.CREATE,
    user_id: userId,
    old_value: null,
    new_value: dispatch as unknown as Record<string, unknown>,
    ...auditMetadata,
  });
}

export async function createNotification(
  input: CreateNotificationInput,
): Promise<string> {
  const title =
    typeof input.template_params.title === "string"
      ? input.template_params.title
      : input.template_key;
  const body =
    typeof input.template_params.body === "string"
      ? input.template_params.body
      : "";

  const notification = await notificationRepository.createInAppNotification({
    target_user_id: input.target_user_id,
    target_role_id: input.target_role_id,
    template_key: input.template_key,
    template_params: input.template_params,
    channel: "IN_APP",
    title,
    body,
    action_url: null,
    priority: "NORMAL",
    source_instance_id: input.source_instance_id,
    source_entity_id: input.source_entity_id,
    source_entity_type: input.source_entity_type,
    created_by: null,
  });

  return notification.id;
}

export async function markNotificationRead(
  notificationId: string,
): Promise<void> {
  await notificationRepository.markRead(notificationId);
}

export async function markAllNotificationsRead(userId: string): Promise<number> {
  return notificationRepository.markAllRead(userId);
}

export async function fetchNotificationDispatches(
  limit: number,
): Promise<NotificationDispatch[]> {
  return notificationRepository.findDispatches(limit);
}

export async function sendManualInAppNotification(
  input: SendInAppNotificationPayload,
  userId: string,
  auditMetadata?: AuditMetadata,
): Promise<NotificationDispatch> {
  const directUserIds = uniqueValues(input.recipient_user_ids || []);
  const roleIds = uniqueValues(input.recipient_role_ids || []);
  const roleUserIds = await notificationRepository.findActiveUserIdsByRoleIds(
    roleIds,
  );
  const recipientUserIds = uniqueValues([...directUserIds, ...roleUserIds]);

  if (recipientUserIds.length === 0) {
    throw {
      statusCode: 400,
      messages: {
        vi: "Chưa chọn người nhận thông báo in-app.",
        zh: "尚未选择应用内通知接收人。",
      },
    };
  }

  const dispatchId = randomUUID();
  const notifications: Omit<
    InAppNotification,
    "id" | "is_deleted" | "created_at" | "updated_at" | "is_read" | "read_at"
  >[] = recipientUserIds.map((targetUserId) => ({
    target_user_id: targetUserId,
    target_role_id: null,
    template_key: "notification.manual",
    template_params: getManualTemplateParams(input.title, input.message),
    channel: "IN_APP",
    title: input.title,
    body: input.message,
    action_url: input.action_url || null,
    priority: input.priority || "NORMAL",
    source_instance_id: dispatchId,
    source_entity_id: null,
    source_entity_type: "notification_dispatch",
    created_by: userId,
  }));

  await notificationRepository.createInAppNotifications(notifications);

  const dispatch = await notificationRepository.createDispatch({
    id: dispatchId,
    channel: "IN_APP",
    status: "SENT",
    title: input.title,
    body_text: input.message,
    body_html: null,
    recipient_user_ids: recipientUserIds,
    recipient_role_ids: roleIds,
    recipient_emails: [],
    cc_emails: [],
    bcc_emails: [],
    brevo_message_id: null,
    error_message: null,
    sent_count: recipientUserIds.length,
    failed_count: 0,
    created_by: userId,
    action_time: auditMetadata?.action_time || new Date(),
  });

  await writeAuditForDispatch(dispatch, userId, auditMetadata);
  return dispatch;
}

export async function sendEmailNotification(
  input: SendEmailNotificationPayload,
  userId: string,
  auditMetadata?: AuditMetadata,
): Promise<NotificationDispatch> {
  const to = uniqueValues(input.to);
  const cc = uniqueValues(input.cc || []);
  const bcc = uniqueValues(input.bcc || []);
  const htmlContent = sanitizeEmailHtml(input.html_content);
  const textContent =
    input.text_content?.trim() || stripHtmlToText(htmlContent) || input.subject;
  const recipientCount = uniqueValues([...to, ...cc, ...bcc]).length;

  try {
    const result = await sendBrevoEmail({
      to,
      cc,
      bcc,
      subject: input.subject,
      htmlContent,
      textContent,
    });

    const dispatch = await notificationRepository.createDispatch({
      channel: "EMAIL",
      status: "SENT",
      title: input.subject,
      body_text: textContent,
      body_html: htmlContent,
      recipient_user_ids: [],
      recipient_role_ids: [],
      recipient_emails: to,
      cc_emails: cc,
      bcc_emails: bcc,
      brevo_message_id: result.messageId,
      error_message: null,
      sent_count: recipientCount,
      failed_count: 0,
      created_by: userId,
      action_time: auditMetadata?.action_time || new Date(),
    });

    await writeAuditForDispatch(dispatch, userId, auditMetadata);
    return dispatch;
  } catch (error) {
    const dispatch = await notificationRepository.createDispatch({
      channel: "EMAIL",
      status: "FAILED",
      title: input.subject,
      body_text: textContent,
      body_html: htmlContent,
      recipient_user_ids: [],
      recipient_role_ids: [],
      recipient_emails: to,
      cc_emails: cc,
      bcc_emails: bcc,
      brevo_message_id: null,
      error_message: getErrorMessage(error),
      sent_count: 0,
      failed_count: recipientCount,
      created_by: userId,
      action_time: auditMetadata?.action_time || new Date(),
    });

    await writeAuditForDispatch(dispatch, userId, auditMetadata);
    throw error;
  }
}
