import type { InAppNotification, NotificationPriority } from "@bduck/shared-types";
import { messaging } from "../config/firebase.js";
import { notificationRepository } from "../repositories/notificationRepository.js";

type TokenFailure = {
  token: string;
  code?: string;
};

function chunkArray<T>(items: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }
  return chunks;
}

function uniqueValues(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function getUrgency(priority: NotificationPriority): "very-low" | "low" | "normal" | "high" {
  if (priority === "LOW") return "low";
  if (priority === "HIGH" || priority === "URGENT") return "high";
  return "normal";
}

function getAbsoluteActionUrl(actionUrl: string | null): string | undefined {
  if (!actionUrl) return undefined;
  if (/^https?:\/\//i.test(actionUrl)) return actionUrl;

  const appUrl = process.env.FE_WMS_APP_URL;
  if (!appUrl) return undefined;

  try {
    return new URL(actionUrl, appUrl).toString();
  } catch {
    return undefined;
  }
}

function isExpiredTokenError(code?: string): boolean {
  return (
    code === "messaging/registration-token-not-registered" ||
    code === "messaging/invalid-registration-token" ||
    code === "messaging/invalid-argument"
  );
}

async function deactivateFailedTokens(failures: TokenFailure[]) {
  const expiredTokens = failures
    .filter((failure) => isExpiredTokenError(failure.code))
    .map((failure) => failure.token);

  if (expiredTokens.length === 0) return;
  await notificationRepository.deactivatePushTokensByToken(expiredTokens);
}

export async function registerPushToken(input: {
  userId: string;
  token: string;
  platform?: string | null;
  userAgent?: string | null;
}) {
  return notificationRepository.upsertPushToken(input);
}

export async function unregisterPushToken(input: {
  userId: string;
  token: string;
}) {
  await notificationRepository.deactivatePushToken(input.userId, input.token);
}

export async function sendPushForInAppNotifications(
  notifications: InAppNotification[],
): Promise<void> {
  const targetUserIds = uniqueValues(
    notifications
      .map((notification) => notification.target_user_id || "")
      .filter(Boolean),
  );
  if (targetUserIds.length === 0) return;

  const pushTokens =
    await notificationRepository.findActivePushTokensByUserIds(targetUserIds);
  if (pushTokens.length === 0) return;

  const tokensByUserId = new Map<string, string[]>();
  pushTokens.forEach((pushToken) => {
    const current = tokensByUserId.get(pushToken.user_id) || [];
    current.push(pushToken.token);
    tokensByUserId.set(pushToken.user_id, current);
  });

  const failures: TokenFailure[] = [];

  for (const notification of notifications) {
    if (!notification.target_user_id) continue;
    const tokens = tokensByUserId.get(notification.target_user_id) || [];
    if (tokens.length === 0) continue;

    const actionUrl = notification.action_url || "/";
    const absoluteActionUrl = getAbsoluteActionUrl(actionUrl);

    for (const tokenChunk of chunkArray(tokens, 500)) {
      const result = await messaging.sendEachForMulticast({
        tokens: tokenChunk,
        data: {
          notification_id: notification.id,
          title: notification.title,
          body: notification.body,
          action_url: actionUrl,
          priority: notification.priority,
          created_at: notification.created_at.toISOString(),
        },
        webpush: {
          headers: {
            Urgency: getUrgency(notification.priority),
          },
          fcmOptions: absoluteActionUrl
            ? {
                link: absoluteActionUrl,
              }
            : undefined,
        },
      });

      result.responses.forEach((response, index) => {
        if (!response.success) {
          failures.push({
            token: tokenChunk[index],
            code: response.error?.code,
          });
        }
      });
    }
  }

  if (failures.length > 0) {
    await deactivateFailedTokens(failures);
  }
}
