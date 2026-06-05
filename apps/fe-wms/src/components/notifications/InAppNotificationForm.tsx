"use client";

import { Link, MessageSquare, Send } from "lucide-react";
import type { NotificationPriority, Role } from "@bduck/shared-types";
import type { UserWithAssignments } from "@/hooks/useUsers";
import NotificationRecipientPicker from "./NotificationRecipientPicker";

interface InAppNotificationFormProps {
  users: UserWithAssignments[];
  roles: Role[];
  selectedUserIds: string[];
  selectedRoleIds: string[];
  title: string;
  message: string;
  priority: NotificationPriority;
  actionUrl: string;
  disabled: boolean;
  isSubmitting: boolean;
  labels: {
    recipientUsers: string;
    recipientRoles: string;
    searchUser: string;
    searchRole: string;
    selectedUsers: string;
    selectedRoles: string;
    clear: string;
    titleField: string;
    priority: string;
    messageField: string;
    actionUrl: string;
    sendInApp: string;
    priorities: Record<NotificationPriority, string>;
  };
  onSelectedUserIdsChange: (ids: string[]) => void;
  onSelectedRoleIdsChange: (ids: string[]) => void;
  onTitleChange: (value: string) => void;
  onMessageChange: (value: string) => void;
  onPriorityChange: (value: NotificationPriority) => void;
  onActionUrlChange: (value: string) => void;
  onSubmit: () => void;
}

const PRIORITIES: NotificationPriority[] = ["LOW", "NORMAL", "HIGH", "URGENT"];

export default function InAppNotificationForm({
  users,
  roles,
  selectedUserIds,
  selectedRoleIds,
  title,
  message,
  priority,
  actionUrl,
  disabled,
  isSubmitting,
  labels,
  onSelectedUserIdsChange,
  onSelectedRoleIdsChange,
  onTitleChange,
  onMessageChange,
  onPriorityChange,
  onActionUrlChange,
  onSubmit,
}: InAppNotificationFormProps) {
  return (
    <div className="space-y-3">
      <NotificationRecipientPicker
        users={users}
        roles={roles}
        selectedUserIds={selectedUserIds}
        selectedRoleIds={selectedRoleIds}
        disabled={disabled}
        labels={{
          recipientUsers: labels.recipientUsers,
          recipientRoles: labels.recipientRoles,
          searchUser: labels.searchUser,
          searchRole: labels.searchRole,
          selectedUsers: labels.selectedUsers,
          selectedRoles: labels.selectedRoles,
          clear: labels.clear,
        }}
        onUserIdsChange={onSelectedUserIdsChange}
        onRoleIdsChange={onSelectedRoleIdsChange}
      />

      <section className="rounded-radius-md border border-border-subtle bg-surface-elevated p-3">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <label className="space-y-1 lg:col-span-2">
            <span className="flex items-center gap-1 text-xs font-semibold text-text-secondary">
              <MessageSquare className="h-3.5 w-3.5 text-text-muted" />
              {labels.titleField}
            </span>
            <input
              className="h-8 w-full rounded-radius-sm border border-border-subtle bg-surface-input px-2 text-sm outline-none focus:border-border-focus"
              value={title}
              disabled={disabled}
              onChange={(event) => onTitleChange(event.target.value)}
            />
          </label>

          <label className="space-y-1">
            <span className="text-xs font-semibold text-text-secondary">
              {labels.priority}
            </span>
            <select
              className="h-8 w-full rounded-radius-sm border border-border-subtle bg-surface-input px-2 text-sm outline-none focus:border-border-focus"
              value={priority}
              disabled={disabled}
              onChange={(event) =>
                onPriorityChange(event.target.value as NotificationPriority)
              }
            >
              {PRIORITIES.map((item) => (
                <option key={item} value={item}>
                  {labels.priorities[item]}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1 lg:col-span-3">
            <span className="text-xs font-semibold text-text-secondary">
              {labels.messageField}
            </span>
            <textarea
              className="min-h-28 w-full rounded-radius-sm border border-border-subtle bg-surface-input p-2 text-sm outline-none focus:border-border-focus"
              value={message}
              disabled={disabled}
              onChange={(event) => onMessageChange(event.target.value)}
            />
          </label>

          <label className="space-y-1 lg:col-span-3">
            <span className="flex items-center gap-1 text-xs font-semibold text-text-secondary">
              <Link className="h-3.5 w-3.5 text-text-muted" />
              {labels.actionUrl}
            </span>
            <input
              className="h-8 w-full rounded-radius-sm border border-border-subtle bg-surface-input px-2 text-sm outline-none focus:border-border-focus"
              value={actionUrl}
              disabled={disabled}
              onChange={(event) => onActionUrlChange(event.target.value)}
            />
          </label>
        </div>

        <div className="mt-3 flex justify-end">
          <button
            type="button"
            disabled={disabled || isSubmitting}
            onClick={onSubmit}
            className="flex h-8 w-fit items-center gap-2 rounded-radius-sm bg-brand-primary px-3 text-sm font-semibold text-white hover:bg-brand-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
            {labels.sendInApp}
          </button>
        </div>
      </section>
    </div>
  );
}
