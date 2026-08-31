"use client";

import type {
  PosProductVisibilityCatalogItem,
  PosProductVisibilitySettings,
} from "@bduck/shared-types";
import { doc, onSnapshot } from "firebase/firestore";
import { gooeyToast } from "goey-toast";
import { Eye, EyeOff, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { posManagementApi } from "@/api/posManagementApi";
import { db } from "@/lib/firebase";
import { useTranslation } from "@/lib/i18n";

const copy = {
  vi: {
    title: "Sản phẩm hiển thị trên JPOS",
    hint: "Bật hoặc tắt từng sản phẩm hay toàn bộ nhóm phụ. Thay đổi được áp dụng ngay cho cửa hàng này.",
    search: "Tìm sản phẩm hoặc nhóm phụ",
    shown: "Đang hiện",
    hidden: "Đã ẩn",
    loading: "Đang tải danh mục…",
    empty: "Không có sản phẩm phù hợp.",
    productCount: "sản phẩm",
    saved: "Đã đồng bộ tới JPOS.",
    failed: "Không thể cập nhật. Cấu hình mới nhất sẽ được tải lại.",
  },
  zh: {
    title: "JPOS 显示商品",
    hint: "按商品或子分组启用/停用；更改立即应用于当前门店。",
    search: "搜索商品或子分组",
    shown: "显示中",
    hidden: "已隐藏",
    loading: "正在加载商品目录…",
    empty: "没有匹配的商品。",
    productCount: "件商品",
    saved: "已同步到 JPOS。",
    failed: "更新失败，将加载最新配置。",
  },
};

const mapSnapshot = (
  warehouseId: string,
  value: Record<string, unknown>,
): PosProductVisibilitySettings =>
  ({ id: warehouseId, warehouse_id: warehouseId, ...value }) as PosProductVisibilitySettings;

export function PosProductVisibilityPanel({
  warehouseId,
  canManage,
}: {
  warehouseId: string;
  canManage: boolean;
}) {
  const { lang } = useTranslation();
  const t = copy[lang === "zh" ? "zh" : "vi"];
  const [products, setProducts] = useState<PosProductVisibilityCatalogItem[]>([]);
  const [settings, setSettings] = useState<PosProductVisibilitySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    void posManagementApi
      .getProductVisibilitySettings(warehouseId)
      .then((view) => {
        if (!active) return;
        setProducts(view.products);
        setSettings(view.settings);
      })
      .catch((error) => gooeyToast.error(error instanceof Error ? error.message : t.failed))
      .finally(() => active && setLoading(false));

    const unsubscribe = onSnapshot(
      doc(db, "pos_product_visibility_settings", warehouseId),
      (snapshot) => {
        if (active) setSettings(snapshot.exists() ? mapSnapshot(warehouseId, snapshot.data()) : null);
      },
      (error) => console.error("[PosProductVisibilityPanel] snapshot failed:", error),
    );
    return () => {
      active = false;
      unsubscribe();
    };
  }, [t.failed, warehouseId]);

  const groups = useMemo(() => {
    const query = search.trim().toLocaleLowerCase(lang === "zh" ? "zh" : "vi");
    const grouped = new Map<string, PosProductVisibilityCatalogItem[]>();
    for (const product of products) {
      if (
        query &&
        ![product.goods_name, product.goods_id, product.group_name].some((value) =>
          value.toLocaleLowerCase().includes(query),
        )
      ) continue;
      grouped.set(product.group_key, [...(grouped.get(product.group_key) ?? []), product]);
    }
    return [...grouped.entries()];
  }, [lang, products, search]);

  const save = useCallback(async (
    disabledGroupKeys: string[],
    disabledProductIds: string[],
  ) => {
    if (saving || !canManage) return;
    setSaving(true);
    try {
      const next = await posManagementApi.saveProductVisibilitySettings(warehouseId, {
        expected_version: settings?.version ?? 0,
        disabled_group_keys: disabledGroupKeys,
        disabled_product_ids: disabledProductIds,
        action_time: new Date().toISOString(),
      });
      setSettings(next);
      gooeyToast.success(t.saved);
    } catch (error) {
      console.error("[PosProductVisibilityPanel] save failed:", error);
      gooeyToast.error(t.failed);
    } finally {
      setSaving(false);
    }
  }, [canManage, saving, settings?.version, t.failed, t.saved, warehouseId]);

  const disabledGroups = new Set(settings?.disabled_group_keys ?? []);
  const disabledProducts = new Set(settings?.disabled_product_ids ?? []);

  if (loading) {
    return <div className="h-52 animate-pulse rounded-xl bg-slate-100" aria-label={t.loading} />;
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-bold text-slate-900">{t.title}</h2>
        <p className="mt-1 text-xs text-slate-500">{t.hint}</p>
      </div>
      <label className="relative block">
        <Search className="absolute left-3 top-2.5 text-slate-400" size={15} />
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t.search} className="h-9 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-xs outline-none focus:border-amber-400" />
      </label>
      <div className="space-y-3">
        {groups.map(([groupKey, items]) => {
          const groupDisabled = disabledGroups.has(groupKey);
          return (
            <section key={groupKey} className="overflow-hidden rounded-xl border border-slate-200">
              <button type="button" disabled={!canManage || saving} onClick={() => {
                const next = new Set(disabledGroups);
                if (groupDisabled) next.delete(groupKey);
                else next.add(groupKey);
                void save([...next], [...disabledProducts]);
              }} className="flex w-full items-center justify-between bg-slate-50 px-4 py-3 text-left disabled:opacity-60">
                <span><span className="block text-xs font-bold text-slate-900">{items[0]?.group_name}</span><span className="text-xxs text-slate-500">{items.length} {t.productCount}</span></span>
                <span className={`flex items-center gap-1 text-xs font-bold ${groupDisabled ? "text-slate-500" : "text-emerald-700"}`}>{groupDisabled ? <EyeOff size={15} /> : <Eye size={15} />}{groupDisabled ? t.hidden : t.shown}</span>
              </button>
              <div className="divide-y divide-slate-100">
                {items.map((product) => {
                  const productDisabled = disabledProducts.has(product.goods_id);
                  const effectivelyDisabled = groupDisabled || productDisabled;
                  return <button key={product.goods_id} type="button" disabled={!canManage || saving || groupDisabled} onClick={() => {
                    const next = new Set(disabledProducts);
                    if (productDisabled) next.delete(product.goods_id);
                    else next.add(product.goods_id);
                    void save([...disabledGroups], [...next]);
                  }} className="flex w-full items-center justify-between px-4 py-2.5 text-left disabled:opacity-50"><span><span className="block text-xs font-semibold text-slate-800">{product.goods_name}</span><span className="text-xxs text-slate-400">{product.goods_id}</span></span><span className={effectivelyDisabled ? "text-slate-400" : "text-emerald-600"}>{effectivelyDisabled ? <EyeOff size={15} /> : <Eye size={15} />}</span></button>;
                })}
              </div>
            </section>
          );
        })}
        {groups.length === 0 && <p className="py-8 text-center text-xs text-slate-500">{t.empty}</p>}
      </div>
    </div>
  );
}
