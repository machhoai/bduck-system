"use client";

import { EmployeeContractType } from "@bduck/shared-types";
import { FileSignature, Paperclip } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";

import { useEmployeeContractLabels } from "@/hooks/useEmployeeContractLabels";
import { useTranslation } from "@/lib/i18n";
import { employeeInitialContractTranslations } from "@/lib/i18n/employeeInitialContractTranslations";

import { ContractDateField } from "./ContractDateField";
import type { EmployeeInitialContractFormState } from "./employeeInitialContractDraft";

interface EmployeeInitialContractSectionProps {
  value: EmployeeInitialContractFormState;
  canManageDocuments: boolean;
  error: string | null;
  onChange: Dispatch<SetStateAction<EmployeeInitialContractFormState>>;
  copy?: {
    title: string;
    subtitle: string;
    enable: string;
  };
  allowedContractTypes?: EmployeeContractType[];
  lockStartDate?: boolean;
}

const inputClassName =
  "h-10 w-full rounded-xl border border-[var(--color-border-subtle)] bg-white px-3 text-sm outline-none focus:border-[var(--color-border-focus)]";

export function EmployeeInitialContractSection({
  value,
  canManageDocuments,
  error,
  onChange,
  copy,
  allowedContractTypes = Object.values(EmployeeContractType),
  lockStartDate = false,
}: EmployeeInitialContractSectionProps) {
  const { lang } = useTranslation();
  const labels = useEmployeeContractLabels();
  const initialLabels = employeeInitialContractTranslations[lang];
  const isIndefinite = value.contract_type === EmployeeContractType.INDEFINITE;
  const set = <Key extends keyof EmployeeInitialContractFormState>(
    key: Key,
    next: EmployeeInitialContractFormState[Key],
  ) => onChange((current) => ({ ...current, [key]: next }));

  return (
    <section className="rounded-2xl border border-blue-100 bg-blue-50/40 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
            <FileSignature size={18} />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
              {copy?.title ?? initialLabels.title}
            </h3>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              {copy?.subtitle ?? initialLabels.subtitle}
            </p>
          </div>
        </div>
        <label className="flex shrink-0 cursor-pointer items-center gap-2 text-xs font-semibold text-blue-800">
          <span className="hidden sm:inline">
            {copy?.enable ?? initialLabels.enable}
          </span>
          <input
            type="checkbox"
            checked={value.enabled}
            onChange={(event) => set("enabled", event.target.checked)}
            className="h-5 w-5 accent-[var(--color-brand-primary)]"
          />
        </label>
      </div>

      {value.enabled ? (
        <div className="mt-4 space-y-4 border-t border-blue-100 pt-4">
          <div className="grid gap-3 md:grid-cols-2">
            <Field label={labels.fields.contractNumber} required>
              <input
                required
                maxLength={100}
                value={value.contract_number}
                onChange={(event) => set("contract_number", event.target.value)}
                className={inputClassName}
              />
            </Field>
            <Field label={labels.fields.contractType}>
              <select
                value={value.contract_type}
                onChange={(event) =>
                  set(
                    "contract_type",
                    event.target.value as EmployeeContractType,
                  )
                }
                className={inputClassName}
              >
                {allowedContractTypes.map((type) => (
                  <option key={type} value={type}>
                    {labels.types[type]}
                  </option>
                ))}
              </select>
            </Field>
            <ContractDateField
              id="initial-contract-start-date"
              label={labels.fields.startDate}
              value={value.start_date}
              hint={labels.form.dateHint}
              disabled={lockStartDate}
              required
              error={error}
              onChange={(next) => set("start_date", next)}
            />
            <ContractDateField
              id="initial-contract-end-date"
              label={labels.fields.endDate}
              value={value.end_date}
              hint={isIndefinite ? labels.form.noEndDate : labels.form.dateHint}
              disabled={isIndefinite}
              required={!isIndefinite}
              error={error}
              onChange={(next) => set("end_date", next)}
            />
          </div>
          <Field label={labels.fields.notes}>
            <textarea
              maxLength={1000}
              value={value.notes}
              onChange={(event) => set("notes", event.target.value)}
              className="min-h-20 w-full rounded-xl border border-[var(--color-border-subtle)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-border-focus)]"
            />
          </Field>
          {canManageDocuments ? (
            <label className="block rounded-xl border border-dashed border-blue-200 bg-white p-3">
              <span className="flex items-center gap-2 text-xs font-semibold text-[var(--color-text-secondary)]">
                <Paperclip size={14} />
                {initialLabels.pdfLabel}
              </span>
              <input
                type="file"
                accept="application/pdf,.pdf"
                onChange={(event) =>
                  set("pdf_file", event.target.files?.[0] ?? null)
                }
                className="mt-2 block w-full text-xs text-[var(--color-text-secondary)] file:mr-3 file:rounded-full file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-blue-700"
              />
              <span className="mt-1.5 block text-xxs text-[var(--color-text-muted)]">
                {value.pdf_file
                  ? initialLabels.pdfSelected.replace(
                      "{name}",
                      value.pdf_file.name,
                    )
                  : initialLabels.pdfHint}
              </span>
            </label>
          ) : null}
          {error ? (
            <p className="rounded-xl bg-red-50 p-3 text-xs text-red-700">
              {error}
            </p>
          ) : null}
        </div>
      ) : (
        <p className="mt-3 text-right text-xxs font-medium text-blue-700">
          {initialLabels.optional}
        </p>
      )}
    </section>
  );
}

function Field({
  label,
  required = false,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-[var(--color-text-secondary)]">
        {label}
        {required ? <span className="ml-1 text-red-600">*</span> : null}
      </span>
      {children}
    </label>
  );
}
