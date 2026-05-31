"use client";

import { BadgeCheck, Camera, ScanLine, UserRoundCog } from "lucide-react";
import type { Role, StepOption } from "@bduck/shared-types";
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

function SwitchRow({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: typeof Camera;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-12 items-center justify-between gap-3 rounded-lg border px-3 text-left text-sm font-semibold transition sm:h-10 sm:text-xs ${
        active
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
      }`}
    >
      <span className="flex min-w-0 items-center gap-2">
        <Icon className="h-4 w-4 shrink-0" />
        <span className="truncate">{label}</span>
      </span>
      <span
        className={`h-2.5 w-2.5 rounded-full ${
          active ? "bg-emerald-500" : "bg-gray-300"
        }`}
      />
    </button>
  );
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
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
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
                      <BadgeCheck className="h-4 w-4 text-blue-600" />
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
                      <span className="text-[11px] font-semibold uppercase text-gray-400">
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
                        className="mt-1 h-12 w-full rounded-lg border border-gray-200 bg-white px-3 text-base text-gray-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 sm:h-10 sm:text-sm"
                      >
                        <option value="CREATOR">{copy.creator}</option>
                        <option value="ROLE">{copy.selectedRole}</option>
                      </select>
                    </label>

                    {option.assignment_mode === "ROLE" && (
                      <label className="block">
                        <span className="text-[11px] font-semibold uppercase text-gray-400">
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
                          className="mt-1 h-12 w-full rounded-lg border border-gray-200 bg-white px-3 text-base text-gray-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 sm:h-10 sm:text-sm"
                        >
                          <option value="">{copy.selectRole}</option>
                          {roles.map((role) => (
                            <option key={role.id} value={role.id}>
                              {role.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}

                    <SwitchRow
                      icon={Camera}
                      label={copy.requireEvidence}
                      active={option.require_evidence}
                      onClick={() =>
                        updateStep(step.key, {
                          ...option,
                          require_evidence: !option.require_evidence,
                        })
                      }
                    />
                    <SwitchRow
                      icon={ScanLine}
                      label={copy.requireBarcode}
                      active={option.require_barcode_scan}
                      onClick={() =>
                        updateStep(step.key, {
                          ...option,
                          require_barcode_scan: !option.require_barcode_scan,
                        })
                      }
                    />
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
