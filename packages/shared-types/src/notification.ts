import type { ISOTimestamped, SoftDeletable } from "./utility.js";

export type NotificationDeliveryChannel = "IN_APP" | "EMAIL";

export type NotificationPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";

export type NotificationDispatchStatus = "SENT" | "FAILED" | "PARTIAL";

export interface InAppNotification extends SoftDeletable {
  id: string;
  target_user_id: string | null;
  target_role_id: string | null;
  template_key: string;
  template_params: Record<string, unknown>;
  channel: "IN_APP";
  title: string;
  body: string;
  action_url: string | null;
  priority: NotificationPriority;
  source_instance_id: string | null;
  source_entity_id: string | null;
  source_entity_type: string | null;
  created_by: string | null;
  is_read: boolean;
  read_at: Date | null;
}

export interface NotificationDispatch
  extends SoftDeletable,
    ISOTimestamped {
  id: string;
  channel: NotificationDeliveryChannel;
  status: NotificationDispatchStatus;
  title: string;
  body_text: string | null;
  body_html: string | null;
  recipient_user_ids: string[];
  recipient_role_ids: string[];
  recipient_emails: string[];
  cc_emails: string[];
  bcc_emails: string[];
  brevo_message_id: string | null;
  error_message: string | null;
  sent_count: number;
  failed_count: number;
  created_by: string;
}

export interface SendInAppNotificationPayload {
  recipient_user_ids: string[];
  recipient_role_ids?: string[];
  title: string;
  message: string;
  priority?: NotificationPriority;
  action_url?: string | null;
}

export interface SendEmailNotificationPayload {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  html_content: string;
  text_content?: string;
}

export interface NotificationPushToken extends SoftDeletable {
  id: string;
  user_id: string;
  token: string;
  platform: string | null;
  user_agent: string | null;
  permission: "granted";
  is_active: boolean;
  last_seen_at: Date;
  disabled_at: Date | null;
}

export interface RegisterNotificationPushTokenPayload {
  token: string;
  platform?: string | null;
  user_agent?: string | null;
}

export interface UnregisterNotificationPushTokenPayload {
  token: string;
}
