"use client";

import {
  AlertCircle,
  CheckCircle2,
  Clock,
  History,
  Mail,
  MessageSquare,
} from "lucide-react";
import type { NotificationDispatch } from "@bduck/shared-types";

interface NotificationHistoryPanelProps {
  dispatches: NotificationDispatch[];
  isLoading: boolean;
  canRead: boolean;
  labels: {
    historyTitle: string;
    noHistoryPermission: string;
    emptyHistory: string;
    channelInApp: string;
    channelEmail: string;
    statusSent: string;
    statusFailed: string;
    statusPartial: string;
    sentCount: string;
    failedCount: string;
    brevoMessageId: string;
  };
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function getStatusMeta(
  status: NotificationDispatch["status"],
  labels: NotificationHistoryPanelProps["labels"],
) {
  if (status === "FAILED") {
    return {
      label: labels.statusFailed,
      icon: AlertCircle,
      className: "bg-error-bg text-error-text border-error-border",
    };
  }
  if (status === "PARTIAL") {
    return {
      label: labels.statusPartial,
      icon: AlertCircle,
      className: "bg-warning-bg text-warning-text border-warning-border",
    };
  }
  return {
    label: labels.statusSent,
    icon: CheckCircle2,
    className: "bg-success-bg text-success-text border-success-border",
  };
}

export default function NotificationHistoryPanel({
  dispatches,
  isLoading,
  canRead,
  labels,
}: NotificationHistoryPanelProps) {
  return (
    <aside className="rounded-radius-md border border-border-subtle bg-surface-elevated">
      <div className="flex items-center gap-2 border-b border-border-soft p-3">
        <History className="h-4 w-4 text-brand-primary" />
        <h2 className="text-base font-semibold text-text-primary">
          {labels.historyTitle}
        </h2>
      </div>
      <div className="h-96 overflow-y-auto p-3">
        {!canRead ? (
          <p className="text-sm text-text-muted">{labels.noHistoryPermission}</p>
        ) : isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="skeleton-pulse h-16 rounded-radius-sm" />
            ))}
          </div>
        ) : dispatches.length === 0 ? (
          <p className="text-sm text-text-muted">{labels.emptyHistory}</p>
        ) : (
          <div className="space-y-2">
            {dispatches.map((dispatch) => {
              const status = getStatusMeta(dispatch.status, labels);
              const StatusIcon = status.icon;
              const ChannelIcon =
                dispatch.channel === "EMAIL" ? Mail : MessageSquare;
              return (
                <article
                  key={dispatch.id}
                  className="rounded-radius-sm border border-border-soft p-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-text-primary">
                        {dispatch.title}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-text-muted">
                        <span className="flex items-center gap-1">
                          <ChannelIcon className="h-3 w-3" />
                          {dispatch.channel === "EMAIL"
                            ? labels.channelEmail
                            : labels.channelInApp}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDate(dispatch.created_at)}
                        </span>
                      </div>
                    </div>
                    <span
                      className={`flex h-6 shrink-0 items-center gap-1 rounded-radius-pill border px-2 text-xxs font-semibold ${status.className}`}
                    >
                      <StatusIcon className="h-3 w-3" />
                      {status.label}
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-text-muted">
                    <span>
                      {labels.sentCount}: {dispatch.sent_count}
                    </span>
                    <span>
                      {labels.failedCount}: {dispatch.failed_count}
                    </span>
                  </div>
                  {dispatch.brevo_message_id && (
                    <p className="mt-1 truncate text-xxs text-text-muted">
                      {labels.brevoMessageId}: {dispatch.brevo_message_id}
                    </p>
                  )}
                  {dispatch.error_message && (
                    <p className="mt-1 line-clamp-2 text-xs text-accent-error">
                      {dispatch.error_message}
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}
