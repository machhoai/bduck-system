"use client";

import type { PosProductVisibilityCatalogItem } from "@bduck/shared-types";
import { ChevronDown, ChevronRight, Eye, EyeOff } from "lucide-react";

interface PosProductVisibilityGroupProps {
  groupKey: string;
  items: PosProductVisibilityCatalogItem[];
  collapsed: boolean;
  groupDisabled: boolean;
  disabledProductIds: ReadonlySet<string>;
  disabled: boolean;
  labels: {
    shown: string;
    hidden: string;
    productCount: string;
    expand: string;
    collapse: string;
  };
  onCollapse: (groupKey: string) => void;
  onToggleGroup: (groupKey: string) => void;
  onToggleProduct: (productId: string) => void;
}

export function PosProductVisibilityGroup({
  groupKey,
  items,
  collapsed,
  groupDisabled,
  disabledProductIds,
  disabled,
  labels,
  onCollapse,
  onToggleGroup,
  onToggleProduct,
}: PosProductVisibilityGroupProps) {
  const groupName = items[0]?.group_name || groupKey;
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center gap-2 bg-slate-50 px-2 py-2 sm:px-3">
        <button
          type="button"
          aria-expanded={!collapsed}
          aria-label={collapsed ? labels.expand : labels.collapse}
          onClick={() => onCollapse(groupKey)}
          className="grid size-9 shrink-0 place-items-center rounded-lg text-slate-500 transition-colors hover:bg-white hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
        >
          {collapsed ? <ChevronRight size={17} /> : <ChevronDown size={17} />}
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-bold text-slate-900">
            {groupName}
          </p>
          <p className="text-xxs text-slate-500">
            {items.length} {labels.productCount}
          </p>
        </div>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onToggleGroup(groupKey)}
          className={`flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-xs font-bold transition-colors disabled:opacity-50 ${
            groupDisabled
              ? "bg-slate-200 text-slate-600 hover:bg-slate-300"
              : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
          }`}
        >
          {groupDisabled ? <EyeOff size={15} /> : <Eye size={15} />}
          <span className="hidden sm:inline">
            {groupDisabled ? labels.hidden : labels.shown}
          </span>
        </button>
      </div>
      {!collapsed && (
        <div className="divide-y divide-slate-100">
          {items.map((product) => {
            const productDisabled = disabledProductIds.has(product.goods_id);
            const effectivelyDisabled = groupDisabled || productDisabled;
            return (
              <button
                key={product.goods_id}
                type="button"
                disabled={disabled || groupDisabled}
                onClick={() => onToggleProduct(product.goods_id)}
                className="flex min-h-11 w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors hover:bg-amber-50/40 disabled:opacity-50"
              >
                <span className="min-w-0">
                  <span className="block truncate text-xs font-semibold text-slate-800">
                    {product.goods_name}
                  </span>
                  <span className="block truncate text-xxs text-slate-400">
                    {product.goods_id}
                  </span>
                </span>
                <span
                  className={
                    effectivelyDisabled ? "text-slate-400" : "text-emerald-600"
                  }
                >
                  {effectivelyDisabled ? (
                    <EyeOff size={16} />
                  ) : (
                    <Eye size={16} />
                  )}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
