"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  Boxes,
  CalendarDays,
  Download,
  FileInput,
  FileOutput,
  Table2,
  X,
} from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { WAREHOUSE_EXPORT_MODAL_TEXT } from "@/lib/i18n/componentTranslations";
import type {
  ExportDataKind,
  ExportDateMode,
  ExportDialogConfig,
  ExportRequestOptions,
} from "@/utils/exportExcel";

interface WarehouseExportModalProps {
  isOpen: boolean;
  config: ExportDialogConfig;
  isExporting: boolean;
  onClose: () => void;
  onSubmit: (options: ExportRequestOptions) => Promise<void>;
}

const today = () => new Date().toISOString().slice(0, 10);
const thisMonth = () => new Date().toISOString().slice(0, 7);

export function WarehouseExportModal({
  isOpen,
  config,
  isExporting,
  onClose,
  onSubmit,
}: WarehouseExportModalProps) {
  const { lang } = useTranslation();
  const copy = WAREHOUSE_EXPORT_MODAL_TEXT[lang === "zh" ? "zh" : "vi"];
  const defaults = config.defaultOptions;
  const [dataKind, setDataKind] = useState<ExportDataKind>(
    defaults?.dataKind ?? "movement",
  );
  const [dateMode, setDateMode] = useState<ExportDateMode>(
    defaults?.dateMode ?? "month",
  );
  const [date, setDate] = useState(defaults?.date ?? today());
  const [month, setMonth] = useState(defaults?.month ?? thisMonth());
  const [dateFrom, setDateFrom] = useState(defaults?.dateFrom ?? today());
  const [dateTo, setDateTo] = useState(defaults?.dateTo ?? today());
  const [productSearch, setProductSearch] = useState(
    defaults?.productSearch ?? "",
  );
  const [categoryId, setCategoryId] = useState(
    defaults?.categoryId ?? "all",
  );
  const [productType, setProductType] = useState(
    defaults?.productType ?? "all",
  );
  const [productOrigin, setProductOrigin] = useState(
    defaults?.productOrigin ?? "all",
  );
  const [serialized, setSerialized] = useState(
    defaults?.serialized ?? "all",
  );
  const [productUnit, setProductUnit] = useState(
    defaults?.productUnit ?? "all",
  );
  const [productMaterial, setProductMaterial] = useState(
    defaults?.productMaterial ?? "all",
  );
  const [locationId, setLocationId] = useState(
    defaults?.locationId ?? "all",
  );
  const [slotId, setSlotId] = useState(defaults?.slotId ?? "all");

  const filterOptions = config.filterOptions ?? {};
  const categoryOptions = filterOptions.categories ?? [];
  const locationOptions = filterOptions.locations ?? [];
  const unitOptions = filterOptions.units ?? [];
  const materialOptions = filterOptions.materials ?? [];
  const visibleSlotOptions = (filterOptions.slots ?? []).filter(
    (slot) => locationId === "all" || slot.parentId === locationId,
  );

  const dataOptions = useMemo(
    () => [
      { value: "movement" as const, label: copy.movement, icon: Boxes },
      { value: "dailySummary" as const, label: copy.dailySummary, icon: Table2 },
      {
        value: "counterDailySummary" as const,
        label: copy.counterDailySummary,
        icon: Table2,
      },
      { value: "imports" as const, label: copy.imports, icon: FileInput },
      { value: "exports" as const, label: copy.exports, icon: FileOutput },
      { value: "inventory" as const, label: copy.inventory, icon: Boxes },
    ],
    [copy],
  );

  const dateOptions = useMemo(
    () => [
      { value: "date" as const, label: copy.date },
      { value: "month" as const, label: copy.month },
      { value: "range" as const, label: copy.range },
    ],
    [copy],
  );

  if (!isOpen) return null;

  const submit = async () => {
    await onSubmit({
      dataKind,
      dateMode,
      date,
      month,
      dateFrom,
      dateTo,
      productSearch,
      categoryId,
      productType,
      productOrigin,
      serialized,
      productUnit,
      productMaterial,
      locationId,
      slotId,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-[720px] max-w-[94%] overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] shadow-xl">
        <div className="flex items-center justify-between border-b border-[var(--color-border-subtle)] p-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
              {config.title}
            </h2>
            {config.description && (
              <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                {config.description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-card)] hover:text-[var(--color-text-primary)]"
            title={copy.cancel}
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex max-h-[calc(90vh-112px)] flex-col gap-3 overflow-y-auto p-3">
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-[var(--color-text-secondary)]">
              {copy.data}
            </span>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {dataOptions.map((option) => {
                const Icon = option.icon;
                const active = dataKind === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setDataKind(option.value)}
                    className={`flex h-8 items-center justify-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-colors ${
                      active
                        ? "border-[var(--color-brand-primary)] bg-[var(--color-brand-primary)] text-white"
                        : "border-[var(--color-border-subtle)] bg-white text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-card)]"
                    }`}
                  >
                    <Icon size={15} />
                    <span>{option.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {dataKind === "inventory" ? (
            <div className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-pearl)] p-2 text-xs text-[var(--color-text-muted)]">
              {copy.noDateNeeded}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold text-[var(--color-text-secondary)]">
                {copy.time}
              </span>
              <div className="grid grid-cols-3 gap-2">
                {dateOptions.map((option) => {
                  const active = dateMode === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setDateMode(option.value)}
                      className={`flex h-8 items-center justify-center gap-1 rounded-full border px-2 text-sm font-medium transition-colors ${
                        active
                          ? "border-[var(--color-brand-primary)] bg-[var(--color-brand-primary)] text-white"
                          : "border-[var(--color-border-subtle)] bg-white text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-card)]"
                      }`}
                    >
                      <CalendarDays size={14} />
                      <span>{option.label}</span>
                    </button>
                  );
                })}
              </div>

              {dateMode === "date" && (
                <input
                  type="date"
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                  className="h-8 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-white px-3 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-brand-primary)]"
                />
              )}

              {dateMode === "month" && (
                <input
                  type="month"
                  value={month}
                  onChange={(event) => setMonth(event.target.value)}
                  className="h-8 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-white px-3 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-brand-primary)]"
                />
              )}

              {dateMode === "range" && (
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-[var(--color-text-muted)]">
                      {copy.from}
                    </span>
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(event) => setDateFrom(event.target.value)}
                      className="h-8 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-white px-3 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-brand-primary)]"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-[var(--color-text-muted)]">
                      {copy.to}
                    </span>
                    <input
                      type="date"
                      value={dateTo}
                      onChange={(event) => setDateTo(event.target.value)}
                      className="h-8 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-white px-3 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-brand-primary)]"
                    />
                  </label>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-pearl)] p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-[var(--color-text-secondary)]">
                {copy.filters}
              </span>
              <button
                type="button"
                onClick={() => {
                  setProductSearch("");
                  setCategoryId("all");
                  setProductType("all");
                  setProductOrigin("all");
                  setSerialized("all");
                  setProductUnit("all");
                  setProductMaterial("all");
                  setLocationId("all");
                  setSlotId("all");
                }}
                className="text-xs font-medium text-[var(--color-brand-primary)] hover:underline"
              >
                {copy.clearFilters}
              </button>
            </div>

            <input
              type="text"
              value={productSearch}
              onChange={(event) => setProductSearch(event.target.value)}
              placeholder={copy.productSearch}
              className="h-8 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-white px-3 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-brand-primary)]"
            />

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <SelectField
                label={copy.category}
                value={categoryId}
                onChange={setCategoryId}
              >
                <option value="all">{copy.allCategories}</option>
                {categoryOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </SelectField>

              <SelectField
                label={copy.productType}
                value={productType}
                onChange={setProductType}
              >
                <option value="all">{copy.allTypes}</option>
                <option value="EQUIPMENT">EQUIPMENT</option>
                <option value="SOUVENIR_SALE">SOUVENIR_SALE</option>
                <option value="SOUVENIR_GIFT">SOUVENIR_GIFT</option>
              </SelectField>

              <SelectField
                label={copy.origin}
                value={productOrigin}
                onChange={setProductOrigin}
              >
                <option value="all">{copy.allOrigins}</option>
                <option value="DOMESTIC">DOMESTIC</option>
                <option value="INTERNATIONAL">INTERNATIONAL</option>
              </SelectField>

              <SelectField
                label={copy.serialized}
                value={serialized}
                onChange={(value) =>
                  setSerialized(value as typeof serialized)
                }
              >
                <option value="all">{copy.allSerialized}</option>
                <option value="serialized">{copy.serializedOnly}</option>
                <option value="standard">{copy.standardOnly}</option>
              </SelectField>

              <SelectField
                label={copy.unit}
                value={productUnit}
                onChange={setProductUnit}
              >
                <option value="all">{copy.allUnits}</option>
                {unitOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </SelectField>

              <SelectField
                label={copy.material}
                value={productMaterial}
                onChange={setProductMaterial}
              >
                <option value="all">{copy.allMaterials}</option>
                {materialOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </SelectField>

              <SelectField
                label={copy.location}
                value={locationId}
                onChange={(value) => {
                  setLocationId(value);
                  setSlotId("all");
                }}
              >
                <option value="all">{copy.allLocations}</option>
                {locationOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </SelectField>

              <SelectField label={copy.slot} value={slotId} onChange={setSlotId}>
                <option value="all">{copy.allSlots}</option>
                {visibleSlotOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </SelectField>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[var(--color-border-subtle)] p-3">
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 items-center justify-center rounded-full border border-[var(--color-border-subtle)] bg-white px-3 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-card)]"
          >
            {copy.cancel}
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={isExporting}
            className="flex h-8 items-center justify-center gap-1.5 rounded-full bg-green-600 px-3 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-50"
          >
            <Download size={15} />
            <span>{isExporting ? copy.exporting : copy.export}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-xs text-[var(--color-text-muted)]">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-8 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-white px-3 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-brand-primary)]"
      >
        {children}
      </select>
    </label>
  );
}
