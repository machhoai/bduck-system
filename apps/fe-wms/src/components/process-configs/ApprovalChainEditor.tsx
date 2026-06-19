"use client";

import { Plus, ShieldCheck, Trash2 } from "lucide-react";
import type { ApprovalLevel, Role } from "@bduck/shared-types";
import type { Locale, TEXT } from "./processConfigMeta";
import { formatApprovalLevelLabel } from "@/lib/i18n/componentTranslations";

type Copy = (typeof TEXT)[Locale];

type Props = {
  chain: ApprovalLevel[];
  roles: Pick<Role, "id" | "name">[];
  disabled: boolean;
  copy: Copy;
  onChange: (chain: ApprovalLevel[]) => void;
};

function ToggleButton({
  active,
  disabled,
  label,
  onClick,
}: {
  active: boolean;
  disabled?: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`relative h-7 w-12 rounded-full transition disabled:cursor-not-allowed disabled:opacity-60 ${
        active ? "bg-[var(--color-success-icon)]" : "bg-[var(--color-neutral-300)]"
      }`}
      aria-label={label}
    >
      <span
        className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition ${
          active ? "left-6" : "left-1"
        }`}
      />
    </button>
  );
}

export function ApprovalChainEditor({
  chain,
  roles,
  disabled,
  copy,
  onChange,
}: Props) {
  const updateLevel = (index: number, updated: ApprovalLevel) => {
    onChange(
      chain.map((level, itemIndex) => (itemIndex === index ? updated : level)),
    );
  };

  const removeLevel = (index: number) => {
    onChange(
      chain
        .filter((_, itemIndex) => itemIndex !== index)
        .map((level, itemIndex) => ({ ...level, level: itemIndex })),
    );
  };

  const addLevel = () => {
    const nextLevel = chain.length + 1;
    onChange([
      ...chain,
      {
        level: chain.length,
        role_id: "",
        label: {
          vi: formatApprovalLevelLabel("vi", nextLevel),
          zh: formatApprovalLevelLabel("zh", nextLevel),
        },
        required: false,
        enabled: true,
        min_approvers: 1,
      },
    ]);
  };

  return (
    <section
      className={`rounded-lg border border-gray-100 bg-white p-4 shadow-sm ${
        disabled ? "opacity-50" : ""
      }`}
    >
      <div className="flex flex-col gap-3 border-b border-gray-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-status-pending-bg)] text-[var(--color-status-pending-text)]">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-950">
              {copy.approvalChain}
            </h2>
            <p className="mt-1 text-xs leading-5 text-gray-500">
              {copy.approvalHint}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={addLevel}
          disabled={disabled}
          className="inline-flex h-8 w-full items-center justify-center gap-2 rounded-lg border border-[var(--color-status-approved-border)] bg-[var(--color-status-approved-bg)] px-3 text-sm font-semibold text-[var(--color-status-approved-text)] transition hover:bg-[var(--color-status-approved-bg-muted)] disabled:cursor-not-allowed disabled:opacity-60 sm:h-9 sm:w-auto sm:text-xs"
        >
          <Plus className="h-4 w-4" />
          {copy.addLevel}
        </button>
      </div>

      <div className="mt-4 space-y-3">
        {chain.map((level, index) => {
          const isActive = level.required || level.enabled;

          return (
            <div
              key={`approval-level-${index}`}
              className="rounded-lg border border-gray-100 bg-gray-50/40 p-3"
            >
              <div className="grid gap-3 lg:grid-cols-[56px_minmax(170px,1fr)_minmax(150px,1fr)_minmax(150px,1fr)_116px_88px_40px] lg:items-end">
                <div className="flex items-center justify-between lg:block">
                  <p className="text-xxs font-semibold uppercase text-gray-400">
                    Level
                  </p>
                  <div className="mt-0 flex h-8 w-10 items-center justify-center rounded-lg bg-gray-400 text-sm font-bold text-white lg:mt-1">
                    {index + 1}
                  </div>
                </div>

                <label className="block">
                  <span className="text-xxs font-semibold uppercase text-gray-400">
                    {copy.role}
                  </span>
                  <select
                    value={level.role_id}
                    disabled={disabled}
                    onChange={(event) =>
                      updateLevel(index, {
                        ...level,
                        role_id: event.target.value,
                      })
                    }
                    className="mt-1 h-8 w-full rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] px-3 text-base text-[var(--color-text-primary)] outline-none transition focus:border-[var(--color-border-focus)] focus:ring-2 focus:ring-[var(--color-brand-primary-muted)] disabled:bg-[var(--color-neutral-50)] sm:h-8 sm:text-sm"
                  >
                    <option value="">{copy.selectRole}</option>
                    {roles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="text-xxs font-semibold uppercase text-gray-400">
                    {copy.labelVi}
                  </span>
                  <input
                    value={level.label.vi}
                    disabled={disabled}
                    onChange={(event) =>
                      updateLevel(index, {
                        ...level,
                        label: { ...level.label, vi: event.target.value },
                      })
                    }
                    className="mt-1 h-8 w-full rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] px-3 text-base text-[var(--color-text-primary)] outline-none transition focus:border-[var(--color-border-focus)] focus:ring-2 focus:ring-[var(--color-brand-primary-muted)] disabled:bg-[var(--color-neutral-50)] sm:h-8 sm:text-sm"
                  />
                </label>

                <label className="block">
                  <span className="text-xxs font-semibold uppercase text-gray-400">
                    {copy.labelZh}
                  </span>
                  <input
                    value={level.label.zh}
                    disabled={disabled}
                    onChange={(event) =>
                      updateLevel(index, {
                        ...level,
                        label: { ...level.label, zh: event.target.value },
                      })
                    }
                    className="mt-1 h-8 w-full rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] px-3 text-base text-[var(--color-text-primary)] outline-none transition focus:border-[var(--color-border-focus)] focus:ring-2 focus:ring-[var(--color-brand-primary-muted)] disabled:bg-[var(--color-neutral-50)] sm:h-8 sm:text-sm"
                  />
                </label>

                <label className="block">
                  <span className="text-xxs font-semibold uppercase text-gray-400">
                    {copy.approvers}
                  </span>
                  <input
                    type="number"
                    min={1}
                    value={level.min_approvers}
                    disabled={disabled}
                    onChange={(event) =>
                      updateLevel(index, {
                        ...level,
                        min_approvers: Math.max(
                          1,
                          Number(event.target.value) || 1,
                        ),
                      })
                    }
                    className="mt-1 h-8 w-full rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] px-3 text-base text-[var(--color-text-primary)] outline-none transition focus:border-[var(--color-border-focus)] focus:ring-2 focus:ring-[var(--color-brand-primary-muted)] disabled:bg-[var(--color-neutral-50)] sm:h-8 sm:text-sm"
                  />
                </label>

                <div className="flex items-center justify-between rounded-lg bg-white px-3 py-2 lg:block lg:bg-transparent lg:px-0 lg:py-0">
                  <p className="text-xxs font-semibold uppercase text-gray-400">
                    {level.required ? copy.required : copy.optional}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <ToggleButton
                      active={isActive}
                      disabled={disabled || level.required}
                      label={isActive ? copy.enabled : copy.disabled}
                      onClick={() =>
                        updateLevel(index, {
                          ...level,
                          enabled: !level.enabled,
                        })
                      }
                    />
                    <span className="text-xs font-medium text-gray-600">
                      {isActive ? copy.enabled : copy.disabled}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={disabled || level.required}
                  onClick={() => removeLevel(index)}
                  className="flex h-8 w-full items-center justify-center rounded-lg bg-white text-gray-400 transition hover:bg-[var(--color-error-bg)] hover:text-[var(--color-error-icon)] disabled:cursor-not-allowed disabled:opacity-30 lg:h-8 lg:w-10 lg:bg-transparent"
                  aria-label={copy.removeLevel}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
