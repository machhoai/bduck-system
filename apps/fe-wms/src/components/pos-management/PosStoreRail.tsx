"use client";

import type { Warehouse } from "@bduck/shared-types";
import { Search, Store } from "lucide-react";
import { useMemo, useState } from "react";

import { usePosManagementCopy } from "./usePosManagementCopy";

export function PosStoreRail({ stores, activeId, onSelect }: {
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
      `${store.name} ${store.code || ""}`.toLocaleLowerCase().includes(normalized),
    );
  }, [query, stores]);

  return (
    <aside className="flex min-h-0 flex-col rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-100 p-3">
        <p className="text-xs font-bold uppercase text-slate-500">{copy.scope}</p>
        <div className="relative mt-2">
          <Search className="absolute left-2.5 top-2 text-slate-400" size={15} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={copy.searchStore} className="h-8 w-full rounded-lg border border-slate-200 pl-8 pr-2 text-sm outline-none focus:border-amber-500" />
        </div>
      </div>
      <div className="space-y-1 overflow-y-auto p-2">
        {filtered.map((store) => {
          const active = store.id === activeId;
          return (
            <button key={store.id} type="button" onClick={() => onSelect(store.id)} className={`flex h-11 w-full items-center gap-2 rounded-lg px-3 text-left ${active ? "bg-amber-50 text-amber-800" : "text-slate-600 hover:bg-slate-50"}`}>
              <Store size={16} />
              <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold">{store.name}</span><span className="block truncate text-xs opacity-70">{store.code || copy.noStoreCode}</span></span>
            </button>
          );
        })}
        {filtered.length === 0 && <p className="p-4 text-center text-xs text-slate-500">{copy.noStoreMatch}</p>}
      </div>
    </aside>
  );
}
