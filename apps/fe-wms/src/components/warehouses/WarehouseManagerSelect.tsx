"use client";

import { Check, Search, UserRound, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { User } from "@bduck/shared-types";
import { useTranslation } from "@/lib/i18n";

interface WarehouseManagerSelectProps {
  users: User[];
  value: string;
  loading: boolean;
  error: string | null;
  disabled?: boolean;
  onChange: (value: string) => void;
}

export function WarehouseManagerSelect({
  users,
  value,
  loading,
  error,
  disabled,
  onChange,
}: WarehouseManagerSelectProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selectedUser = useMemo(
    () => users.find((user) => user.id === value) || null,
    [users, value],
  );

  const filteredUsers = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return users;

    return users.filter((user) => {
      return [
        user.full_name,
        user.email,
        user.employee_id,
        user.username,
      ].some((item) => item.toLowerCase().includes(keyword));
    });
  }, [query, users]);

  const handleBlur = (event: React.FocusEvent<HTMLDivElement>) => {
    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) {
      return;
    }
    setIsOpen(false);
  };

  const selectManager = (managerId: string) => {
    onChange(managerId);
    setQuery("");
    setIsOpen(false);
  };

  return (
    <div className="space-y-2">
      {selectedUser ? (
        <div className="flex min-h-8 items-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-white px-3 py-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-surface-card)] text-[var(--color-text-secondary)]">
            <UserRound size={17} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-[var(--color-text-primary)]">
              {selectedUser.full_name}
            </div>
            <div className="truncate text-xs text-[var(--color-text-muted)]">
              {selectedUser.email} · {selectedUser.employee_id}
            </div>
          </div>
          <button
            type="button"
            disabled={disabled}
            onClick={() => selectManager("")}
            className="rounded-full p-1.5 text-[var(--color-text-muted)] transition-all hover:bg-[var(--color-surface-card)] hover:text-[var(--color-text-primary)] disabled:opacity-50"
            aria-label={t.warehouses.noManager}
          >
            <X size={16} />
          </button>
        </div>
      ) : value ? (
        <div className="rounded-[var(--radius-md)] border border-[var(--color-accent-error)] bg-red-50 px-3 py-2 text-sm text-[var(--color-accent-error)]">
          {t.warehouses.unknownManager}
        </div>
      ) : null}

      <div className="relative" onBlur={handleBlur}>
        <Search
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
        />
        <input
          type="text"
          value={query}
          disabled={disabled || loading}
          onFocus={() => setIsOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setIsOpen(true);
          }}
          placeholder={loading ? t.common.loading : t.warehouses.searchManager}
          className="h-8 w-full rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] pl-10 pr-4 text-sm outline-none focus:border-[var(--color-border-focus)] disabled:cursor-not-allowed disabled:opacity-60"
        />

        {isOpen && !loading && (
          <div className="absolute z-20 mt-2 max-h-72 w-full overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-white shadow-lg">
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => selectManager("")}
              className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-card)]"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-surface-card)]">
                <X size={15} />
              </span>
              {t.warehouses.noManager}
            </button>

            <div className="max-h-60 overflow-y-auto border-t border-[var(--color-border-soft)]">
              {filteredUsers.length === 0 ? (
                <div className="px-3 py-3 text-sm text-[var(--color-text-muted)]">
                  {query.trim()
                    ? t.warehouses.noManagerMatches
                    : t.warehouses.noManagers}
                </div>
              ) : (
                filteredUsers.map((user) => {
                  const isSelected = user.id === value;
                  return (
                    <button
                      key={user.id}
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => selectManager(user.id)}
                      className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-[var(--color-surface-card)]"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-surface-card)] text-[var(--color-text-secondary)]">
                        <UserRound size={16} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-[var(--color-text-primary)]">
                          {user.full_name}
                        </span>
                        <span className="block truncate text-xs text-[var(--color-text-muted)]">
                          {user.email} · {user.employee_id}
                        </span>
                      </span>
                      {isSelected && (
                        <Check
                          size={17}
                          className="shrink-0 text-[var(--color-brand-primary)]"
                        />
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      <p className="text-xs text-[var(--color-text-muted)]">
        {t.warehouses.managerIdHint}
      </p>
      {(error || users.length === 0) && !loading && (
        <p className="text-xs text-[var(--color-accent-error)]">
          {error || t.warehouses.noManagers}
        </p>
      )}
    </div>
  );
}
