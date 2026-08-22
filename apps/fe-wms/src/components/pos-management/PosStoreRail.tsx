"use client";

import type { Warehouse } from "@bduck/shared-types";
import { CheckCircle2, Search, Store } from "lucide-react";
import { useMemo, useState } from "react";

import { usePosManagementCopy } from "./usePosManagementCopy";

export function PosStoreRail({
  stores,
  activeId,
  onSelect,
}: {
  stores: Warehouse[];
  activeId: string;
  onSelect: (id: string) => void;
}) {
  const copy = usePosManagementCopy();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return stores;
    return stores.filter((store) =>
      `${store.name} ${store.code || ""}`
        .toLocaleLowerCase()
        .includes(normalized),
    );
  }, [query, stores]);

  return (
    <aside className="hidden flex-col rounded-xl border border-slate-200 bg-white shadow-xs lg:flex">
      {/* Header & Search */}
      <div className="border-b border-slate-100 p-3">
        <div className="flex items-center justify-between">
          <p className="text-xxs font-bold uppercase tracking-wider text-slate-500">
            {copy.scope}
          </p>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xxs font-bold text-slate-600">
            {stores.length}
          </span>
        </div>
        <div className="relative mt-2">
          <Search
            className="absolute left-2.5 top-2.5 text-slate-400"
            size={14}
          />
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={copy.searchStore}
            className="h-8 w-full rounded-lg border border-slate-200 bg-slate-50/50 pl-8 pr-2 text-xs outline-none focus:border-amber-500 focus:bg-white transition-colors"
          />
        </div>
      </div>

      {/* Store List */}
      <div className="space-y-1 overflow-y-auto p-2">
        {filtered.map((store) => {
          const active = store.id === activeId;
          return (
            <button
              key={store.id}
              type="button"
              onClick={() => onSelect(store.id)}
              className={`group flex w-full items-center justify-between rounded-lg p-2.5 text-left transition-all ${
                active
                  ? "bg-amber-500 text-white shadow-xs font-bold"
                  : "text-slate-700 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <Store
                  size={16}
                  className={`shrink-0 ${active ? "text-white" : "text-amber-600"}`}
                />
                <div className="min-w-0">
                  <span className="block truncate text-xs font-bold leading-tight">
                    {store.name}
                  </span>
                  <span
                    className={`block truncate text-xxs ${
                      active ? "text-amber-100" : "text-slate-400"
                    }`}
                  >
                    {store.code || copy.noStoreCode}
                  </span>
                </div>
              </div>
              {active && (
                <CheckCircle2 size={15} className="shrink-0 text-white" />
              )}
            </button>
          );
        })}
        {filtered.length === 0 && (
          <p className="p-4 text-center text-xs text-slate-400">
            {copy.noStoreMatch}
          </p>
        )}
      </div>
    </aside>
  );
}
