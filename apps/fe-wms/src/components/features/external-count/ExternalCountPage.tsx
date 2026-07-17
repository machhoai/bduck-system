"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Search,
  Settings2,
} from "lucide-react";
import { gooeyToast } from "goey-toast";
import {
  externalCountApi,
  type ExternalCountRequirementConfig,
  type ExternalCountSession,
} from "@/api/externalCountApi";
import { useTranslation } from "@/lib/i18n";
import { useExternalCountSessions } from "@/hooks/useExternalCountSessions";
import { useWarehouseLocations, useWarehouses } from "@/hooks/useWarehouses";
import { useUserStore } from "@/stores/useUserStore";

const copy = {
  vi: {
    title: "Kiểm đếm external",
    configTitle: "Cấu hình bắt buộc kiểm đếm",
    enabled: "Bật kiểm đếm external",
    beforeScan: "Yêu cầu BEFORE_SCAN trước khi quét",
    beforeSubmit: "Yêu cầu BEFORE_SUBMIT trước khi nộp",
    save: "Lưu cấu hình",
    saving: "Đang lưu cấu hình...",
    saved: "Đã lưu cấu hình",
    saveError: "Không thể lưu cấu hình",
    saveDesc: "Luồng quét ngoài sẽ áp dụng cấu hình mới ngay.",
    saveErrorDesc: "Vui lòng kiểm tra quyền hoặc thử lại sau.",
    warehouse: "Kho",
    location: "Quầy",
    date: "Ngày",
    businessDate: "Ngày nghiệp vụ",
    performedAt: "Thời gian thực hiện",
    all: "Tất cả",
    search: "Tìm theo mã checkpoint, quầy, kho hoặc nhân viên...",
    emptyTitle: "Chưa có checkpoint kiểm đếm",
    emptyHint: "Hệ thống ngoài gửi POST /api/external/v1/count để tạo dữ liệu ở đây.",
    total: "Tổng checkpoint",
    verified: "Hợp lệ",
    issues: "Có chênh lệch",
    beforeScanLabel: "Trước khi quét",
    beforeSubmitLabel: "Trước khi nộp",
    operator: "Nhân viên",
    client: "Client",
    discrepancy: "Chênh lệch",
    idempotency: "Idempotency",
    noPermission: "Bạn không có quyền chỉnh cấu hình kiểm đếm external.",
  },
  zh: {
    title: "外部盘点",
    configTitle: "外部盘点要求",
    enabled: "启用外部盘点",
    beforeScan: "扫描前需要 BEFORE_SCAN",
    beforeSubmit: "提交前需要 BEFORE_SUBMIT",
    save: "保存配置",
    saving: "正在保存配置...",
    saved: "配置已保存",
    saveError: "无法保存配置",
    saveDesc: "外部扫描流程会立即使用新配置。",
    saveErrorDesc: "请检查权限或稍后重试。",
    warehouse: "仓库",
    location: "柜台",
    date: "日期",
    businessDate: "业务日期",
    performedAt: "执行时间",
    all: "全部",
    search: "按检查点、柜台、仓库或员工搜索...",
    emptyTitle: "暂无盘点检查点",
    emptyHint: "外部系统通过 POST /api/external/v1/count 提交数据。",
    total: "检查点总数",
    verified: "有效",
    issues: "有差异",
    beforeScanLabel: "扫描前",
    beforeSubmitLabel: "提交前",
    operator: "操作员",
    client: "客户端",
    discrepancy: "差异",
    idempotency: "幂等键",
    noPermission: "您没有权限修改外部盘点配置。",
  },
};

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function toMillis(value: unknown) {
  if (!value) return 0;
  if (typeof value === "string") return new Date(value).getTime();
  if (value instanceof Date) return value.getTime();
  if (
    typeof value === "object" &&
    "toDate" in value &&
    typeof (value as { toDate: unknown }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate().getTime();
  }
  if (typeof value === "object") {
    const timestamp = value as { seconds?: unknown; _seconds?: unknown };
    const seconds =
      typeof timestamp.seconds === "number"
        ? timestamp.seconds
        : typeof timestamp._seconds === "number"
          ? timestamp._seconds
          : null;
    if (seconds !== null) return seconds * 1000;
  }
  return 0;
}

function executionTime(session: ExternalCountSession) {
  return session.action_time || session.submitted_at || session.created_at;
}

function formatExecutionTime(value: unknown, lang: "vi" | "zh") {
  const milliseconds = toMillis(value);
  if (!milliseconds) return { date: "-", time: "-" };
  const date = new Date(milliseconds);
  const locale = lang === "zh" ? "zh-CN" : "vi-VN";
  return {
    date: new Intl.DateTimeFormat(locale, {
      timeZone: "Asia/Ho_Chi_Minh",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(date),
    time: new Intl.DateTimeFormat(locale, {
      timeZone: "Asia/Ho_Chi_Minh",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(date),
  };
}

function formatBusinessDate(value: string, lang: "vi" | "zh") {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value || "-";
  return new Intl.DateTimeFormat(lang === "zh" ? "zh-CN" : "vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function statusClass(status: string) {
  if (status === "VERIFIED") {
    return "border-[var(--color-success-border)] bg-[var(--color-success-bg)] text-[var(--color-success-text)]";
  }
  if (status === "DISCREPANCY_FOUND") {
    return "border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] text-[var(--color-warning-text)]";
  }
  return "border-[var(--color-status-pending-border)] bg-[var(--color-status-pending-bg)] text-[var(--color-status-pending-text)]";
}

export default function ExternalCountPage() {
  const { lang } = useTranslation();
  const text = copy[lang] ?? copy.vi;
  const hasPermission = useUserStore((state) => state.hasPermission);
  const canConfigure = hasPermission("external_count.count");
  const { warehouses } = useWarehouses();
  const [warehouseId, setWarehouseId] = useState("");
  const { locations } = useWarehouseLocations(warehouseId || undefined);
  const [locationId, setLocationId] = useState("");
  const [businessDate, setBusinessDate] = useState(todayString());
  const [searchTerm, setSearchTerm] = useState("");
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
    const response = await externalCountApi.getRequirement();
    setConfig(response.data);
  }, []);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  const visibleSessions = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return [...sessions]
      .sort((a, b) => toMillis(executionTime(b)) - toMillis(executionTime(a)))
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
      action: { error: { label: "Retry", onClick: saveConfig } },
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
            <span className="text-xs font-semibold uppercase text-[var(--color-text-muted)]">Search</span>
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
        {isLoading ? (
          <div className="grid gap-3 p-4">
            {[1, 2, 3].map((item) => (
              <div key={item} className="h-20 animate-pulse rounded-lg bg-[var(--color-neutral-100)]" />
            ))}
          </div>
        ) : visibleSessions.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center gap-2 text-center">
            <ClipboardList className="h-10 w-10 text-[var(--color-neutral-300)]" />
            <h3 className="text-base font-semibold text-[var(--color-text-primary)]">{text.emptyTitle}</h3>
            <p className="text-sm text-[var(--color-text-muted)]">{text.emptyHint}</p>
          </div>
        ) : (
          <div className="grid gap-3 p-3">
            {visibleSessions.map((session) => {
              const warehouse = warehouseById.get(session.warehouse_id);
              const location = session.warehouse_location_id
                ? locationById.get(session.warehouse_location_id)
                : null;
              const checkpointLabel =
                session.checkpoint_type === "BEFORE_SCAN"
                  ? text.beforeScanLabel
                  : text.beforeSubmitLabel;
              const performedAt = formatExecutionTime(executionTime(session), lang);

              return (
                <div key={session.id} className="rounded-lg border border-[var(--color-border-subtle)] bg-white p-4">
                  <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${statusClass(session.status)}`}>
                          {session.status}
                        </span>
                        <span className="inline-flex rounded-full border border-[var(--color-border-subtle)] px-2 py-0.5 text-xs font-semibold text-[var(--color-text-secondary)]">
                          {checkpointLabel}
                        </span>
                        {session.status === "DISCREPANCY_FOUND" && (
                          <AlertTriangle className="h-4 w-4 text-[var(--color-warning-text)]" />
                        )}
                        <span className="truncate text-sm font-bold text-[var(--color-text-primary)]">
                          {location?.name || location?.code || session.warehouse_location_id}
                        </span>
                      </div>
                      <div className="mt-2 grid gap-2 text-sm text-[var(--color-text-secondary)] md:grid-cols-4">
                        <span className="truncate">{warehouse?.name || warehouse?.code || session.warehouse_id}</span>
                        <span className="truncate">{text.operator}: {session.external_operator_name || session.external_operator_id || "-"}</span>
                        <span className="truncate">{text.client}: {session.external_client_id || "-"}</span>
                        <span>{text.discrepancy}: {session.discrepancy_count ?? 0}</span>
                      </div>
                      <p className="mt-2 truncate text-xs text-[var(--color-text-muted)]">
                        {session.session_number} · {text.idempotency}: {session.idempotency_key || "-"}
                      </p>
                    </div>
                    <div className="min-w-[190px] rounded-md border border-[var(--color-border-soft)] bg-[var(--color-neutral-50)] px-3 py-2.5">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
                        {text.performedAt}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-semibold text-[var(--color-text-primary)]">
                        <span className="inline-flex items-center gap-1.5">
                          <CalendarDays className="h-4 w-4 text-[var(--color-brand-primary)]" />
                          {performedAt.date}
                        </span>
                        <span className="inline-flex items-center gap-1.5 tabular-nums">
                          <Clock3 className="h-4 w-4 text-[var(--color-brand-primary)]" />
                          {performedAt.time}
                        </span>
                      </div>
                      <p className="mt-1.5 text-[11px] text-[var(--color-text-muted)]">
                        {text.businessDate}: {formatBusinessDate(session.business_date, lang)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "success" | "warning";
}) {
  const toneClass =
    tone === "success"
      ? "text-[var(--color-success-text)]"
      : tone === "warning"
        ? "text-[var(--color-warning-text)]"
        : "text-[var(--color-text-primary)]";
  return (
    <div className="rounded-lg border border-[var(--color-border-soft)] bg-white px-3 py-2">
      <p className="text-xs font-semibold uppercase text-[var(--color-text-muted)]">{label}</p>
      <p className={`mt-1 text-lg font-bold ${toneClass}`}>{value.toLocaleString()}</p>
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex min-h-10 items-center justify-between gap-3 rounded-md border border-[var(--color-border-subtle)] px-3 text-sm font-semibold text-[var(--color-text-secondary)]">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  allLabel,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  allLabel: string;
}) {
  return (
    <label className="grid gap-1">
      <span className="text-xs font-semibold uppercase text-[var(--color-text-muted)]">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 rounded-md border border-[var(--color-border-subtle)] px-3 text-sm outline-none focus:border-[var(--color-border-focus)]"
      >
        <option value="">{allLabel}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
