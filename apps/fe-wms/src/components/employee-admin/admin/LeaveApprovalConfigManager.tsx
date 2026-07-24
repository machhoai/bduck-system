"use client";

import type {
  LeaveApprovalAssignment,
  LeaveApprovalConfig,
  LeaveApprovalConfigOptions,
  LeaveApprovalLevel,
  UpsertLeaveApprovalConfigInput,
} from "@bduck/shared-types";
import { gooeyToast } from "goey-toast";
import { useEffect, useMemo, useState } from "react";

interface Props {
  labels: Record<string, string>;
  config: LeaveApprovalConfig | null;
  options: LeaveApprovalConfigOptions;
  loading: boolean;
  error: string | null;
  onSave: (input: UpsertLeaveApprovalConfigInput) => Promise<unknown>;
}

const assignmentFor = (
  options: LeaveApprovalConfigOptions,
): LeaveApprovalAssignment =>
  options.roles[0]
    ? {
        mode: "ROLE",
        role_id: options.roles[0].id,
        assigned_user_id: null,
      }
    : {
        mode: "USER",
        role_id: null,
        assigned_user_id: options.users[0]?.id ?? "",
      };

const createLevels = (
  config: LeaveApprovalConfig | null,
  options: LeaveApprovalConfigOptions,
): LeaveApprovalLevel[] =>
  ([1, 2, 3] as const).map(
    (level) =>
      config?.levels.find((item) => item.level === level) ?? {
        level,
        enabled: level === 1,
        label: { vi: `Cấp ${level}`, zh: `第 ${level} 级` },
        assignment: assignmentFor(options),
      },
  );

export function LeaveApprovalConfigManager({
  labels,
  config,
  options,
  loading,
  error,
  onSave,
}: Props) {
  const [levels, setLevels] = useState<LeaveApprovalLevel[]>([]);
  const [draftSourceKey, setDraftSourceKey] = useState("");
  const [saving, setSaving] = useState(false);
  const hasOptions = options.roles.length > 0 || options.users.length > 0;
  const sourceKey = useMemo(
    () =>
      JSON.stringify({
        updatedAt: config?.updated_at ?? null,
        roles: options.roles.map((role) => role.id),
        users: options.users.map((user) => user.id),
      }),
    [config?.updated_at, options.roles, options.users],
  );
  useEffect(() => {
    if (draftSourceKey === sourceKey) return;
    setLevels(createLevels(config, options));
    setDraftSourceKey(sourceKey);
  }, [config, draftSourceKey, options, sourceKey]);

  const update = (level: number, patch: Partial<LeaveApprovalLevel>) =>
    setLevels((current) =>
      current.map((item) =>
        item.level === level ? { ...item, ...patch } : item,
      ),
    );
  const setMode = (level: LeaveApprovalLevel, mode: "ROLE" | "USER") =>
    update(level.level, {
      assignment:
        mode === "ROLE"
          ? {
              mode,
              role_id: options.roles[0]?.id ?? "",
              assigned_user_id: null,
            }
          : {
              mode,
              role_id: null,
              assigned_user_id: options.users[0]?.id ?? "",
            },
    });

  const save = async () => {
    if (saving || !hasOptions) return;
    if (!levels.some((level) => level.enabled)) {
      gooeyToast.error(labels.approvalAtLeastOneLevel, {
        description: labels.approvalAtLeastOneLevelHint,
        preset: "snappy",
      });
      return;
    }
    setSaving(true);
    try {
      await gooeyToast.promise(
        onSave({ levels, action_time: new Date() }),
        {
          loading: labels.approvalConfigSaving,
          success: labels.approvalConfigSaved,
          error: labels.approvalSaveError,
          action: {
            error: { label: labels.retry, onClick: () => void save() },
          },
        },
      );
    } catch (saveError) {
      console.error("[LeaveApprovalConfigManager] save error:", saveError);
    } finally {
      setSaving(false);
    }
  };

  if (loading && levels.length === 0) {
    return <div className="h-48 animate-pulse rounded-2xl bg-[var(--color-surface-card)]" />;
  }
  return (
    <div className="space-y-3">
      {error && (
        <p className="rounded-2xl bg-red-50 p-3 text-xs text-red-700">{error}</p>
      )}
      {!hasOptions && (
        <p className="rounded-2xl bg-amber-50 p-3 text-xs text-amber-800">
          {labels.approvalNoEligibleOptions}
        </p>
      )}
      {levels.map((level) => (
        <section
          key={level.level}
          className="rounded-2xl border border-[var(--color-border-soft)] p-3"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                {labels.approvalLevel.replace("{level}", String(level.level))}
              </p>
              <p className="text-xs text-[var(--color-text-muted)]">
                {level.enabled
                  ? labels.approvalLevelEnabled
                  : labels.approvalLevelDisabled}
              </p>
            </div>
            <input
              type="checkbox"
              checked={level.enabled}
              disabled={saving}
              aria-label={labels.approvalToggleLevel}
              onChange={(event) =>
                update(level.level, { enabled: event.target.checked })
              }
              className="h-5 w-5 accent-[var(--color-brand-primary)]"
            />
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <select
              value={level.assignment.mode}
              disabled={saving || !level.enabled}
              onChange={(event) =>
                setMode(level, event.target.value as "ROLE" | "USER")
              }
              className="h-10 rounded-xl border border-[var(--color-border-soft)] bg-white px-3 text-sm"
            >
              <option value="ROLE">{labels.approvalByRole}</option>
              <option value="USER">{labels.approvalByUser}</option>
            </select>
            <select
              value={
                level.assignment.mode === "ROLE"
                  ? level.assignment.role_id
                  : level.assignment.assigned_user_id
              }
              disabled={saving || !level.enabled}
              onChange={(event) =>
                update(level.level, {
                  assignment:
                    level.assignment.mode === "ROLE"
                      ? {
                          mode: "ROLE",
                          role_id: event.target.value,
                          assigned_user_id: null,
                        }
                      : {
                          mode: "USER",
                          role_id: null,
                          assigned_user_id: event.target.value,
                        },
                })
              }
              className="h-10 rounded-xl border border-[var(--color-border-soft)] bg-white px-3 text-sm"
            >
              {(level.assignment.mode === "ROLE"
                ? options.roles
                : options.users
              ).map((option) => (
                <option key={option.id} value={option.id}>
                  {"name" in option
                    ? option.name
                    : `${option.full_name} (${option.employee_id})`}
                </option>
              ))}
            </select>
          </div>
        </section>
      ))}
      <button
        type="button"
        disabled={saving || !hasOptions}
        onClick={() => void save()}
        className="h-11 w-full rounded-2xl bg-[var(--color-brand-primary)] px-4 text-sm font-semibold text-white disabled:opacity-50"
      >
        {saving ? labels.approvalConfigSaving : labels.approvalConfigSave}
      </button>
    </div>
  );
}
