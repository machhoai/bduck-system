"use client";

import { gooeyToast } from "goey-toast";
import { Link2 } from "lucide-react";
import { useEffect, useState } from "react";

import {
  fetchPartnerCategoryMapping,
  savePartnerCategoryMapping,
} from "@/api/partnerInventoryApi";
import { usePartnerInventoryMetadata } from "@/hooks/usePartnerInventoryMetadata";
import { useTranslation } from "@/lib/i18n";
import { PARTNER_INVENTORY_TEXT } from "@/lib/i18n/partnerInventoryTranslations";
import { useUserStore } from "@/stores/useUserStore";

export function PartnerCategoryMappingField({ categoryId }: { categoryId: string }) {
  const { lang } = useTranslation();
  const copy = PARTNER_INVENTORY_TEXT[lang === "zh" ? "zh" : "vi"];
  const canMap = useUserStore(
    (state) =>
      state.hasPermission("partner_inventory.mapping.write") &&
      state.hasPermission("category.update"),
  );
  const metadata = usePartnerInventoryMetadata(canMap);
  const [selectedId, setSelectedId] = useState("");
  const [savedId, setSavedId] = useState("");
  const [loading, setLoading] = useState(canMap);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!canMap) return;
    let disposed = false;
    fetchPartnerCategoryMapping(categoryId)
      .then((mapping) => {
        if (disposed) return;
        const value = mapping?.partner_type_id || "";
        setSelectedId(value);
        setSavedId(value);
      })
      .catch((error) =>
        console.error("[PartnerCategoryMappingField] load failed:", error),
      )
      .finally(() => {
        if (!disposed) setLoading(false);
      });
    return () => {
      disposed = true;
    };
  }, [canMap, categoryId]);

  if (!canMap) return null;
  const save = async () => {
    if (!selectedId || saving || selectedId === savedId) return;
    setSaving(true);
    const action = savePartnerCategoryMapping(categoryId, selectedId);
    void gooeyToast.promise(action, {
      loading: copy.mappingSaving,
      success: copy.mappingSaved,
      error: copy.mappingSaveError,
      description: { success: copy.categoryMapping, error: copy.mappingSaveError },
      action: { error: { label: copy.retry, onClick: () => void save() } },
    });
    try {
      const mapping = await action;
      setSavedId(mapping.partner_type_id);
    } catch (error) {
      console.error("[PartnerCategoryMappingField] save failed:", error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-neutral-50)] p-4">
      <div className="mb-3 flex items-center gap-2">
        <Link2 size={16} className="text-[var(--color-brand-primary)]" />
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
          {copy.categoryMapping}
        </h3>
      </div>
      {loading || metadata.loading ? (
        <div className="h-10 animate-pulse rounded-xl bg-[var(--color-neutral-100)]" />
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row">
          <select
            value={selectedId}
            onChange={(event) => setSelectedId(event.target.value)}
            className="h-10 flex-1 rounded-xl border border-[var(--color-border-subtle)] bg-white px-3 text-sm outline-none focus:border-[var(--color-border-focus)]"
          >
            <option value="">{copy.chooseGiftType}</option>
            {metadata.giftTypes.map((type) => (
              <option key={type.type_id} value={type.type_id}>
                {type.type_name}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!selectedId || selectedId === savedId || saving}
            onClick={() => void save()}
            className="h-10 rounded-xl bg-[var(--color-brand-primary)] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {copy.saveMapping}
          </button>
        </div>
      )}
    </section>
  );
}
