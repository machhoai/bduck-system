export function formatMaybeDate(value: unknown, emptyLabel: string) {
  if (!value) return emptyLabel;
  const raw = value as { toDate?: () => Date; seconds?: number; _seconds?: number };
  const date =
    typeof raw.toDate === "function"
      ? raw.toDate()
      : typeof raw.seconds === "number"
        ? new Date(raw.seconds * 1000)
        : typeof raw._seconds === "number"
          ? new Date(raw._seconds * 1000)
          : new Date(value as string);

  if (Number.isNaN(date.getTime())) return emptyLabel;
  return date.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Ho_Chi_Minh",
  });
}

export function valueOrEmpty(
  value: string | null | undefined,
  emptyLabel: string,
) {
  return value?.trim() || emptyLabel;
}

export function buildAdminProfileFields(
  labels: Record<string, string>,
  profile: ExtendedEmployeeProfile | null,
  warehouse: Warehouse | null,
  emptyLabel: string,
) {
  return [
    {
      label: labels.employeeCode,
      value: valueOrEmpty(profile?.employee_code, emptyLabel),
    },
    {
      label: labels.fullName,
      value: valueOrEmpty(profile?.full_name, emptyLabel),
    },
    {
      label: labels.department,
      value: valueOrEmpty(profile?.department, emptyLabel),
    },
    {
      label: labels.jobTitle,
      value: valueOrEmpty(profile?.job_title, emptyLabel),
    },
    { label: labels.workplace, value: warehouse?.name || emptyLabel },
    {
      label: labels.socialInsuranceCode,
      value: valueOrEmpty(profile?.social_insurance_code, emptyLabel),
    },
    {
      label: labels.probationStartDate,
      value: formatMaybeDate(profile?.probation_start_date, emptyLabel),
    },
    {
      label: labels.probationEndDate,
      value: formatMaybeDate(profile?.probation_end_date, emptyLabel),
    },
    {
      label: labels.officialStartDate,
      value: formatMaybeDate(profile?.official_start_date, emptyLabel),
    },
    {
      label: labels.resignationDate,
      value: formatMaybeDate(profile?.resignation_date, emptyLabel),
    },
  ];
}
import type { Warehouse } from "@bduck/shared-types";
import type { ExtendedEmployeeProfile } from "./AdminOverviewTab.types";
