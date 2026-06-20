"use client";

import { BadgeCheck, UserRoundCog } from "lucide-react";
import type { ApprovalScopeMode, Role, StepOption } from "@bduck/shared-types";
import type { StepAssignmentMode } from "@bduck/shared-types";
import type { EntityStepMeta, Locale, TEXT } from "./processConfigMeta";
import { DEFAULT_STEP_OPTION } from "./processConfigMeta";

type Copy = (typeof TEXT)[Locale];

type Props = {
  steps: EntityStepMeta[];
  stepOptions: Record<string, StepOption>;
  roles: Pick<Role, "id" | "name">[];
  locale: Locale;
  copy: Copy;
  onChange: (stepOptions: Record<string, StepOption>) => void;
};

const SCOPE_OPTIONS: ApprovalScopeMode[] = [
  "ENTITY_WAREHOUSE",
  "SOURCE_WAREHOUSE",
  "DESTINATION_WAREHOUSE",
  "GLOBAL",
];

function getScopeLabel(copy: Copy, scope: ApprovalScopeMode) {
  const labels: Record<ApprovalScopeMode, string> = {
    ENTITY_WAREHOUSE: copy.entityWarehouseScope,
    SOURCE_WAREHOUSE: copy.sourceWarehouseScope,
    DESTINATION_WAREHOUSE: copy.destinationWarehouseScope,
    GLOBAL: copy.globalRoleScope,
  };
  return labels[scope];
}

export function StepOptionsEditor({
  steps,
  stepOptions,
  roles,
  locale,
  copy,
  onChange,
}: Props) {
  const updateStep = (stepKey: string, next: StepOption) => {
    onChange({ ...stepOptions, [stepKey]: next });
  };

  return (
    <section className="rounded-lg border border-gray-100 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3 border-b border-gray-100 pb-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-status-approved-bg)] text-[var(--color-status-approved-text)]">
          <UserRoundCog className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-gray-950">
            {copy.stepOptions}
          </h2>
          <p className="mt-1 text-xs leading-5 text-gray-500">
            {steps.length > 0 ? copy.fixedPipelineHint : copy.noStepOptions}
          </p>
        </div>
      </div>

      {steps.length > 0 && (
        <div className="mt-4 space-y-3">
          {steps.map((step) => {
            const option = stepOptions[step.key] ?? DEFAULT_STEP_OPTION;

            return (
              <div
                key={step.key}
                className="rounded-lg border border-gray-100 bg-gray-50/40 p-4"
              >
                <div className="grid gap-4 xl:grid-cols-[minmax(180px,0.8fr)_minmax(300px,1.2fr)]">
                  <div>
                    <div className="flex items-center gap-2">
                      <BadgeCheck className="h-4 w-4 text-[var(--color-status-approved-text)]" />
                      <h3 className="text-sm font-semibold text-gray-900">
                        {step.label[locale]}
                      </h3>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-gray-500">
                      {step.description[locale]}
                    </p>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="block">
                      <span className="text-xxs font-semibold uppercase text-gray-400">
                        {copy.assignee}
                      </span>
                      <select
                        value={option.assignment_mode}
                        onChange={(event) => {
                          const mode = event.target.value as StepAssignmentMode;
                          updateStep(step.key, {
                            ...option,
                            assignment_mode: mode,
                            assigned_role_id:
                              mode === "CREATOR"
                                ? null
                                : option.assigned_role_id,
                          });
                        }}
                        className="mt-1 h-8 w-full rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] px-3 text-base text-[var(--color-text-primary)] outline-none transition focus:border-[var(--color-border-focus)] focus:ring-2 focus:ring-[var(--color-brand-primary-muted)] sm:h-8 sm:text-sm"
                      >
                        <option value="CREATOR">{copy.creator}</option>
                        <option value="ROLE">{copy.selectedRole}</option>
                      </select>
                    </label>

                    {option.assignment_mode === "ROLE" && (
                      <>
                        <label className="block">
                          <span className="text-xxs font-semibold uppercase text-gray-400">
                            {copy.role}
                          </span>
                          <select
                            value={option.assigned_role_id ?? ""}
                            onChange={(event) =>
                              updateStep(step.key, {
                                ...option,
                                assigned_role_id: event.target.value || null,
                              })
                            }
                            className="mt-1 h-8 w-full rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] px-3 text-base text-[var(--color-text-primary)] outline-none transition focus:border-[var(--color-border-focus)] focus:ring-2 focus:ring-[var(--color-brand-primary-muted)] sm:h-8 sm:text-sm"
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
                            {copy.assignmentScope}
                          </span>
                          <select
                            value={option.assignment_scope ?? "ENTITY_WAREHOUSE"}
                            onChange={(event) =>
                              updateStep(step.key, {
                                ...option,
                                assignment_scope: event.target.value as ApprovalScopeMode,
                                allow_global_fallback:
                                  event.target.value === "GLOBAL"
                                    ? false
                                    : option.allow_global_fallback === true,
                              })
                            }
                            className="mt-1 h-8 w-full rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] px-3 text-base text-[var(--color-text-primary)] outline-none transition focus:border-[var(--color-border-focus)] focus:ring-2 focus:ring-[var(--color-brand-primary-muted)] sm:h-8 sm:text-sm"
                          >
                            {SCOPE_OPTIONS.map((scope) => (
                              <option key={scope} value={scope}>
                                {getScopeLabel(copy, scope)}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="flex min-h-8 items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-gray-600">
                          <input
                            type="checkbox"
                            checked={option.allow_global_fallback === true}
                            disabled={
                              (option.assignment_scope ?? "ENTITY_WAREHOUSE") === "GLOBAL"
                            }
                            onChange={(event) =>
                              updateStep(step.key, {
                                ...option,
                                allow_global_fallback: event.target.checked,
                              })
                            }
                            className="h-4 w-4"
                          />
                          <span>{copy.allowGlobalFallback}</span>
                        </label>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
