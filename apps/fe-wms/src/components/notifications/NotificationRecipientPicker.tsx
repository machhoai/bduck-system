"use client";

import { Search, ShieldCheck, UserCheck, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { Role } from "@bduck/shared-types";
import type { UserWithAssignments } from "@/hooks/useUsers";

interface NotificationRecipientPickerProps {
  users: UserWithAssignments[];
  roles: Role[];
  selectedUserIds: string[];
  selectedRoleIds: string[];
  labels: {
    recipientUsers: string;
    recipientRoles: string;
    searchUser: string;
    searchRole: string;
    selectedUsers: string;
    selectedRoles: string;
    clear: string;
  };
  disabled?: boolean;
  onUserIdsChange: (ids: string[]) => void;
  onRoleIdsChange: (ids: string[]) => void;
}

function toggleValue(values: string[], value: string) {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];
}

export default function NotificationRecipientPicker({
  users,
  roles,
  selectedUserIds,
  selectedRoleIds,
  labels,
  disabled = false,
  onUserIdsChange,
  onRoleIdsChange,
}: NotificationRecipientPickerProps) {
  const [userSearch, setUserSearch] = useState("");
  const [roleSearch, setRoleSearch] = useState("");

  const filteredUsers = useMemo(() => {
    const keyword = userSearch.trim().toLowerCase();
    if (!keyword) return users;
    return users.filter((user) =>
      [user.full_name, user.email, user.username, user.employee_id]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(keyword)),
    );
  }, [userSearch, users]);

  const filteredRoles = useMemo(() => {
    const keyword = roleSearch.trim().toLowerCase();
    if (!keyword) return roles;
    return roles.filter((role) =>
      [role.name, role.description || ""].some((value) =>
        value.toLowerCase().includes(keyword),
      ),
    );
  }, [roleSearch, roles]);

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      <section className="rounded-radius-md border border-border-subtle bg-surface-elevated">
        <div className="flex items-center justify-between border-b border-border-soft p-3">
          <div className="flex items-center gap-2">
            <UserCheck className="h-4 w-4 text-brand-primary" />
            <h2 className="text-base font-semibold text-text-primary">
              {labels.recipientUsers}
            </h2>
          </div>
          <button
            type="button"
            disabled={disabled || selectedUserIds.length === 0}
            onClick={() => onUserIdsChange([])}
            className="flex h-6 items-center gap-1 rounded-radius-sm px-2 text-xs text-text-muted hover:bg-surface-subtle disabled:cursor-not-allowed disabled:opacity-50"
          >
            <X className="h-3 w-3" />
            {labels.clear}
          </button>
        </div>
        <div className="p-3">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
            <input
              className="h-8 w-full rounded-radius-sm border border-border-subtle bg-surface-input pl-8 pr-2 text-sm outline-none focus:border-border-focus"
              placeholder={labels.searchUser}
              value={userSearch}
              disabled={disabled}
              onChange={(event) => setUserSearch(event.target.value)}
            />
          </label>
          <p className="mt-2 text-xs text-text-muted">
            {selectedUserIds.length} {labels.selectedUsers}
          </p>
          <div className="mt-2 h-56 overflow-y-auto rounded-radius-sm border border-border-soft">
            {filteredUsers.map((user) => (
              <label
                key={user.id}
                className="flex cursor-pointer items-start gap-2 border-b border-border-soft p-2 last:border-b-0 hover:bg-surface-subtle"
              >
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 accent-brand-primary"
                  checked={selectedUserIds.includes(user.id)}
                  disabled={disabled}
                  onChange={() =>
                    onUserIdsChange(toggleValue(selectedUserIds, user.id))
                  }
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-text-primary">
                    {user.full_name || user.username}
                  </span>
                  <span className="block truncate text-xs text-text-muted">
                    {user.email} · {user.employee_id}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-radius-md border border-border-subtle bg-surface-elevated">
        <div className="flex items-center justify-between border-b border-border-soft p-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-brand-primary" />
            <h2 className="text-base font-semibold text-text-primary">
              {labels.recipientRoles}
            </h2>
          </div>
          <button
            type="button"
            disabled={disabled || selectedRoleIds.length === 0}
            onClick={() => onRoleIdsChange([])}
            className="flex h-6 items-center gap-1 rounded-radius-sm px-2 text-xs text-text-muted hover:bg-surface-subtle disabled:cursor-not-allowed disabled:opacity-50"
          >
            <X className="h-3 w-3" />
            {labels.clear}
          </button>
        </div>
        <div className="p-3">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
            <input
              className="h-8 w-full rounded-radius-sm border border-border-subtle bg-surface-input pl-8 pr-2 text-sm outline-none focus:border-border-focus"
              placeholder={labels.searchRole}
              value={roleSearch}
              disabled={disabled}
              onChange={(event) => setRoleSearch(event.target.value)}
            />
          </label>
          <p className="mt-2 text-xs text-text-muted">
            {selectedRoleIds.length} {labels.selectedRoles}
          </p>
          <div className="mt-2 h-56 overflow-y-auto rounded-radius-sm border border-border-soft">
            {filteredRoles.map((role) => (
              <label
                key={role.id}
                className="flex cursor-pointer items-start gap-2 border-b border-border-soft p-2 last:border-b-0 hover:bg-surface-subtle"
              >
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 accent-brand-primary"
                  checked={selectedRoleIds.includes(role.id)}
                  disabled={disabled}
                  onChange={() =>
                    onRoleIdsChange(toggleValue(selectedRoleIds, role.id))
                  }
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-text-primary">
                    {role.name}
                  </span>
                  {role.description && (
                    <span className="block truncate text-xs text-text-muted">
                      {role.description}
                    </span>
                  )}
                </span>
              </label>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
