"use client";

import type { InvoiceBulkIssueDisplayConfig } from "@bduck/shared-types";
import { ArrowRight, Ruler, Save, Tags, TriangleAlert, X } from "lucide-react";

const inputClass =
  "h-9 w-full rounded-md border border-slate-200 bg-white px-2.5 text-xs text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-100 disabled:bg-slate-100";

function MappingSection({
  title,
  description,
  icon,
  sources,
  mapping,
  placeholder,
  disabled,
  onChange,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  sources: string[];
  mapping: Record<string, string>;
  placeholder: string;
  disabled: boolean;
  onChange: (source: string, target: string) => void;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      <div className="flex items-start gap-2 border-b border-slate-100 p-3">
        <span className="mt-0.5 text-sky-700">{icon}</span>
        <div>
          <h4 className="text-xs font-bold text-slate-900">{title}</h4>
          <p className="mt-0.5 text-xxs text-slate-500">{description}</p>
        </div>
      </div>
      {sources.length === 0 ? (
        <p className="p-4 text-center text-xs text-slate-500">—</p>
      ) : (
        <div className="divide-y divide-slate-100">
          {sources.map((source) => (
            <div
              key={source}
              className="grid gap-1.5 p-2.5 sm:grid-cols-[minmax(0,1fr)_20px_minmax(0,1fr)] sm:items-center"
            >
              <span
                className="truncate text-xs font-medium text-slate-700"
                title={source}
              >
                {source}
              </span>
              <ArrowRight
                className="hidden justify-self-center text-slate-300 sm:block"
                size={14}
              />
              <input
                value={mapping[source] ?? ""}
                disabled={disabled}
                onChange={(event) => onChange(source, event.target.value)}
                placeholder={placeholder}
                className={inputClass}
              />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function BulkIssueConfigurationModal({
  config,
  itemNameMapping,
  unitNameMapping,
  dirty,
  saving,
  previewing,
  lang,
  onItemNameChange,
  onUnitNameChange,
  onSave,
  onContinue,
  onCancel,
}: {
  config: InvoiceBulkIssueDisplayConfig | null;
  itemNameMapping: Record<string, string>;
  unitNameMapping: Record<string, string>;
  dirty: boolean;
  saving: boolean;
  previewing: boolean;
  lang: "vi" | "zh";
  onItemNameChange: (source: string, target: string) => void;
  onUnitNameChange: (source: string, target: string) => void;
  onSave: () => void;
  onContinue: () => void;
  onCancel: () => void;
}) {
  const busy = saving || previewing;
  const vi = lang === "vi";

  return (
    <div
      className="fixed inset-0 z-[9998] flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-xs sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={vi ? "Cấu hình xuất hóa đơn" : "批量开票配置"}
    >
      <div className="flex max-h-[96vh] w-full flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-slate-50 shadow-2xl sm:max-w-4xl sm:rounded-2xl">
        <header className="flex items-start justify-between gap-3 border-b border-slate-200 bg-white p-4">
          <div>
            <p className="text-micro font-bold uppercase tracking-wider text-sky-700">
              MISA meInvoice
            </p>
            <h3 className="mt-0.5 text-base font-bold text-slate-950">
              {vi ? "Cấu hình tên sản phẩm và đơn vị" : "配置商品名称和单位"}
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              {config?.business_date ?? "—"} ·{" "}
              {vi
                ? "Danh sách được lấy từ toàn bộ hóa đơn trong ngày"
                : "列表来自当天全部发票"}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 disabled:opacity-40"
            aria-label={vi ? "Đóng" : "关闭"}
          >
            <X size={18} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-3 sm:p-4">
          {!config ? (
            <div
              className="grid animate-pulse gap-3"
              aria-label={vi ? "Đang tải cấu hình" : "正在加载配置"}
            >
              {[0, 1].map((item) => (
                <div
                  key={item}
                  className="overflow-hidden rounded-lg border border-slate-200 bg-white"
                >
                  <div className="h-14 border-b border-slate-100 bg-slate-100" />
                  <div className="grid gap-2 p-3 sm:grid-cols-2">
                    {[0, 1, 2].map((row) => (
                      <div key={row} className="h-9 rounded bg-slate-100" />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              <MappingSection
                title={vi ? "Tên sản phẩm" : "商品名称"}
                description={
                  vi
                    ? `${config.item_names.length} tên duy nhất trong ngày`
                    : `当天 ${config.item_names.length} 个唯一名称`
                }
                icon={<Tags size={16} />}
                sources={config.item_names}
                mapping={itemNameMapping}
                placeholder={vi ? "Giữ nguyên tên gốc" : "保留原名称"}
                disabled={busy}
                onChange={onItemNameChange}
              />
              <MappingSection
                title={vi ? "Đơn vị tính" : "计量单位"}
                description={
                  vi
                    ? `${config.unit_names.length} đơn vị duy nhất trong ngày`
                    : `当天 ${config.unit_names.length} 个唯一单位`
                }
                icon={<Ruler size={16} />}
                sources={config.unit_names}
                mapping={unitNameMapping}
                placeholder={vi ? "Giữ nguyên đơn vị gốc" : "保留原单位"}
                disabled={busy}
                onChange={onUnitNameChange}
              />
            </div>
          )}
        </div>

        <footer className="border-t border-slate-200 bg-white p-3 sm:p-4">
          {dirty && (
            <p className="mb-2 flex items-center gap-1.5 text-xxs font-medium text-amber-700">
              <TriangleAlert size={13} />
              {vi
                ? "Hãy lưu thay đổi trước khi xem danh sách xác nhận."
                : "请先保存更改，再查看确认列表。"}
            </p>
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onCancel}
              disabled={busy}
              className="h-9 rounded-md border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              {vi ? "Hủy" : "取消"}
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={!config || !dirty || busy}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-sky-300 bg-white px-3 text-xs font-bold text-sky-800 hover:bg-sky-50 disabled:opacity-40"
            >
              <Save size={14} />
              {saving
                ? vi
                  ? "Đang lưu…"
                  : "保存中…"
                : vi
                  ? "Lưu cấu hình"
                  : "保存配置"}
            </button>
            <button
              type="button"
              onClick={onContinue}
              disabled={!config || dirty || busy}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-sky-700 px-3 text-xs font-bold text-white hover:bg-sky-800 disabled:opacity-40"
            >
              <ArrowRight size={14} />
              {previewing
                ? vi
                  ? "Đang lập danh sách…"
                  : "正在生成列表…"
                : vi
                  ? "Xuất hóa đơn theo cấu hình"
                  : "按配置开具发票"}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
