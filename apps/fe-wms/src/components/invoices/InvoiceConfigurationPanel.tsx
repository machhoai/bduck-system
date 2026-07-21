"use client";

import {
  AlertTriangle,
  BadgeCheck,
  BadgePercent,
  CalendarClock,
  CheckCircle2,
  CreditCard,
  LoaderCircle,
  Plus,
  RefreshCw,
  Ruler,
  Save,
  Settings2,
  Store,
  Trash2,
  UserRound,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  MeInvoiceSignType,
  type InvoiceTaxRateSource,
  type InvoiceVatRateName,
  type MeInvoiceOptionUserDefined,
} from "@bduck/shared-types";
import {
  invoiceApi,
  type MeInvoiceAccountOption,
  type MeInvoiceStoreConfigPayload,
  type MeInvoiceStoreConfigView,
} from "@/api/invoiceApi";
import { showToast } from "@/utils/toast";

type Language = "vi" | "zh";

interface PaymentMappingRow {
  id: string;
  source: string;
  target: string;
}

interface ConfigForm {
  meinvoice_account_id: string;
  inv_series: string;
  invoice_with_code: boolean;
  sign_type: MeInvoiceSignType;
  seller_shop_code: string;
  seller_shop_name: string;
  price_includes_vat: boolean | null;
  tax_rate_source: InvoiceTaxRateSource;
  default_vat_rate_name: InvoiceVatRateName | "";
  default_payment_method_name: string;
  default_unit_name: string;
  go_live_at: string;
  default_buyer_name: string;
  default_buyer_address: string;
  enabled: boolean;
  payment_mappings: PaymentMappingRow[];
  sku_mapping: MeInvoiceStoreConfigPayload["sku_mapping"];
  category_vat_mapping: MeInvoiceStoreConfigPayload["category_vat_mapping"];
  option_user_defined: MeInvoiceOptionUserDefined;
}

const DEFAULT_OPTION_USER_DEFINED: MeInvoiceOptionUserDefined = {
  main_currency: "VND",
  amount_decimal_digits: 0,
  amount_oc_decimal_digits: 0,
  unit_price_oc_decimal_digits: 0,
  unit_price_decimal_digits: 0,
  quantity_decimal_digits: 2,
  coefficient_decimal_digits: 0,
  exchange_rate_decimal_digits: 2,
};

const blankForm = (): ConfigForm => ({
  meinvoice_account_id: "",
  inv_series: "",
  invoice_with_code: true,
  sign_type: MeInvoiceSignType.CALCULATING_MACHINE,
  seller_shop_code: "",
  seller_shop_name: "",
  price_includes_vat: true,
  tax_rate_source: "SOURCE",
  default_vat_rate_name: "10%",
  default_payment_method_name: "Tiền mặt/Chuyển khoản",
  default_unit_name: "Cái",
  go_live_at: "",
  default_buyer_name: "Khách lẻ (Không lấy hóa đơn)",
  default_buyer_address: "",
  enabled: false,
  payment_mappings: [{ id: "mapping-new", source: "", target: "" }],
  sku_mapping: {},
  category_vat_mapping: {},
  option_user_defined: DEFAULT_OPTION_USER_DEFINED,
});

const vietnamDateTimeInput = (value: string | null): string => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
};

const toForm = (config: MeInvoiceStoreConfigView): ConfigForm => {
  const paymentMappings = Object.entries(config.payment_method_mapping ?? {}).map(
    ([source, target], index) => ({ id: `mapping-${index}`, source, target }),
  );
  return {
    meinvoice_account_id: config.meinvoice_account_id,
    inv_series: config.inv_series,
    invoice_with_code: config.invoice_with_code,
    sign_type: config.sign_type,
    seller_shop_code: config.seller_shop_code,
    seller_shop_name: config.seller_shop_name,
    price_includes_vat: config.price_includes_vat,
    tax_rate_source: config.tax_rate_source,
    default_vat_rate_name: config.default_vat_rate_name ?? "",
    default_payment_method_name: config.default_payment_method_name ?? "",
    default_unit_name: config.default_unit_name ?? "",
    go_live_at: vietnamDateTimeInput(config.go_live_at),
    default_buyer_name: config.default_buyer_name,
    default_buyer_address: config.default_buyer_address,
    enabled: config.enabled,
    payment_mappings:
      paymentMappings.length > 0
        ? paymentMappings
        : [{ id: "mapping-new", source: "", target: "" }],
    sku_mapping: config.sku_mapping,
    category_vat_mapping: config.category_vat_mapping,
    option_user_defined: config.option_user_defined,
  };
};

const goLiveIso = (value: string): string | null => {
  if (!value) return null;
  const date = new Date(`${value}:00+07:00`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const inputClass =
  "h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500";

const copy = {
  vi: {
    title: "Cấu hình hóa đơn",
    subtitle:
      "Thiết lập giá trị mặc định và chính sách phát hành cho từng cửa hàng.",
    loadError: "Không thể tải cấu hình hóa đơn.",
    noPermission: "Bạn không có quyền cấu hình hóa đơn cho cửa hàng này.",
    saveError: "Không thể lưu cấu hình.",
    saved: "Đã lưu cấu hình",
    savedDescription:
      "Cấu hình đang ở trạng thái tắt. Bạn có thể xác minh trước khi bật.",
    applied: "Đã áp dụng cấu hình",
    appliedDescription:
      "Cấu hình đã được lưu và xác minh với MISA. Hãy đồng bộ lại đơn để áp dụng giá trị mới.",
    required: "Vui lòng điền đủ tài khoản MISA, ký hiệu, cửa hàng, ĐVT, phương thức thanh toán, VAT và go-live.",
  },
  zh: {
    title: "发票配置",
    subtitle: "为每个门店设置默认值和开票策略。",
    loadError: "无法加载发票配置。",
    noPermission: "您没有权限配置此门店的发票。",
    saveError: "无法保存配置。",
    saved: "配置已保存",
    savedDescription: "配置目前已停用，验证后可启用。",
    applied: "配置已应用",
    appliedDescription: "配置已保存并通过 MISA 验证。请重新同步订单以应用新值。",
    required: "请填写 MISA 账户、发票系列、门店、单位、付款方式、税率和上线时间。",
  },
} as const;

export function InvoiceConfigurationPanel({
  warehouseId,
  canConfigure,
  lang,
}: {
  warehouseId: string;
  canConfigure: boolean;
  lang: Language;
}) {
  const d = copy[lang];
  const [config, setConfig] = useState<MeInvoiceStoreConfigView | null>(null);
  const [accountOptions, setAccountOptions] = useState<MeInvoiceAccountOption[]>([]);
  const [form, setForm] = useState<ConfigForm>(blankForm);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadConfig = useCallback(async () => {
    if (!warehouseId || !canConfigure) return;
    setLoading(true);
    setError(null);
    try {
      const [next, accounts] = await Promise.all([
        invoiceApi.getStoreConfig(warehouseId),
        invoiceApi.listStoreAccountOptions(warehouseId),
      ]);
      setConfig(next);
      setAccountOptions(accounts);
      setForm(next ? toForm(next) : blankForm());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : d.loadError);
    } finally {
      setLoading(false);
    }
  }, [canConfigure, d.loadError, warehouseId]);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  const status = useMemo(() => {
    if (!config) return { label: lang === "vi" ? "Chưa cấu hình" : "Not configured", tone: "amber" };
    if (!config.enabled) return { label: lang === "vi" ? "Đang tắt" : "Disabled", tone: "slate" };
    if (!config.validated_at) return { label: lang === "vi" ? "Chưa xác minh" : "Not validated", tone: "amber" };
    if (!config.go_live_at) return { label: lang === "vi" ? "Thiếu go-live" : "Missing go-live", tone: "rose" };
    return { label: lang === "vi" ? "Sẵn sàng" : "Ready", tone: "emerald" };
  }, [config, lang]);

  const setField = <K extends keyof ConfigForm>(key: K, value: ConfigForm[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const buildPayload = (enabled: boolean): MeInvoiceStoreConfigPayload => {
    const paymentMethodMapping = Object.fromEntries(
      form.payment_mappings
        .map((item) => [item.source.trim(), item.target.trim()] as const)
        .filter(([source, target]) => source && target),
    );
    return {
      meinvoice_account_id: form.meinvoice_account_id.trim(),
      inv_series: form.inv_series.trim().toUpperCase(),
      invoice_with_code: form.invoice_with_code,
      sign_type: form.sign_type,
      seller_shop_code: form.seller_shop_code.trim(),
      seller_shop_name: form.seller_shop_name.trim(),
      price_includes_vat: form.price_includes_vat,
      tax_rate_source: form.tax_rate_source,
      default_vat_rate_name: form.default_vat_rate_name || null,
      sku_mapping: form.sku_mapping,
      category_vat_mapping: form.category_vat_mapping,
      payment_method_mapping: paymentMethodMapping,
      default_payment_method_name: form.default_payment_method_name.trim(),
      default_unit_name: form.default_unit_name.trim(),
      go_live_at: goLiveIso(form.go_live_at),
      default_buyer_name: form.default_buyer_name.trim(),
      default_buyer_address: form.default_buyer_address.trim(),
      default_buyer_tax_code: null,
      option_user_defined: form.option_user_defined,
      enabled,
    };
  };

  const validateRequiredFields = () => {
    const payload = buildPayload(form.enabled);
    return Boolean(
      payload.meinvoice_account_id &&
        payload.inv_series &&
        payload.seller_shop_code &&
        payload.seller_shop_name &&
        payload.default_buyer_name &&
        payload.default_payment_method_name &&
        payload.default_unit_name &&
        payload.default_vat_rate_name &&
        payload.go_live_at &&
        payload.price_includes_vat !== null,
    );
  };

  const saveDraft = async () => {
    if (!validateRequiredFields()) {
      setError(d.required);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const saved = await invoiceApi.saveStoreConfig(
        warehouseId,
        buildPayload(false),
      );
      setConfig(saved);
      setForm(toForm(saved));
      showToast.success(d.saved, d.savedDescription);
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : d.saveError;
      setError(message);
      showToast.error(d.saveError, message);
    } finally {
      setSaving(false);
    }
  };

  const saveValidateAndApply = async () => {
    if (!validateRequiredFields()) {
      setError(d.required);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const requestedEnabled = form.enabled;
      const payload = buildPayload(false);
      await invoiceApi.saveStoreConfig(warehouseId, payload);
      await invoiceApi.validateStoreConfig(warehouseId);
      const saved = await invoiceApi.saveStoreConfig(warehouseId, {
        ...payload,
        enabled: requestedEnabled,
      });
      setConfig(saved);
      setForm(toForm(saved));
      showToast.success(d.applied, d.appliedDescription);
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : d.saveError;
      setError(message);
      showToast.error(d.saveError, message);
      await loadConfig();
    } finally {
      setSaving(false);
    }
  };

  if (!canConfigure) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
        {d.noPermission}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-72 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white text-sm text-slate-500">
        <LoaderCircle className="animate-spin" size={18} />
        {lang === "vi" ? "Đang tải cấu hình…" : "Loading configuration…"}
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-700">
            <Settings2 size={21} />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-bold text-slate-950">{d.title}</h2>
              <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                status.tone === "emerald"
                  ? "bg-emerald-100 text-emerald-700"
                  : status.tone === "rose"
                    ? "bg-rose-100 text-rose-700"
                    : status.tone === "amber"
                      ? "bg-amber-100 text-amber-700"
                      : "bg-slate-100 text-slate-600"
              }`}>
                {status.label}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500">{d.subtitle}</p>
            {config?.validated_at && (
              <p className="mt-1 text-xs text-emerald-700">
                {lang === "vi" ? "Xác minh MISA gần nhất" : "Last MISA validation"}: {new Date(config.validated_at).toLocaleString(lang === "vi" ? "vi-VN" : "zh-CN")}
              </p>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => void loadConfig()}
          disabled={saving}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw size={16} />
          {lang === "vi" ? "Tải lại" : "Reload"}
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          <AlertTriangle className="mt-0.5 shrink-0" size={18} />
          <span>{error}</span>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        <ConfigCard
          icon={<UserRound size={19} />}
          title={lang === "vi" ? "Giá trị mặc định" : "Default values"}
          description={lang === "vi" ? "Tự điền khi dữ liệu nguồn không có giá trị." : "Used when source data has no value."}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <ConfigField label={lang === "vi" ? "Tên người mua" : "Buyer name"} className="sm:col-span-2">
              <input className={inputClass} value={form.default_buyer_name} onChange={(event) => setField("default_buyer_name", event.target.value)} />
            </ConfigField>
            <ConfigField label={lang === "vi" ? "Địa chỉ người mua" : "Buyer address"} className="sm:col-span-2" optional>
              <input className={inputClass} value={form.default_buyer_address} onChange={(event) => setField("default_buyer_address", event.target.value)} placeholder={lang === "vi" ? "Để trống nếu không bắt buộc" : "Leave blank if optional"} />
            </ConfigField>
            <ConfigField label={lang === "vi" ? "Phương thức thanh toán" : "Payment method"} icon={<CreditCard size={14} />}>
              <input className={inputClass} value={form.default_payment_method_name} onChange={(event) => setField("default_payment_method_name", event.target.value)} placeholder="Tiền mặt/Chuyển khoản" />
            </ConfigField>
            <ConfigField label={lang === "vi" ? "Đơn vị tính (ĐVT)" : "Unit"} icon={<Ruler size={14} />}>
              <input className={inputClass} value={form.default_unit_name} onChange={(event) => setField("default_unit_name", event.target.value)} placeholder="Cái" />
            </ConfigField>
            <ConfigField label={lang === "vi" ? "Thuế suất VAT" : "Default VAT"} icon={<BadgePercent size={14} />}>
              <select className={inputClass} value={form.default_vat_rate_name} onChange={(event) => setField("default_vat_rate_name", event.target.value as InvoiceVatRateName | "")}>
                <option value="">{lang === "vi" ? "Chọn thuế suất" : "Select VAT"}</option>
                {(["0%", "5%", "8%", "10%", "KCT", "KKKNT"] as const).map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </ConfigField>
            <ConfigField label={lang === "vi" ? "Giá nguồn" : "Source price"}>
              <select className={inputClass} value={form.price_includes_vat === null ? "" : String(form.price_includes_vat)} onChange={(event) => setField("price_includes_vat", event.target.value === "" ? null : event.target.value === "true")}>
                <option value="">{lang === "vi" ? "Chưa xác định" : "Not specified"}</option>
                <option value="true">{lang === "vi" ? "Đã gồm VAT" : "VAT included"}</option>
                <option value="false">{lang === "vi" ? "Chưa gồm VAT" : "VAT excluded"}</option>
              </select>
            </ConfigField>
          </div>
        </ConfigCard>

        <ConfigCard
          icon={<CalendarClock size={19} />}
          title={lang === "vi" ? "Phát hành & go-live" : "Issuing & go-live"}
          description={lang === "vi" ? "Chỉ đơn thanh toán từ thời điểm này mới được phát hành." : "Only orders paid after this time can be issued."}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <ConfigField label="Go-live" className="sm:col-span-2">
              <input type="datetime-local" className={inputClass} value={form.go_live_at} onChange={(event) => setField("go_live_at", event.target.value)} />
              <p className="mt-1 text-xs text-slate-500">{lang === "vi" ? "Múi giờ Việt Nam (UTC+7). Đơn trước mốc này chỉ dùng để đối chiếu." : "Vietnam time (UTC+7). Earlier orders are reconciliation-only."}</p>
            </ConfigField>
            <ConfigField label={lang === "vi" ? "Ký hiệu hóa đơn" : "Invoice series"}>
              <input className={`${inputClass} uppercase`} value={form.inv_series} onChange={(event) => setField("inv_series", event.target.value.toUpperCase())} placeholder="1C26MAA" />
            </ConfigField>
            <ConfigField label={lang === "vi" ? "Hình thức ký" : "Sign type"}>
              <select className={inputClass} value={form.sign_type} onChange={(event) => setField("sign_type", Number(event.target.value) as MeInvoiceSignType)}>
                <option value={MeInvoiceSignType.CALCULATING_MACHINE}>{lang === "vi" ? "Máy tính tiền" : "Cash register"}</option>
                <option value={MeInvoiceSignType.HSM}>HSM</option>
              </select>
            </ConfigField>
            <ConfigField label={lang === "vi" ? "Nguồn thuế suất" : "VAT source"}>
              <select className={inputClass} value={form.tax_rate_source} onChange={(event) => setField("tax_rate_source", event.target.value as InvoiceTaxRateSource)}>
                <option value="SOURCE">{lang === "vi" ? "Dữ liệu nguồn, thiếu thì dùng mặc định" : "Source, then default"}</option>
                <option value="SKU">SKU</option>
                <option value="CATEGORY">{lang === "vi" ? "Danh mục" : "Category"}</option>
                <option value="MANUAL_REVIEW">{lang === "vi" ? "Duyệt thủ công" : "Manual review"}</option>
              </select>
            </ConfigField>
            <ConfigField label={lang === "vi" ? "Loại hóa đơn" : "Invoice type"}>
              <select className={inputClass} value={String(form.invoice_with_code)} onChange={(event) => setField("invoice_with_code", event.target.value === "true")}>
                <option value="true">{lang === "vi" ? "Có mã CQT" : "With tax authority code"}</option>
                <option value="false">{lang === "vi" ? "Không mã CQT" : "Without tax authority code"}</option>
              </select>
            </ConfigField>
          </div>
        </ConfigCard>

        <ConfigCard
          icon={<Store size={19} />}
          title={lang === "vi" ? "Cửa hàng & kết nối" : "Store & connection"}
          description={lang === "vi" ? "Thông tin định danh gửi sang MISA meInvoice." : "Identity sent to MISA meInvoice."}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <ConfigField label={lang === "vi" ? "Mã cửa hàng" : "Shop code"}>
              <input className={inputClass} value={form.seller_shop_code} onChange={(event) => setField("seller_shop_code", event.target.value)} />
            </ConfigField>
            <ConfigField label={lang === "vi" ? "Tên cửa hàng" : "Shop name"}>
              <input className={inputClass} value={form.seller_shop_name} onChange={(event) => setField("seller_shop_name", event.target.value)} />
            </ConfigField>
            <ConfigField label={lang === "vi" ? "ID tài khoản meInvoice" : "meInvoice account ID"} className="sm:col-span-2">
              {accountOptions.length > 0 ? (
                <select className={inputClass} value={form.meinvoice_account_id} onChange={(event) => setField("meinvoice_account_id", event.target.value)}>
                  <option value="">{lang === "vi" ? "Chọn tài khoản kết nối" : "Select a connection"}</option>
                  {accountOptions.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.display_name} · {account.tax_code} · {account.environment}
                      {!account.enabled || !account.last_test_succeeded
                        ? lang === "vi" ? " · Chưa sẵn sàng" : " · Not ready"
                        : ""}
                    </option>
                  ))}
                </select>
              ) : (
                <input className={inputClass} value={form.meinvoice_account_id} onChange={(event) => setField("meinvoice_account_id", event.target.value)} placeholder={lang === "vi" ? "Chưa có tài khoản kết nối khả dụng" : "No connection account is available"} />
              )}
              <p className="mt-1 text-xs text-slate-500">{lang === "vi" ? "Tài khoản phải được test kết nối và bật trước khi xác minh cấu hình cửa hàng." : "The account must be tested and enabled before validating the store configuration."}</p>
            </ConfigField>
          </div>
        </ConfigCard>

        <ConfigCard
          icon={<CreditCard size={19} />}
          title={lang === "vi" ? "Ánh xạ thanh toán" : "Payment mapping"}
          description={lang === "vi" ? "Đổi tên phương thức từ hệ thống nguồn trước khi gửi sang MISA." : "Rename source payment methods before sending to MISA."}
        >
          <div className="space-y-2">
            {form.payment_mappings.map((mapping) => (
              <div key={mapping.id} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                <input className={inputClass} value={mapping.source} onChange={(event) => setForm((current) => ({ ...current, payment_mappings: current.payment_mappings.map((item) => item.id === mapping.id ? { ...item, source: event.target.value } : item) }))} placeholder={lang === "vi" ? "Tên từ nguồn" : "Source name"} />
                <input className={inputClass} value={mapping.target} onChange={(event) => setForm((current) => ({ ...current, payment_mappings: current.payment_mappings.map((item) => item.id === mapping.id ? { ...item, target: event.target.value } : item) }))} placeholder={lang === "vi" ? "Tên trên hóa đơn" : "Invoice name"} />
                <button type="button" onClick={() => setForm((current) => ({ ...current, payment_mappings: current.payment_mappings.filter((item) => item.id !== mapping.id) }))} className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600" aria-label={lang === "vi" ? "Xóa ánh xạ" : "Remove mapping"}>
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            <button type="button" onClick={() => setForm((current) => ({ ...current, payment_mappings: [...current.payment_mappings, { id: crypto.randomUUID(), source: "", target: "" }] }))} className="inline-flex h-9 items-center gap-2 rounded-lg border border-dashed border-sky-300 px-3 text-xs font-bold text-sky-700 hover:bg-sky-50">
              <Plus size={15} /> {lang === "vi" ? "Thêm ánh xạ" : "Add mapping"}
            </button>
          </div>
        </ConfigCard>
      </div>

      <div className="sticky bottom-3 z-10 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-lg backdrop-blur sm:flex-row sm:items-center">
        <label className="flex flex-1 cursor-pointer items-center gap-3">
          <input type="checkbox" checked={form.enabled} onChange={(event) => setField("enabled", event.target.checked)} className="h-5 w-5 rounded accent-sky-700" />
          <span>
            <span className="block text-sm font-bold text-slate-900">{lang === "vi" ? "Bật cấu hình sau khi xác minh" : "Enable after validation"}</span>
            <span className="block text-xs text-slate-500">{lang === "vi" ? "Tắt tùy chọn này nếu chỉ muốn lưu cấu hình để kiểm tra sau." : "Turn this off to save a validated but inactive configuration."}</span>
          </span>
        </label>
        <button type="button" onClick={() => void saveDraft()} disabled={saving} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
          <Save size={17} /> {lang === "vi" ? "Lưu nháp" : "Save draft"}
        </button>
        <button type="button" onClick={() => void saveValidateAndApply()} disabled={saving} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-sky-700 px-4 text-sm font-bold text-white hover:bg-sky-800 disabled:opacity-50">
          {saving ? <LoaderCircle className="animate-spin" size={17} /> : <BadgeCheck size={17} />}
          {lang === "vi" ? "Lưu & xác minh MISA" : "Save & validate MISA"}
        </button>
      </div>

      <div className="flex items-start gap-2 rounded-xl bg-sky-50 px-4 py-3 text-xs text-sky-800">
        <CheckCircle2 className="mt-0.5 shrink-0" size={15} />
        <span>{lang === "vi" ? "Sau khi đổi ĐVT, VAT hoặc phương thức thanh toán, hãy đồng bộ lại ngày cần phát hành để hệ thống tính lại preflight và draft." : "After changing unit, VAT, or payment defaults, resync the issuing date so preflight and drafts are recalculated."}</span>
      </div>
    </section>
  );
}

function ConfigCard({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-5 flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">{icon}</span>
        <div>
          <h3 className="font-bold text-slate-950">{title}</h3>
          <p className="mt-0.5 text-xs leading-5 text-slate-500">{description}</p>
        </div>
      </div>
      {children}
    </article>
  );
}

function ConfigField({
  label,
  icon,
  optional = false,
  className = "",
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  optional?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`grid content-start gap-1.5 ${className}`}>
      <span className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
        {icon}
        {label}
        {optional && <span className="font-normal text-slate-400">(optional)</span>}
      </span>
      {children}
    </label>
  );
}
