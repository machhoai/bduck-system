"use client";

import { gooeyToast } from "goey-toast";
import { Link2 } from "lucide-react";
import { useEffect, useState } from "react";

import {
  fetchPartnerWarehouseMapping,
  savePartnerWarehouseMapping,
} from "@/api/partnerInventoryApi";
import { usePartnerInventoryMetadata } from "@/hooks/usePartnerInventoryMetadata";
import { useTranslation } from "@/lib/i18n";
import { PARTNER_INVENTORY_TEXT } from "@/lib/i18n/partnerInventoryTranslations";
import { useUserStore } from "@/stores/useUserStore";

export function PartnerWarehouseMappingField({
  warehouseId,
}: {
  warehouseId: string;
}) {
  const { lang } = useTranslation();
  const copy = PARTNER_INVENTORY_TEXT[lang === "zh" ? "zh" : "vi"];
  const canMap = useUserStore((state) =>
    state.hasPermission("partner_inventory.mapping.write", warehouseId),
  );
  const metadata = usePartnerInventoryMetadata(canMap);
  const [selectedId, setSelectedId] = useState("");
  const [savedId, setSavedId] = useState("");
  const [loadingMapping, setLoadingMapping] = useState(canMap);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!canMap) return;
    let disposed = false;
    setLoadingMapping(true);
    fetchPartnerWarehouseMapping(warehouseId)
      .then((mapping) => {
        if (disposed) return;
        const value = mapping?.partner_stock_id || "";
        setSelectedId(value);
        setSavedId(value);
      })
      .catch((error) =>
        console.error("[PartnerWarehouseMappingField] load failed:", error),
      )
      .finally(() => {
        if (!disposed) setLoadingMapping(false);
      });
    return () => {
      disposed = true;
    };
  }, [canMap, warehouseId]);

  if (!canMap) return null;
  const isLoading = metadata.loading || loadingMapping;
  const save = async () => {
    if (!selectedId || saving || selectedId === savedId) return;
    setSaving(true);
    const action = savePartnerWarehouseMapping(warehouseId, selectedId);
    void gooeyToast.promise(action, {
      loading: copy.mappingSaving,
      success: copy.mappingSaved,
      error: copy.mappingSaveError,
      description: { success: copy.warehouseMapping, error: copy.mappingSaveError },
      action: { error: { label: copy.retry, onClick: () => void save() } },
    });
    try {
      const mapping = await action;
      setSelectedId(mapping.partner_stock_id);
      setSavedId(mapping.partner_stock_id);
    } catch (error) {
      console.error("[PartnerWarehouseMappingField] save failed:", error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-surface-card)]/50 p-3.5 sm:p-4">
      <div className="flex items-center gap-2 border-b border-[var(--color-border-soft)] pb-2">
        <div className="flex h-5 w-5 items-center justify-center rounded-md bg-[var(--color-brand-primary-muted)] text-[var(--color-brand-primary)]">
          <Link2 size={13} />
        </div>
        <span className="text-xxs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
          {copy.warehouseMapping}
        </span>
      </div>

      {isLoading ? (
        <div className="h-8 animate-pulse rounded-lg bg-[var(--color-neutral-100)]" />
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row">
          <select
            value={selectedId}
            onChange={(event) => setSelectedId(event.target.value)}
            className="h-8 flex-1 rounded-lg border border-[var(--color-border-subtle)] bg-white px-3 text-sm text-[var(--color-text-primary)] outline-none transition-all focus:border-[var(--color-border-focus)] focus:ring-2 focus:ring-[var(--color-brand-primary)]/15"
          >
            <option value="">{copy.chooseWarehouse}</option>
            {metadata.warehouses.map((warehouse) => (
              <option key={warehouse.stock_id} value={warehouse.stock_id}>
                {warehouse.stock_name}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!selectedId || selectedId === savedId || saving}
            onClick={() => void save()}
            className="inline-flex h-8 items-center justify-center rounded-lg bg-[var(--color-brand-primary)] px-4 text-sm font-medium text-white shadow-xs transition-all hover:bg-[var(--color-brand-primary-hover)] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {copy.saveMapping}
          </button>
        </div>
      )}
      {(metadata.error || (!isLoading && metadata.warehouses.length === 0)) && (
        <p className="mt-1 text-xxs text-[var(--color-error-icon)]">
          {metadata.error || copy.mappingSaveError}
        </p>
      )}
    </div>
  );
}

