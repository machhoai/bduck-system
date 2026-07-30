"use client";

import {
  EMPLOYEE_CONTRACT_PDF_MAX_BYTES,
  EmployeeContractType,
  formatContractDisplayDate,
  getNextContractLocalDate,
  parseContractDisplayDate,
  type EmployeeContract,
  type LocalDate,
} from "@bduck/shared-types";
import { Paperclip } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

import { ContractDateField } from "./ContractDateField";
import { EmployeeContractSheet } from "./EmployeeContractSheet";
import type { EmployeeContractLabels } from "./employeeContractUiTypes";

export type EmployeeContractFormMode = "create" | "edit" | "renew";

export interface EmployeeContractDraftValues {
  contract_number: string;
  contract_type: EmployeeContractType;
  start_date: LocalDate;
  end_date: LocalDate | null;
  notes: string | null;
  pdf_file: File | null;
  submission_id: string;
  action_time: Date;
}

interface EmployeeContractFormSheetProps {
  isOpen: boolean;
  mode: EmployeeContractFormMode;
  contract: EmployeeContract | null;
  labels: EmployeeContractLabels;
  canManageDocuments: boolean;
  onClose: () => void;
  onSubmit: (values: EmployeeContractDraftValues) => Promise<void>;
}

const inputClassName =
  "h-10 w-full rounded-xl border border-[var(--color-border-subtle)] bg-white px-3 text-sm outline-none focus:border-[var(--color-border-focus)]";

export function EmployeeContractFormSheet({
  isOpen,
  mode,
  contract,
  labels,
  canManageDocuments,
  onClose,
  onSubmit,
}: EmployeeContractFormSheetProps) {
  const [contractNumber, setContractNumber] = useState("");
  const [contractType, setContractType] = useState(
    EmployeeContractType.FIXED_TERM,
  );
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [dateError, setDateError] = useState<string | null>(null);
  const [submissionId, setSubmissionId] = useState(() => crypto.randomUUID());
  const [submissionActionTime, setSubmissionActionTime] = useState<Date | null>(
    null,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const renewalStart =
      mode === "renew" && contract?.end_date
        ? getNextContractLocalDate(contract.end_date)
        : null;
    setContractNumber(mode === "edit" ? contract?.contract_number || "" : "");
    setContractType(contract?.contract_type ?? EmployeeContractType.FIXED_TERM);
    setStartDate(
      mode === "renew"
        ? formatContractDisplayDate(renewalStart)
        : formatContractDisplayDate(contract?.start_date),
    );
    setEndDate(
      mode === "edit" ? formatContractDisplayDate(contract?.end_date) : "",
    );
    setNotes(mode === "edit" ? contract?.notes || "" : "");
    setPdfFile(null);
    setDateError(null);
    setSubmissionId(crypto.randomUUID());
    setSubmissionActionTime(null);
    setIsSubmitting(false);
  }, [contract, isOpen, mode]);

  const title = {
    create: labels.form.createTitle,
    edit: labels.form.editTitle,
    renew: labels.form.renewTitle,
  }[mode];
  const indefinite = contractType === EmployeeContractType.INDEFINITE;
  const canUploadPdf = canManageDocuments && mode !== "edit";

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const parsedStart = parseContractDisplayDate(startDate);
    const parsedEnd = indefinite ? null : parseContractDisplayDate(endDate);
    const validPdf =
      !pdfFile ||
      ((pdfFile.type === "application/pdf" ||
        pdfFile.name.toLocaleLowerCase().endsWith(".pdf")) &&
        pdfFile.size > 0 &&
        pdfFile.size <= EMPLOYEE_CONTRACT_PDF_MAX_BYTES);
    if (
      !contractNumber.trim() ||
      !parsedStart ||
      (!indefinite && !parsedEnd) ||
      (parsedEnd !== null && parsedEnd < parsedStart)
    ) {
      setDateError(
        !parsedStart ||
          (!indefinite && !parsedEnd) ||
          (parsedStart !== null &&
            parsedEnd !== null &&
            parsedEnd < parsedStart)
          ? labels.form.invalidDate
          : labels.form.required,
      );
      return;
    }
    if (!validPdf) {
      setDateError(labels.documents.invalidFile);
      return;
    }
    setDateError(null);
    setIsSubmitting(true);
    const actionTime = submissionActionTime ?? new Date();
    setSubmissionActionTime(actionTime);
    try {
      await onSubmit({
        contract_number: contractNumber.trim(),
        contract_type: contractType,
        start_date: parsedStart,
        end_date: parsedEnd,
        notes: notes.trim() || null,
        pdf_file: canUploadPdf ? pdfFile : null,
        submission_id: submissionId,
        action_time: actionTime,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <EmployeeContractSheet
      isOpen={isOpen}
      title={title}
      closeLabel={labels.actions.close}
      onClose={onClose}
    >
      <form onSubmit={submit} className="space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-[var(--color-text-secondary)]">
            {labels.fields.contractNumber}
            <span className="ml-1 text-red-600">*</span>
          </span>
          <input
            required
            maxLength={100}
            value={contractNumber}
            onChange={(event) => setContractNumber(event.target.value)}
            className={inputClassName}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-[var(--color-text-secondary)]">
            {labels.fields.contractType}
          </span>
          <select
            value={contractType}
            disabled={mode === "renew"}
            onChange={(event) =>
              setContractType(event.target.value as EmployeeContractType)
            }
            className={inputClassName}
          >
            {Object.values(EmployeeContractType).map((type) => (
              <option key={type} value={type}>
                {labels.types[type]}
              </option>
            ))}
          </select>
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <ContractDateField
            id={`contract-start-${mode}`}
            label={labels.fields.startDate}
            value={startDate}
            hint={labels.form.dateHint}
            disabled={mode === "renew"}
            required
            error={dateError}
            onChange={setStartDate}
          />
          <ContractDateField
            id={`contract-end-${mode}`}
            label={labels.fields.endDate}
            value={endDate}
            hint={indefinite ? labels.form.noEndDate : labels.form.dateHint}
            disabled={indefinite}
            required={!indefinite}
            error={dateError}
            onChange={setEndDate}
          />
        </div>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-[var(--color-text-secondary)]">
            {labels.fields.notes}
          </span>
          <textarea
            value={notes}
            maxLength={1000}
            onChange={(event) => setNotes(event.target.value)}
            className="min-h-24 w-full rounded-xl border border-[var(--color-border-subtle)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-border-focus)]"
          />
        </label>
        {canUploadPdf ? (
          <label className="block rounded-xl border border-dashed border-blue-200 bg-blue-50/40 p-3">
            <span className="flex items-center gap-2 text-xs font-semibold text-[var(--color-text-secondary)]">
              <Paperclip size={14} />
              {labels.documents.title}
            </span>
            <input
              key={submissionId}
              type="file"
              accept="application/pdf,.pdf"
              onChange={(event) => {
                setDateError(null);
                setPdfFile(event.target.files?.[0] ?? null);
              }}
              className="mt-2 block w-full text-xs text-[var(--color-text-secondary)] file:mr-3 file:rounded-full file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-blue-700"
            />
            <span className="mt-1.5 block text-xxs text-[var(--color-text-muted)]">
              {pdfFile ? pdfFile.name : labels.documents.uploadHint}
            </span>
          </label>
        ) : null}
        <button
          type="submit"
          disabled={isSubmitting}
          className="h-10 w-full rounded-full bg-[var(--color-brand-primary)] px-4 text-sm font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
        >
          {labels.actions.save}
        </button>
      </form>
    </EmployeeContractSheet>
  );
}
