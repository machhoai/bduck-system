"use client";

import type { Warehouse } from "@bduck/shared-types";
import { Check, Search, Store } from "lucide-react";
import { useMemo, useState } from "react";

import { BottomSheet } from "@/components/ui/BottomSheet";

import { usePosManagementCopy } from "./usePosManagementCopy";

interface PosMobileStoreSheetProps {
  isOpen: boolean;
  stores: Warehouse[];
  activeId: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}

export function PosMobileStoreSheet({
  isOpen,
  stores,
  activeId,
  onSelect,
  onClose,
}: PosMobileStoreSheetProps) {
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
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={copy.scope}
      defaultSnap="half"
      mobileBreakpoint="lg"
      contentClassName="flex flex-col gap-2 overflow-y-auto px-4 pb-6"
    >
      {/* Search Bar */}
      <div className="pt-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 text-slate-400" size={14} />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={copy.searchStore}
            className="h-8 w-full rounded-lg border border-slate-200 pl-8 pr-3 text-xs outline-none focus:border-amber-500"
          />
        </div>
      </div>

      {/* Store List */}
      <div className="mt-1 space-y-1.5">
        {filtered.map((store) => {
          const isActive = store.id === activeId;
          return (
            <button
              key={store.id}
              type="button"
              onClick={() => {
                onSelect(store.id);
                onClose();
              }}
              className={`flex w-full items-center justify-between rounded-xl p-2.5 text-left transition-colors ${
                isActive
                  ? "bg-amber-50 border border-amber-200 text-amber-900 font-bold"
                  : "border border-slate-100 text-slate-700 hover:bg-slate-50 active:bg-slate-100"
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                    isActive ? "bg-amber-500 text-white" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  <Store size={16} />
                </div>
                <div className="min-w-0">
                  <span className="block truncate text-xs font-bold text-slate-900">
                    {store.name}
                  </span>
                  <span className="block truncate text-xxs text-slate-400">
                    {store.code || copy.noStoreCode}
                  </span>
                </div>
              </div>
              {isActive && (
                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500 text-white">
                  <Check size={12} />
                </div>
              )}
            </button>
          );
        })}

        {filtered.length === 0 && (
          <p className="p-6 text-center text-xs text-slate-400">
            {copy.noStoreMatch}
          </p>
        )}
      </div>
    </BottomSheet>
  );
}
