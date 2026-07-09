"use client";

import { Save, ShieldCheck, TestTube2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { gooeyToast } from "goey-toast";
import { useOpenApiConfig, type OpenApiConfigPayload } from "@/hooks/useOpenApiConfig";
import { useWarehouses } from "@/hooks/useWarehouses";
import { useUserStore } from "@/stores/useUserStore";
import { useTranslation } from "@/lib/i18n";
import Forbidden403 from "@/components/shared/Forbidden403";
import SystemSettingsSkeleton from "./SystemSettingsSkeleton";

const DEFAULT_VERSION = "10.11.8";
const OPENAPI_ACTION_VERSION_ROWS = [
  {
    action: "report_revenue_summary",
    label: "Doanh thu",
    defaultVersion: "10.11.8",
  },
  {
    action: "report_sell_statistics_bygoodstype",
    label: "Thong ke hang ban",
    defaultVersion: "10.11.8",
  },
  {
    action: "setmeal_getsellgoods",
    label: "Danh sach ve",
    defaultVersion: "11.7.1",
  },
  {
    action: "setmeal_passticket_list",
    label: "Danh sach goi ve",
    defaultVersion: "11.7.1",
  },
  {
    action: "oversea_subscribe_base_list",
    label: "Goi dat cho",
    defaultVersion: "11.7.1",
  },
  {
    action: "oversea_goodsmanage_list",
    label: "Hang add-on",
    defaultVersion: "11.7.1",
  },
  {
    action: "gift_type",
    label: "Nhom luu niem",
    defaultVersion: "10.11.8",
  },
  {
    action: "gift_realtime_stock",
    label: "Ton kho luu niem",
    defaultVersion: "10.11.8",
  },
  {
    action: "member_getmember_membercode",
    label: "Hoi vien theo ma the",
    defaultVersion: "10.11.8",
  },
  {
    action: "member_getmember_serialnumber",
    label: "Hoi vien theo serial",
    defaultVersion: "10.11.8",
  },
  {
    action: "order_precalculate",
    label: "Tinh truoc don",
    defaultVersion: "11.7.1",
  },
  {
    action: "order_create",
    label: "Tao don hang",
    defaultVersion: "11.7.1",
  },
  {
    action: "order_pay",
    label: "Thanh toan",
    defaultVersion: "11.7.1",
  },
  {
    action: "order_pay_query",
    label: "Trang thai thanh toan",
    defaultVersion: "11.7.1",
  },
];

const getDefaultActionVersions = () =>
  OPENAPI_ACTION_VERSION_ROWS.reduce<Record<string, string>>((acc, row) => {
    acc[row.action] = row.defaultVersion;
    return acc;
  }, {});

export default function SystemSettingsPage() {
  const { t } = useTranslation();
  const canConfig = useUserStore((state) => state.hasPermission("system.config"));
  const { warehouses, loading: warehousesLoading } = useWarehouses();
  const [selectedWarehouseId, setSelectedWarehouseId] = useState("");
  const activeWarehouseId = selectedWarehouseId || warehouses[0]?.id || "";
  const { config, loading, error, saveConfig, testConfig } = useOpenApiConfig(activeWarehouseId);
  const [form, setForm] = useState<OpenApiConfigPayload>({
    app_id: "",
    secret_key: "",
    base_url: "",
    api_version: DEFAULT_VERSION,
    action_versions: getDefaultActionVersions(),
    enabled: true,
  });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const selectedWarehouse = useMemo(
    () => warehouses.find((warehouse) => warehouse.id === activeWarehouseId),
    [activeWarehouseId, warehouses],
  );

  useEffect(() => {
    setForm({
      app_id: config?.app_id || "",
      secret_key: "",
      base_url: config?.base_url || "",
      api_version: config?.api_version || DEFAULT_VERSION,
      action_versions: {
        ...getDefaultActionVersions(),
        ...(config?.action_versions ?? {}),
      },
      enabled: config?.enabled ?? true,
    });
  }, [config]);

  if (!canConfig) return <Forbidden403 />;
  if (warehousesLoading) return <SystemSettingsSkeleton />;

  const updateField = <K extends keyof OpenApiConfigPayload>(
    key: K,
    value: OpenApiConfigPayload[K],
  ) => setForm((current) => ({ ...current, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    const payload: OpenApiConfigPayload = {
      ...form,
      app_id: form.app_id.trim(),
      base_url: form.base_url.trim(),
      api_version: form.api_version.trim() || DEFAULT_VERSION,
      action_versions: {
        ...Object.fromEntries(
          Object.entries(form.action_versions)
            .map(([action, version]) => [action, version.trim()])
            .filter(([, version]) => version),
        ),
        ...Object.fromEntries(
          OPENAPI_ACTION_VERSION_ROWS.map((row) => [
            row.action,
            (form.action_versions[row.action]?.trim() || row.defaultVersion),
          ]),
        ),
      },
      secret_key: form.secret_key?.trim() ? form.secret_key.trim() : undefined,
    };
    try {
      const savePromise = saveConfig(payload);
      gooeyToast.promise(savePromise, {
        loading: t.systemSettings.saving,
        success: t.systemSettings.saveSuccess,
        error: t.systemSettings.saveError,
        description: {
          success: t.systemSettings.saveSuccessDesc,
          error: t.systemSettings.saveErrorDesc,
        },
        action: {
          error: {
            label: t.systemSettings.retry,
            onClick: () => void handleSave(),
          },
        },
      });
      await savePromise;
    } catch {
      // The toast already renders the API error state.
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const testPromise = testConfig();
      gooeyToast.promise(testPromise, {
        loading: t.systemSettings.testing,
        success: t.systemSettings.testSuccess,
        error: t.systemSettings.testError,
        description: {
          success: t.systemSettings.testSuccessDesc,
          error: t.systemSettings.testErrorDesc,
        },
        action: {
          error: {
            label: t.systemSettings.retry,
            onClick: () => void handleTest(),
          },
        },
      });
      await testPromise;
    } catch {
      // The toast already renders the API error state.
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="flex w-full flex-col gap-4">
      <header className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] p-4">
        <p className="text-xs font-semibold uppercase text-[var(--color-text-muted)]">
          {t.systemSettings.admin}
        </p>
        <h1 className="mt-1 text-2xl font-black text-[var(--color-text-primary)]">
          {t.systemSettings.title}
        </h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          {t.systemSettings.subtitle}
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
        <aside className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] p-3">
          <button
            type="button"
            className="flex w-full items-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-brand-primary)] bg-[var(--color-brand-primary)]/5 p-3 text-left text-sm font-bold text-[var(--color-brand-primary)]"
          >
            <ShieldCheck size={18} />
            {t.systemSettings.openapi}
          </button>
        </aside>

        <section className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] p-4">
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[280px_1fr]">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-[var(--color-text-muted)]">
                {t.systemSettings.store}
              </label>
              <select
                value={activeWarehouseId}
                onChange={(event) => setSelectedWarehouseId(event.target.value)}
                className="h-11 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-white px-3 text-sm font-semibold outline-none focus:border-[var(--color-brand-primary)]"
              >
                {warehouses.length === 0 && <option value="">{t.systemSettings.noStores}</option>}
                {warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.name}
                  </option>
                ))}
              </select>
              <p className="text-xs leading-5 text-[var(--color-text-muted)]">
                {selectedWarehouse?.code || "No code"} - {config?.has_secret ? t.systemSettings.hasSecret : t.systemSettings.noSecret}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <InputField
                label={t.systemSettings.appId}
                value={form.app_id}
                onChange={(value) => updateField("app_id", value)}
                placeholder={t.systemSettings.placeholderAppId}
              />
              <InputField
                label={t.systemSettings.secretKey}
                value={form.secret_key || ""}
                onChange={(value) => updateField("secret_key", value)}
                placeholder={config?.has_secret ? t.systemSettings.placeholderSecretKeyKeep : t.systemSettings.placeholderSecretKey}
                type="password"
              />
              <InputField
                label={t.systemSettings.baseUrl}
                value={form.base_url}
                onChange={(value) => updateField("base_url", value)}
                placeholder="https://example.com/openapi/action"
              />
              <InputField
                label="Fallback API version"
                value={form.api_version}
                onChange={(value) => updateField("api_version", value)}
                placeholder={DEFAULT_VERSION}
              />
              <div className="md:col-span-2">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-[var(--color-text-muted)]">
                      API versions by action
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      Moi OpenAPI action co the dung version rieng khi ky request.
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  {OPENAPI_ACTION_VERSION_ROWS.map((row) => (
                    <label
                      key={row.action}
                      className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-white p-3"
                    >
                      <span className="block text-xs font-semibold text-[var(--color-text-primary)]">
                        {row.label}
                      </span>
                      <span className="mt-0.5 block truncate text-[10px] font-medium text-[var(--color-text-muted)]">
                        {row.action}
                      </span>
                      <input
                        value={form.action_versions[row.action] ?? row.defaultVersion}
                        onChange={(event) =>
                          updateField("action_versions", {
                            ...form.action_versions,
                            [row.action]: event.target.value,
                          })
                        }
                        placeholder={row.defaultVersion}
                        className="mt-2 h-9 w-full rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-white px-3 text-sm font-semibold text-[var(--color-text-primary)] outline-none transition placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-brand-primary)]"
                      />
                    </label>
                  ))}
                </div>
              </div>
              <label className="flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-white p-3 md:col-span-2">
                <input
                  type="checkbox"
                  checked={form.enabled}
                  onChange={(event) => updateField("enabled", event.target.checked)}
                  className="h-4 w-4 rounded border-[var(--color-border-subtle)]"
                />
                <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                  {t.systemSettings.enableOpenApi}
                </span>
              </label>
            </div>
          </div>

          {error && (
            <p className="mt-4 rounded-[var(--radius-md)] bg-[var(--color-error-bg)] p-3 text-sm font-semibold text-[var(--color-error-text)]">
              {error}
            </p>
          )}

          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => void handleTest()}
              disabled={!activeWarehouseId || loading || testing || !config?.has_secret}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-white px-4 text-sm font-bold text-[var(--color-text-primary)] transition hover:border-[var(--color-brand-primary)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <TestTube2 size={16} />
              {t.systemSettings.testBtn}
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={!activeWarehouseId || loading || saving}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-brand-primary)] px-4 text-sm font-bold text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Save size={16} />
              {t.systemSettings.saveBtn}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

function InputField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: string;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-xs font-semibold text-[var(--color-text-muted)]">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-11 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-white px-3 text-sm font-semibold text-[var(--color-text-primary)] outline-none transition placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-brand-primary)]"
      />
    </label>
  );
}
