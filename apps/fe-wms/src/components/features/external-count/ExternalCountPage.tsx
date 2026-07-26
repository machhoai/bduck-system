"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ClipboardList,
  Search,
  Settings2,
} from "lucide-react";
import { gooeyToast } from "goey-toast";
import {
  externalCountApi,
  type ExternalCountRequirementConfig,
} from "@/api/externalCountApi";
import { useTranslation } from "@/lib/i18n";
import { useExternalCountSessions } from "@/hooks/useExternalCountSessions";
import { useWarehouseLocations, useWarehouses } from "@/hooks/useWarehouses";
import { useUserStore } from "@/stores/useUserStore";
import ExternalCountDetail from "./ExternalCountDetail";
import {
  FilterSelect,
  Metric,
  ToggleRow,
} from "./ExternalCountPageControls";
import ExternalCountSessionList from "./ExternalCountSessionList";
import { externalCountPageCopy } from "./externalCountPageCopy";
import {
  getExternalCountExecutionTime,
  toExternalCountMillis,
} from "./externalCountFormatters";

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

export default function ExternalCountPage() {
  const { lang } = useTranslation();
  const text = externalCountPageCopy[lang] ?? externalCountPageCopy.vi;
  const hasPermission = useUserStore((state) => state.hasPermission);
  const canConfigure = hasPermission("external_count.count");
  const { warehouses } = useWarehouses();
  const [warehouseId, setWarehouseId] = useState("");
  const { locations } = useWarehouseLocations(warehouseId || undefined);
  const [locationId, setLocationId] = useState("");
  const [businessDate, setBusinessDate] = useState(todayString());
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    null,
  );
  const { sessions, isLoading } = useExternalCountSessions(
    warehouseId || undefined,
  );
  const [isSaving, setIsSaving] = useState(false);
  const [config, setConfig] = useState<ExternalCountRequirementConfig | null>(null);

  const warehouseById = useMemo(
    () => new Map(warehouses.map((warehouse) => [warehouse.id, warehouse])),
    [warehouses],
  );
  const locationById = useMemo(
    () => new Map(locations.map((location) => [location.id, location])),
    [locations],
  );

  const loadConfig = useCallback(async () => {
    try {
      const response = await externalCountApi.getRequirement();
      setConfig(response.data);
    } catch (error) {
      console.error("[ExternalCountPage] load config failed", error);
      gooeyToast.error(text.configLoadError, {
        description: text.configLoadErrorDescription,
        preset: "snappy",
      });
    }
  }, [text.configLoadError, text.configLoadErrorDescription]);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  const visibleSessions = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return [...sessions]
      .sort(
        (a, b) =>
          toExternalCountMillis(getExternalCountExecutionTime(b)) -
          toExternalCountMillis(getExternalCountExecutionTime(a)),
      )
      .filter((session) => !warehouseId || session.warehouse_id === warehouseId)
      .filter((session) => !locationId || session.warehouse_location_id === locationId)
      .filter((session) => !businessDate || session.business_date === businessDate)
      .filter((session) => {
        if (!q) return true;
        const warehouse = warehouseById.get(session.warehouse_id);
        const location = session.warehouse_location_id
          ? locationById.get(session.warehouse_location_id)
          : null;
        return [
          session.session_number,
          session.status,
          session.external_operator_name,
          session.external_client_id,
          session.idempotency_key,
          warehouse?.name,
          warehouse?.code,
          location?.name,
          location?.code,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(q));
      });
  }, [businessDate, locationById, locationId, searchTerm, sessions, warehouseById, warehouseId]);

  const summary = useMemo(
    () => ({
      total: visibleSessions.length,
      verified: visibleSessions.filter((session) => session.status === "VERIFIED").length,
      issues: visibleSessions.filter((session) => session.status === "DISCREPANCY_FOUND").length,
    }),
    [visibleSessions],
  );

  const saveConfig = async () => {
    if (!config) return;
    if (!canConfigure) {
      gooeyToast.error(text.noPermission);
      return;
    }

    setIsSaving(true);
    const action = externalCountApi.updateRequirement({
      enabled: config.enabled,
      require_before_scan: config.require_before_scan,
      require_before_submit: config.require_before_submit,
    });
    gooeyToast.promise(action, {
      loading: text.saving,
      success: text.saved,
      error: text.saveError,
      description: {
        success: text.saveDesc,
        error: text.saveErrorDesc,
      },
      action: { error: { label: text.retry, onClick: saveConfig } },
    });
    try {
      const response = await action;
      setConfig(response.data);
    } catch (error) {
      console.error("[ExternalCountPage] save config failed", error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100dvh-112px)] flex-col gap-3 bg-[var(--color-surface-subtle)] p-3 sm:bg-transparent sm:p-0">
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="rounded-lg border border-[var(--color-border-subtle)] bg-white p-4">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-[var(--color-brand-primary)]" />
            <h1 className="text-lg font-bold text-[var(--color-text-primary)]">{text.title}</h1>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <Metric label={text.total} value={summary.total} />
            <Metric label={text.verified} value={summary.verified} tone="success" />
            <Metric label={text.issues} value={summary.issues} tone="warning" />
          </div>
        </div>

        <div className="rounded-lg border border-[var(--color-border-subtle)] bg-white p-4">
          <div className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-[var(--color-brand-primary)]" />
            <h2 className="text-sm font-bold text-[var(--color-text-primary)]">{text.configTitle}</h2>
          </div>
          <div className="mt-3 grid gap-2">
            <ToggleRow
              label={text.enabled}
              checked={config?.enabled ?? false}
              disabled={!canConfigure}
              onChange={(checked) => setConfig((prev) => prev ? { ...prev, enabled: checked } : prev)}
            />
            <ToggleRow
              label={text.beforeScan}
              checked={config?.require_before_scan ?? true}
              disabled={!canConfigure || !config?.enabled}
              onChange={(checked) => setConfig((prev) => prev ? { ...prev, require_before_scan: checked } : prev)}
            />
            <ToggleRow
              label={text.beforeSubmit}
              checked={config?.require_before_submit ?? true}
              disabled={!canConfigure || !config?.enabled}
              onChange={(checked) => setConfig((prev) => prev ? { ...prev, require_before_submit: checked } : prev)}
            />
            <button
              type="button"
              onClick={saveConfig}
              disabled={isSaving || !canConfigure}
              className="mt-1 inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[var(--color-brand-primary)] px-4 text-sm font-semibold text-white disabled:opacity-50"
            >
              <CheckCircle2 className="h-4 w-4" />
              {text.save}
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-[var(--color-border-subtle)] bg-white p-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(180px,1fr)_minmax(180px,1fr)_160px_minmax(220px,1.2fr)]">
          <FilterSelect
            label={text.warehouse}
            value={warehouseId}
            onChange={(value) => {
              setWarehouseId(value);
              setLocationId("");
            }}
            options={warehouses.map((warehouse) => ({
              value: warehouse.id,
              label: warehouse.name || warehouse.code,
            }))}
            allLabel={text.all}
          />
          <FilterSelect
            label={text.location}
            value={locationId}
            onChange={setLocationId}
            options={locations.map((location) => ({
              value: location.id,
              label: location.name || location.code,
            }))}
            allLabel={text.all}
          />
          <label className="grid gap-1">
            <span className="text-xs font-semibold uppercase text-[var(--color-text-muted)]">{text.date}</span>
            <input
              type="date"
              value={businessDate}
              onChange={(event) => setBusinessDate(event.target.value)}
              className="h-10 rounded-md border border-[var(--color-border-subtle)] px-3 text-sm outline-none focus:border-[var(--color-border-focus)]"
            />
          </label>
          <label className="grid gap-1">
            <span className="text-xs font-semibold uppercase text-[var(--color-text-muted)]">
              {text.searchLabel}
            </span>
            <span className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder={text.search}
                className="h-10 w-full rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-neutral-50)] pl-9 pr-3 text-sm outline-none focus:border-[var(--color-border-focus)]"
              />
            </span>
          </label>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-[var(--color-border-subtle)] bg-white">
        <ExternalCountSessionList
          sessions={visibleSessions}
          isLoading={isLoading}
          warehouseById={warehouseById}
          locationById={locationById}
          lang={lang}
          text={text}
          onSelect={setSelectedSessionId}
        />
      </div>
      {selectedSessionId && (
        <ExternalCountDetail
          sessionId={selectedSessionId}
          onClose={() => setSelectedSessionId(null)}
        />
      )}
    </div>
  );
}
