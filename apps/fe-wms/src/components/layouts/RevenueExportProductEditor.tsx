"use client";

import type { RevenueExportProductOption } from "@bduck/shared-types";
import { RotateCcw, Search } from "lucide-react";
import { useState } from "react";

import type { useRevenueExportProducts } from "@/hooks/useRevenueExportProducts";
import { useTranslation } from "@/lib/i18n";

interface Props {
  products: RevenueExportProductOption[];
  editor: ReturnType<typeof useRevenueExportProducts>;
  disabled: boolean;
  loading?: boolean;
  error?: string | null;
}

export function RevenueExportProductEditor({
  products,
  editor,
  disabled,
  loading,
  error,
}: Props) {
  const { t, lang } = useTranslation();
  const copy = t.revenue.export;
  const [search, setSearch] = useState("");
  const query = search.trim().toLocaleLowerCase();
  const visible = products.filter((product) =>
    `${product.name} ${product.groupName} ${editor.aliases[product.key] ?? ""}`
      .toLocaleLowerCase()
      .includes(query),
  );
  const number = new Intl.NumberFormat(lang === "zh" ? "zh-CN" : "vi-VN");
  return (
    <fieldset
      disabled={disabled}
      className="min-w-0 space-y-3 disabled:opacity-60"
    >
      <legend className="mb-2 text-sm font-bold text-slate-800">
        {copy.productsTitle}
      </legend>
      <p className="text-xs leading-5 text-slate-500">
        {copy.rememberNamesHint}
      </p>
      {loading ? (
        <div role="status" aria-label={t.revenue.syncing} className="space-y-2">
          {[0, 1, 2].map((row) => (
            <div
              key={row}
              className="h-16 animate-pulse rounded-lg bg-slate-100"
            />
          ))}
        </div>
      ) : error ? (
        <p
          role="alert"
          className="rounded-lg bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </p>
      ) : !products.length ? (
        <p
          role="status"
          className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800"
        >
          {copy.noProducts}
        </p>
      ) : (
        <>
          <div className="relative">
            <Search
              size={16}
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-3 text-slate-400"
            />
            <input
              type="search"
              aria-label={copy.searchProducts}
              placeholder={copy.searchProducts}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span aria-live="polite" className="font-semibold text-slate-700">
              {copy.selectedCount
                .replace("{selected}", String(editor.selected.length))
                .replace("{total}", String(products.length))}
            </span>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => editor.selectAll(true)}
                className="min-h-9 font-semibold text-emerald-700 hover:underline"
              >
                {copy.selectAll}
              </button>
              <button
                type="button"
                onClick={() => editor.selectAll(false)}
                className="min-h-9 font-semibold text-slate-500 hover:underline"
              >
                {copy.clearSelection}
              </button>
            </div>
          </div>
          <label className="flex min-h-9 items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={editor.useOriginalNames}
              onChange={(event) =>
                editor.setUseOriginalNames(event.target.checked)
              }
              className="h-4 w-4 accent-emerald-600"
            />
            {copy.useOriginalNames}
          </label>
          <div className="max-h-72 overflow-y-auto overscroll-contain rounded-lg border border-slate-200">
            {!visible.length && (
              <p className="p-4 text-sm text-slate-500">
                {copy.noSearchResults}
              </p>
            )}
            {visible.map((product) => (
              <div
                key={product.key}
                className="grid gap-3 border-b border-slate-100 p-3 last:border-0 sm:grid-cols-2"
              >
                <label className="flex min-w-0 items-start gap-3">
                  <input
                    type="checkbox"
                    checked={editor.isSelected(product.key)}
                    onChange={() => editor.toggle(product.key)}
                    className="mt-1 h-4 w-4 shrink-0 accent-emerald-600"
                  />
                  <span className="min-w-0 text-sm font-semibold text-slate-800">
                    <span className="block break-words">{product.name}</span>
                    <span className="mt-1 block text-xs font-normal text-slate-500">
                      {product.groupName} · {number.format(product.quantity)} ·{" "}
                      {number.format(product.revenue)} ₫
                    </span>
                  </span>
                </label>
                <div className="flex items-center gap-1 pl-7 sm:pl-0">
                  <input
                    type="text"
                    aria-label={`${copy.exportName}: ${product.name} (${product.groupName})`}
                    value={
                      editor.useOriginalNames
                        ? product.name
                        : (editor.aliases[product.key] ?? product.name)
                    }
                    maxLength={200}
                    disabled={
                      disabled ||
                      editor.useOriginalNames ||
                      !editor.isSelected(product.key)
                    }
                    onChange={(event) =>
                      editor.rename(product.key, event.target.value)
                    }
                    className="h-10 min-w-0 flex-1 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-50 disabled:text-slate-400"
                  />
                  <button
                    type="button"
                    aria-label={`${copy.resetName}: ${product.name}`}
                    title={copy.resetName}
                    disabled={
                      disabled ||
                      editor.useOriginalNames ||
                      !editor.isSelected(product.key)
                    }
                    onClick={() => editor.reset(product.key)}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-40"
                  >
                    <RotateCcw size={15} aria-hidden="true" />
                  </button>
                </div>
              </div>
            ))}
          </div>
          {!editor.selected.length && (
            <p role="status" className="text-xs text-amber-700">
              {copy.selectAtLeastOne}
            </p>
          )}
        </>
      )}
    </fieldset>
  );
}
