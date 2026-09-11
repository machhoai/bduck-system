"use client";

import { gooeyToast } from "goey-toast";
import { Search, TicketCheck } from "lucide-react";
import { useCallback, useDeferredValue, useMemo, useState } from "react";

import { usePosVoucherSettings } from "@/hooks/usePosVoucherSettings";
import { useTranslation } from "@/lib/i18n";

import { PosVoucherSettingRow } from "./PosVoucherSettingRow";

const copy = {
  vi: {
    title: "Voucher sử dụng trên JPOS",
    hint: "Chọn sản phẩm được tự thêm khi quét. Voucher giảm phần trăm áp dụng cho toàn bộ đơn và chỉ được dùng một mã mỗi đơn.",
    search: "Tìm chiến dịch",
    active: "Đang bật",
    inactive: "Đang tắt",
    product: "Sản phẩm tự thêm",
    quantity: "Số lượng",
    percentEntireOrder: "Giảm trên toàn bộ đơn hàng",
    freeTicket: "Tặng vé",
    freeItem: "Tặng sản phẩm",
    save: "Lưu",
    saving: "Đang lưu cấu hình…",
    saved: "Đã cập nhật voucher JPOS",
    failed: "Không thể cập nhật voucher",
    savedDescription: "Cấu hình mới đã áp dụng cho cửa hàng này.",
    failedDescription: "Vui lòng thử lại hoặc kiểm tra kết nối.",
    retry: "Thử lại",
    empty: "Không có chiến dịch voucher phù hợp.",
    loadFailed: "Không thể tải cấu hình voucher. Hệ thống sẽ tự thử lại.",
  },
  zh: {
    title: "JPOS 可用优惠券",
    hint: "选择扫码后自动加入的商品。百分比优惠适用于整张订单，每单限用一张。",
    search: "搜索活动",
    active: "已启用",
    inactive: "已停用",
    product: "自动加入商品",
    quantity: "数量",
    percentEntireOrder: "整单折扣",
    freeTicket: "赠送门票",
    freeItem: "赠送商品",
    save: "保存",
    saving: "正在保存设置…",
    saved: "JPOS 优惠券已更新",
    failed: "无法更新优惠券",
    savedDescription: "新设置已应用于当前门店。",
    failedDescription: "请重试或检查网络连接。",
    retry: "重试",
    empty: "没有符合条件的优惠券活动。",
    loadFailed: "无法加载优惠券设置，系统将自动重试。",
  },
};

export function PosVoucherSettingsPanel({
  warehouseId,
  canManage,
}: {
  warehouseId: string;
  canManage: boolean;
}) {
  const { lang } = useTranslation();
  const t = copy[lang === "zh" ? "zh" : "vi"];
  const state = usePosVoucherSettings(warehouseId);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search.trim().toLocaleLowerCase());
  const campaigns = useMemo(
    () => state.campaigns.filter((campaign) =>
      !deferredSearch || campaign.name.toLocaleLowerCase().includes(deferredSearch),
    ),
    [deferredSearch, state.campaigns],
  );

  const runSave = useCallback((
    campaignId: string,
    value: { enabled: boolean; productId: string; quantity: number },
  ) => {
    const promise = state.save(campaignId, value);
    gooeyToast.promise(promise, {
      loading: t.saving,
      success: t.saved,
      error: t.failed,
      description: { success: t.savedDescription, error: t.failedDescription },
      action: {
        error: { label: t.retry, onClick: () => runSave(campaignId, value) },
      },
    });
    void promise.catch((error) =>
      console.error("[PosVoucherSettingsPanel] save failed:", error),
    );
  }, [state, t]);

  return (
    <section className="space-y-3">
      <header className="flex items-start gap-2">
        <TicketCheck className="mt-0.5 text-amber-600" size={18} />
        <div>
          <h2 className="text-sm font-bold text-slate-900">{t.title}</h2>
          <p className="mt-1 text-xs text-slate-500">{t.hint}</p>
        </div>
      </header>
      <label className="relative block">
        <Search className="absolute left-3 top-2.5 text-slate-400" size={15} />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t.search}
          className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-amber-400"
        />
      </label>
      {state.error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
          {t.loadFailed}
        </p>
      ) : null}
      {state.loading ? (
        <div className="space-y-2" aria-label={t.saving}>
          {[0, 1, 2].map((item) => (
            <div key={item} className="h-24 animate-pulse rounded-lg bg-slate-100" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {campaigns.map((campaign) => {
            const setting = state.settings.find(
              (item) => item.campaign_id === campaign.id,
            );
            return (
              <PosVoucherSettingRow
                key={`${campaign.id}:${setting?.version ?? 0}`}
                campaign={campaign}
                setting={setting}
                products={state.products}
                disabled={!canManage || state.savingCampaignId === campaign.id}
                labels={t}
                onSave={(value) => runSave(campaign.id, value)}
              />
            );
          })}
          {campaigns.length === 0 ? (
            <p className="py-8 text-center text-xs text-slate-500">{t.empty}</p>
          ) : null}
        </div>
      )}
    </section>
  );
}
