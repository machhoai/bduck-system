import { randomUUID } from "crypto";
import type { InAppNotification, NotificationDispatch } from "@bduck/shared-types";
import { notificationRepository } from "../repositories/notificationRepository.js";
import { getUsersByIds } from "../repositories/userRepository.js";
import { sendPushForInAppNotifications } from "./pushNotificationService.js";

interface NonconformityNotificationReport {
  id: string;
  report_number: string;
  issue_type: string;
  quantity_affected: number;
}

function uniqueValues(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function dispatchPushNotifications(notifications: InAppNotification[]) {
  void sendPushForInAppNotifications(notifications).catch((error) => {
    console.error("[nonconformityNotificationService] push delivery failed:", error);
  });
}

function buildActionUrl(reportId: string) {
  const params = new URLSearchParams({
    tab: "nonconformities",
    reportId,
  });
  return `/tasks?${params.toString()}`;
}

function buildNotificationText(reports: NonconformityNotificationReport[]) {
  const first = reports[0];
  const title =
    reports.length === 1
      ? `Can xu ly bien ban NC ${first.report_number}`
      : `Can xu ly ${reports.length} bien ban NC moi`;
  const body =
    reports.length === 1
      ? `Phat hien ${first.issue_type} voi so luong ${first.quantity_affected}. Hang da duoc tam giu/cach ly va cho nguoi co quyen xu ly.`
      : `Phat hien ${reports.length} ngoai le sau kiem dem. Hang lien quan da duoc tam giu/cach ly va cho nguoi co quyen xu ly.`;
  return { title, body };
}

async function createInAppDispatch(input: {
  recipientUserIds: string[];
  reports: NonconformityNotificationReport[];
  warehouseId: string;
  createdBy: string;
}): Promise<NotificationDispatch | null> {
  const recipientUserIds = uniqueValues(input.recipientUserIds);
  const firstReport = input.reports[0];
  if (recipientUserIds.length === 0 || !firstReport) return null;

  const dispatchId = randomUUID();
  const actionUrl = buildActionUrl(firstReport.id);
  const { title, body } = buildNotificationText(input.reports);
  const templateParams = {
    title,
    body,
    action_url: actionUrl,
    warehouse_id: input.warehouseId,
    reports_created: input.reports.length,
    report_ids: input.reports.map((report) => report.id),
  };
  const notifications: Omit<
    InAppNotification,
    "id" | "is_deleted" | "created_at" | "updated_at" | "is_read" | "read_at"
  >[] = recipientUserIds.map((targetUserId) => ({
    target_user_id: targetUserId,
    target_role_id: null,
    template_key: "notification.nonconformity_created",
    template_params: templateParams,
    channel: "IN_APP",
    title,
    body,
    action_url: actionUrl,
    priority: "URGENT",
    source_instance_id: dispatchId,
    source_entity_id: firstReport.id,
    source_entity_type: "NONCONFORMITY_REPORT",
    created_by: input.createdBy,
  }));

  const createdNotifications =
    await notificationRepository.createInAppNotifications(notifications);
  dispatchPushNotifications(createdNotifications);

  return notificationRepository.createDispatch({
    id: dispatchId,
    channel: "IN_APP",
    status: "SENT",
    title,
    body_text: body,
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

export async function notifyNonconformityCreated(input: {
  reports: NonconformityNotificationReport[];
  warehouseId: string;
  reporterId: string;
}): Promise<void> {
  try {
    if (input.reports.length === 0) return;
    const candidateUserIds = await notificationRepository.findActiveUserIdsByPermission(
      "inventory.write",
      input.warehouseId,
      input.reporterId,
    );
    const recipientUserIds = (await getUsersByIds(candidateUserIds)).map(
      (user) => user.id,
    );
    await createInAppDispatch({
      recipientUserIds,
      reports: input.reports,
      warehouseId: input.warehouseId,
      createdBy: input.reporterId,
    });
  } catch (error) {
    console.error(
      "[nonconformityNotificationService] Failed to notify resolvers:",
      error,
    );
  }
}
