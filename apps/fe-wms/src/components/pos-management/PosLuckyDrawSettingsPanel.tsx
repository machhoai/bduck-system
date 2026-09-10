"use client";

import type {
  PosLuckyDrawSettingsInput,
  PosLuckyDrawSettingsView,
} from "@bduck/shared-types";
import { gooeyToast } from "goey-toast";
import { Gift, RotateCcw, Save, Search, Sparkles } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import {
  posManagementApi,
  type PosLuckyDrawSettingsPayload,
} from "@/api/posManagementApi";

import {
  createDefaultPosLuckyDrawSettings,
  LUCKY_DRAW_PRINTABLE_WIDTH_MM,
  LUCKY_DRAW_TICKET_HEIGHT_MM,
  MAX_LUCKY_DRAW_TICKETS_PER_PACKAGE,
} from "./posLuckyDrawDefaults";
import { PosLuckyDrawPreview } from "./PosLuckyDrawPreview";

const fieldClassName =
  "min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-900 outline-none focus:border-amber-400 disabled:bg-slate-50 disabled:text-slate-500";

const formatCurrency = (amount: number) =>
  `${Math.round(amount).toLocaleString("vi-VN")} đ`;

const toPayload = (
  settings: PosLuckyDrawSettingsView["settings"],
): PosLuckyDrawSettingsPayload | null => {
  if (!settings) return null;
  return {
    enabled: settings.enabled,
    paperSize: settings.paperSize,
    programName: settings.programName,
    ticketTitle: settings.ticketTitle,
    message: settings.message,
    footerMessage: settings.footerMessage,
    packageTicketCounts: settings.packageTicketCounts,
  };
};

export function PosLuckyDrawSettingsPanel({
  warehouseId,
  view,
  canManage,
  onChanged,
}: {
  warehouseId: string;
  view: PosLuckyDrawSettingsView | null;
  canManage: boolean;
  onChanged: () => Promise<void>;
}) {
  const synchronizedForm = useMemo(
    () =>
      toPayload(view?.settings ?? null) ?? createDefaultPosLuckyDrawSettings(),
    [view?.settings],
  );
  const [draftForm, setDraftForm] = useState<PosLuckyDrawSettingsInput | null>(
    null,
  );
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const form = draftForm ?? synchronizedForm;
  const packages = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("vi");
    return (view?.packages ?? []).filter(
      (item) =>
        !query ||
        [item.goodsName, item.typeName, item.goodsId].some((value) =>
          value.toLocaleLowerCase("vi").includes(query),
        ),
    );
  }, [search, view?.packages]);
  const configuredCount = Object.values(form.packageTicketCounts).filter(
    (count) => count > 0,
  ).length;

  const update = useCallback(
    <K extends keyof PosLuckyDrawSettingsInput>(
      key: K,
      value: PosLuckyDrawSettingsInput[K],
    ) => {
      setDraftForm((current) => ({
        ...(current ?? synchronizedForm),
        [key]: value,
      }));
    },
    [synchronizedForm],
  );

  const updatePackageCount = useCallback(
    (goodsId: string, count: number) => {
      const normalized = Math.min(
        MAX_LUCKY_DRAW_TICKETS_PER_PACKAGE,
        Math.max(0, Math.trunc(Number.isFinite(count) ? count : 0)),
      );
      const next = { ...form.packageTicketCounts };
      if (normalized > 0) next[goodsId] = normalized;
      else delete next[goodsId];
      update("packageTicketCounts", next);
    },
    [form.packageTicketCounts, update],
  );

  const save = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    const action = async () => {
      await posManagementApi.saveLuckyDrawSettings(warehouseId, form);
      await onChanged();
      setDraftForm(null);
    };
    const promise = action();
    gooeyToast.promise(promise, {
      loading: "Đang lưu cấu hình bốc thăm…",
      success: "Đã đồng bộ cấu hình tới JPOS.",
      error: "Không thể lưu cấu hình bốc thăm.",
    });
    try {
      await promise;
    } catch (error) {
      console.error("[PosLuckyDrawSettingsPanel] save failed:", error);
    } finally {
      setSaving(false);
    }
  }, [form, onChanged, saving, warehouseId]);

  return (
    <div className="space-y-4 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <Gift size={16} className="text-amber-600" />
            Cấu hình phiếu bốc thăm trúng thưởng
          </h2>
          <p className="text-xs text-slate-500">
            Mapping theo gói điểm thành viên · phiên bản{" "}
            {view?.settings?.version ?? 0}
          </p>
        </div>
        {canManage && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setDraftForm(createDefaultPosLuckyDrawSettings())}
              disabled={saving}
              className="flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              <RotateCcw size={14} />
              Mặc định
            </button>
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving || draftForm === null}
              className="flex h-9 items-center gap-2 rounded-lg bg-amber-500 px-3 text-xs font-bold text-white hover:bg-amber-600 disabled:opacity-50"
            >
              <Save size={14} />
              {saving ? "Đang lưu…" : "Lưu cấu hình"}
            </button>
          </div>
        )}
      </div>

      <fieldset
        disabled={!canManage || saving}
        className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_430px]"
      >
        <div className="space-y-4">
          <section
            className={`rounded-xl border p-4 ${
              form.enabled
                ? "border-emerald-200 bg-emerald-50"
                : "border-slate-200 bg-white"
            }`}
          >
            <label className="flex cursor-pointer items-center justify-between gap-4">
              <div>
                <p className="flex items-center gap-2 text-sm font-bold text-slate-900">
                  <Sparkles size={15} />
                  Chương trình đang {form.enabled ? "bật" : "tắt"}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                  Khi bật, bill có gói được mapping sẽ in kèm đúng số phiếu.
                </p>
              </div>
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(event) => update("enabled", event.target.checked)}
                className="size-6 accent-emerald-600"
              />
            </label>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Nội dung phiếu
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Khách hàng, đơn hàng, ngày mua, sản phẩm và barcode lấy từ đơn
                  đã thanh toán.
                </p>
              </div>
              <span className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-800">
                Chiều cao: {LUCKY_DRAW_TICKET_HEIGHT_MM} mm
              </span>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1.5 text-xs font-bold text-slate-700">
                Tên chương trình
                <input
                  value={form.programName}
                  maxLength={100}
                  onChange={(event) =>
                    update("programName", event.target.value)
                  }
                  className={fieldClassName}
                />
              </label>
              <label className="grid gap-1.5 text-xs font-bold text-slate-700">
                Tiêu đề phiếu
                <input
                  value={form.ticketTitle}
                  maxLength={80}
                  onChange={(event) =>
                    update("ticketTitle", event.target.value)
                  }
                  className={fieldClassName}
                />
              </label>
              <label className="grid gap-1.5 text-xs font-bold text-slate-700 sm:col-span-2">
                Hướng dẫn
                <textarea
                  value={form.message}
                  maxLength={240}
                  rows={3}
                  onChange={(event) => update("message", event.target.value)}
                  className={`${fieldClassName} py-3`}
                />
              </label>
              <label className="grid gap-1.5 text-xs font-bold text-slate-700 sm:col-span-2">
                Dòng cuối phiếu
                <input
                  value={form.footerMessage}
                  maxLength={160}
                  onChange={(event) =>
                    update("footerMessage", event.target.value)
                  }
                  className={fieldClassName}
                />
              </label>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {Object.entries(LUCKY_DRAW_PRINTABLE_WIDTH_MM).map(
                ([paperSize, width]) => (
                  <button
                    key={paperSize}
                    type="button"
                    onClick={() =>
                      update(
                        "paperSize",
                        paperSize as PosLuckyDrawSettingsInput["paperSize"],
                      )
                    }
                    className={`rounded-lg border p-3 text-left ${
                      form.paperSize === paperSize
                        ? "border-amber-400 bg-amber-50"
                        : "border-slate-200"
                    }`}
                  >
                    <span className="block text-xs font-bold">{paperSize}</span>
                    <span className="text-[10px] text-slate-500">
                      {width} mm
                    </span>
                  </button>
                ),
              )}
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Số phiếu theo gói
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Đã cấu hình {configuredCount} gói. Nhập 0 để không cấp phiếu.
                </p>
              </div>
              <label className="relative">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Tìm gói…"
                  className={`${fieldClassName} w-52 pl-8`}
                />
              </label>
            </div>
            <div className="mt-4 max-h-[430px] space-y-2 overflow-y-auto pr-1">
              {packages.length === 0 ? (
                <p className="rounded-lg border border-dashed border-slate-300 p-5 text-center text-xs text-slate-500">
                  Không tìm thấy gói điểm thành viên.
                </p>
              ) : null}
              {packages.map((item) => {
                const count = form.packageTicketCounts[item.goodsId] ?? 0;
                const price =
                  item.afterTaxPrice > 0 ? item.afterTaxPrice : item.price;
                return (
                  <div
                    key={item.goodsId}
                    className={`grid grid-cols-[minmax(0,1fr)_88px] items-center gap-3 rounded-lg border p-3 ${
                      count > 0
                        ? "border-amber-300 bg-amber-50"
                        : "border-slate-200"
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-slate-900">
                        {item.goodsName}
                      </p>
                      <p className="truncate text-[11px] text-slate-500">
                        {item.typeName || item.goodsId} ·{" "}
                        {formatCurrency(price)}
                      </p>
                    </div>
                    <label className="grid gap-1 text-center text-[9px] font-bold text-slate-500">
                      SỐ PHIẾU
                      <input
                        type="number"
                        min={0}
                        max={MAX_LUCKY_DRAW_TICKETS_PER_PACKAGE}
                        step={1}
                        value={count}
                        onChange={(event) =>
                          updatePackageCount(
                            item.goodsId,
                            Number(event.target.value),
                          )
                        }
                        className={`${fieldClassName} text-center text-sm font-black`}
                      />
                    </label>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
        <PosLuckyDrawPreview form={form} />
      </fieldset>
    </div>
  );
}
