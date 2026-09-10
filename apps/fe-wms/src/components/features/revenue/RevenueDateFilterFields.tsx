"use client";

import type {
  RevenueCompareMode,
  RevenueComparisonSelection,
  RevenueDashboardFilter,
} from "@/hooks/useRevenueDashboard";
import type { useTranslation } from "@/lib/i18n";

import {
  RevenueComparisonChips,
  RevenueDateInput,
  RevenueMultiValueInput,
} from "./RevenueDateInputs";

type RevenueFilterLabels = ReturnType<
  typeof useTranslation
>["t"]["revenue"]["filters"];

export function RevenueFilterDateFields({
  filter,
  labels,
  onChange,
}: {
  filter: RevenueDashboardFilter;
  labels: RevenueFilterLabels;
  onChange: (patch: Partial<RevenueDashboardFilter>) => void;
}) {
  if (filter.mode === "date") {
    return (
      <RevenueDateInput
        label={labels.date}
        type="date"
        value={filter.date}
        onChange={(date) => onChange({ date })}
      />
    );
  }
  if (filter.mode === "month") {
    return (
      <RevenueDateInput
        label={labels.month}
        type="month"
        value={filter.month}
        onChange={(month) => onChange({ month })}
      />
    );
  }
  if (filter.mode === "year") {
    return (
      <RevenueDateInput
        label={labels.year}
        type="number"
        value={filter.year}
        onChange={(year) => onChange({ year })}
      />
    );
  }
  if (filter.mode === "custom") {
    return (
      <div className="flex w-full gap-2 md:w-auto">
        <RevenueDateInput
          label={labels.startDate}
          type="date"
          value={filter.startDate}
          onChange={(startDate) => onChange({ startDate })}
        />
        <RevenueDateInput
          label={labels.endDate}
          type="date"
          value={filter.endDate}
          onChange={(endDate) => onChange({ endDate })}
        />
      </div>
    );
  }
  return null;
}

export function RevenueComparisonDateFields({
  mode,
  comparison,
  labels,
  onChange,
  onCommit,
}: {
  mode: RevenueCompareMode;
  comparison: RevenueComparisonSelection;
  labels: RevenueFilterLabels;
  onChange: (patch: Partial<RevenueComparisonSelection>) => void;
  onCommit: (value?: string) => void;
}) {
  if (mode === "date" || mode === "month" || mode === "year") {
    return (
      <RevenueMultiValueInput
        label={labels[mode]}
        type={mode === "year" ? "number" : mode}
        value={comparison[mode]}
        onChange={(value) => onChange({ [mode]: value })}
        onCommit={onCommit}
      />
    );
  }
  if (mode === "custom") {
    return (
      <div className="flex w-full gap-2 md:w-auto">
        <RevenueDateInput
          label={labels.startDate}
          type="date"
          value={comparison.startDate}
          onChange={(startDate) => onChange({ startDate })}
        />
        <RevenueDateInput
          label={labels.endDate}
          type="date"
          value={comparison.endDate}
          onChange={(endDate) => onChange({ endDate })}
        />
      </div>
    );
  }
  return null;
}

export function RevenueActiveComparisonChips({
  mode,
  comparison,
  onRemove,
}: {
  mode: RevenueCompareMode;
  comparison: RevenueComparisonSelection;
  onRemove: (mode: RevenueCompareMode, value: string) => void;
}) {
  const values =
    mode === "date"
      ? comparison.dates
      : mode === "month"
        ? comparison.months
        : mode === "year"
          ? comparison.years
          : [];
  if (values.length === 0) return null;
  return (
    <RevenueComparisonChips
      values={values}
      onRemove={(value) => onRemove(mode, value)}
    />
  );
}
