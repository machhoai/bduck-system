"use client";

import { gooeyToast } from "goey-toast";
import { RefreshCw, Search } from "lucide-react";
import { useCallback, useDeferredValue, useMemo, useState } from "react";

import { PosProductVisibilityGroup } from "./PosProductVisibilityGroup";
import { PosProductVisibilitySkeleton } from "./PosProductVisibilitySkeleton";

import { usePosProductVisibility } from "@/hooks/usePosProductVisibility";
import { useTranslation } from "@/lib/i18n";

const copy = {
  vi: {
    title: "Sản phẩm hiển thị trên JPOS",
    hint: "Sản phẩm mới được ẩn mặc định và chỉ xuất hiện trên POS sau khi bạn bật.",
    search: "Tìm sản phẩm hoặc nhóm phụ",
    shown: "Đang hiện",
    hidden: "Đã ẩn",
    empty: "Không có sản phẩm phù hợp.",
    productCount: "sản phẩm",
    saveLoading: "Đang cập nhật cấu hình…",
    saveSuccess: "Đã đồng bộ tới JPOS",
    saveError: "Không thể cập nhật cấu hình",
    saveSuccessDescription:
      "Thay đổi đang được gửi tức thì tới các máy JPOS của cửa hàng.",
    saveErrorDescription:
      "Cấu hình mới nhất sẽ được giữ nguyên. Vui lòng thử lại.",
    sync: "Đồng bộ sản phẩm",
    syncing: "Đang đồng bộ…",
    syncSuccess: "Đồng bộ sản phẩm thành công",
    syncError: "Không thể đồng bộ sản phẩm",
    syncSuccessDescription: "Sản phẩm mới đã được tải về ở trạng thái ẩn.",
    syncErrorDescription: "Không thể kết nối dịch vụ JPOS. Vui lòng thử lại.",
    retry: "Thử lại",
    newProducts: "sản phẩm mới đang ẩn",
    expand: "Mở nhóm sản phẩm",
    collapse: "Thu gọn nhóm sản phẩm",
  },
  zh: {
    title: "JPOS 显示商品",
    hint: "新商品默认隐藏，只有手动启用后才会显示在 POS 上。",
    search: "搜索商品或子分组",
    shown: "显示中",
    hidden: "已隐藏",
    empty: "没有匹配的商品。",
    productCount: "件商品",
    saveLoading: "正在更新设置…",
    saveSuccess: "已同步到 JPOS",
    saveError: "无法更新设置",
    saveSuccessDescription: "更改正在即时发送到该门店的 JPOS 设备。",
    saveErrorDescription: "最新设置保持不变，请重试。",
    sync: "同步商品",
    syncing: "正在同步…",
    syncSuccess: "商品同步成功",
    syncError: "无法同步商品",
    syncSuccessDescription: "新商品已下载并保持隐藏。",
    syncErrorDescription: "无法连接 JPOS 服务，请重试。",
    retry: "重试",
    newProducts: "件新商品已隐藏",
    expand: "展开商品组",
    collapse: "收起商品组",
  },
};

export function PosProductVisibilityPanel({
  warehouseId,
  canManage,
}: {
  warehouseId: string;
  canManage: boolean;
}) {
  const { lang } = useTranslation();
  const t = copy[lang === "zh" ? "zh" : "vi"];
  const visibility = usePosProductVisibility(warehouseId, t.saveError);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [collapsedGroupKeys, setCollapsedGroupKeys] = useState<Set<string>>(
    () => new Set(),
  );
  const {
    lastSyncResult,
    loading,
    products,
    save,
    saving,
    settings,
    sync,
    syncing,
  } = visibility;

  const groups = useMemo(() => {
    const query = deferredSearch
      .trim()
      .toLocaleLowerCase(lang === "zh" ? "zh" : "vi");
    const grouped = new Map<string, typeof products>();
    for (const product of products) {
      const matches =
        !query ||
        [product.goods_name, product.goods_id, product.group_name].some(
          (value) => value.toLocaleLowerCase().includes(query),
        );
      if (!matches) continue;
      grouped.set(product.group_key, [
        ...(grouped.get(product.group_key) ?? []),
        product,
      ]);
    }
    return [...grouped.entries()];
  }, [deferredSearch, lang, products]);

  const runSave = useCallback(
    (groupsToDisable: string[], productsToDisable: string[]) => {
      const promise = save(groupsToDisable, productsToDisable);
      gooeyToast.promise(promise, {
        loading: t.saveLoading,
        success: t.saveSuccess,
        error: t.saveError,
        description: {
          success: t.saveSuccessDescription,
          error: t.saveErrorDescription,
        },
        action: {
          error: {
            label: t.retry,
            onClick: () => runSave(groupsToDisable, productsToDisable),
          },
        },
      });
      void promise.catch((error) =>
        console.error("[PosProductVisibilityPanel] save failed:", error),
      );
    },
    [save, t],
  );

  const runSync = useCallback(
    (requestId = crypto.randomUUID()) => {
      const promise = sync(requestId);
      gooeyToast.promise(promise, {
        loading: t.syncing,
        success: t.syncSuccess,
        error: t.syncError,
        description: {
          success: t.syncSuccessDescription,
          error: t.syncErrorDescription,
        },
        action: {
          error: { label: t.retry, onClick: () => runSync(requestId) },
        },
      });
      void promise.catch((error) =>
        console.error("[PosProductVisibilityPanel] sync failed:", error),
      );
    },
    [sync, t],
  );

  const disabledGroups = new Set(settings?.disabled_group_keys ?? []);
  const disabledProducts = new Set(settings?.disabled_product_ids ?? []);
  const controlsDisabled = !canManage || saving || syncing;

  if (loading) return <PosProductVisibilitySkeleton />;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-sm font-bold text-slate-900">{t.title}</h2>
          <p className="mt-1 text-xs text-slate-500">{t.hint}</p>
          {lastSyncResult ? (
            <p className="mt-1 text-xs font-semibold text-amber-700">
              {lastSyncResult.newProductCount} {t.newProducts}
            </p>
          ) : null}
        </div>
        {canManage && (
          <button
            type="button"
            disabled={controlsDisabled}
            onClick={() => runSync()}
            className="flex h-10 w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 text-xs font-bold text-white shadow-sm transition-colors hover:bg-amber-600 disabled:opacity-50 sm:h-9 sm:w-auto sm:rounded-lg"
          >
            <RefreshCw size={15} className={syncing ? "animate-spin" : ""} />
            {syncing ? t.syncing : t.sync}
          </button>
        )}
      </div>
      <label className="relative block">
        <Search className="absolute left-3 top-2.5 text-slate-400" size={15} />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t.search}
          className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-xs outline-none transition-colors focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
        />
      </label>
      <div className="space-y-3">
        {groups.map(([groupKey, items]) => (
          <PosProductVisibilityGroup
            key={groupKey}
            groupKey={groupKey}
            items={items}
            collapsed={search.trim() ? false : collapsedGroupKeys.has(groupKey)}
            groupDisabled={disabledGroups.has(groupKey)}
            disabledProductIds={disabledProducts}
            disabled={controlsDisabled}
            labels={t}
            onCollapse={(key) =>
              setCollapsedGroupKeys((current) => {
                const next = new Set(current);
                if (next.has(key)) next.delete(key);
                else next.add(key);
                return next;
              })
            }
            onToggleGroup={(key) => {
              const next = new Set(disabledGroups);
              if (next.has(key)) next.delete(key);
              else next.add(key);
              runSave([...next], [...disabledProducts]);
            }}
            onToggleProduct={(productId) => {
              const next = new Set(disabledProducts);
              if (next.has(productId)) next.delete(productId);
              else next.add(productId);
              runSave([...disabledGroups], [...next]);
            }}
          />
        ))}
        {groups.length === 0 && (
          <p className="py-8 text-center text-xs text-slate-500">{t.empty}</p>
        )}
      </div>
    </div>
  );
}
