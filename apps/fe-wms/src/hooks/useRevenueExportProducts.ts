"use client";

import type { RevenueExportProductOption } from "@bduck/shared-types";
import { gooeyToast } from "goey-toast";
import { useEffect, useRef, useState } from "react";

import { app } from "@/lib/firebase";
import { useTranslation } from "@/lib/i18n";
import { useUserStore } from "@/stores/useUserStore";
import {
  readRevenueExportAliases,
  revenueExportPreferenceKey,
  writeRevenueExportAliases,
  type RevenueExportAliases,
} from "@/utils/revenueExportPreferences";

export function useRevenueExportProducts(
  products: RevenueExportProductOption[],
  source: string,
) {
  const { t } = useTranslation();
  const userId = useUserStore((state) => state.user?.id ?? "");
  const key = revenueExportPreferenceKey(
    app.options.projectId ?? "",
    userId,
    source,
  );
  const [aliases, setAliases] = useState<RevenueExportAliases>({});
  const [loadedKey, setLoadedKey] = useState("");
  const [defaultSelected, setDefaultSelected] = useState(true);
  const [selection, setSelection] = useState<Record<string, boolean>>({});
  const [useOriginalNames, setUseOriginalNames] = useState(false);
  const notified = useRef(false);
  const errorMessage = t.revenue.export.preferencesError;
  useEffect(() => {
    try {
      setAliases(readRevenueExportAliases(window.localStorage, key));
    } catch (error) {
      console.error("[revenueExportPreferences] read:", error);
      setAliases({});
      gooeyToast.error(errorMessage);
    }
    setLoadedKey(key);
    notified.current = false;
  }, [key, errorMessage]);
  const currentAliases = loadedKey === key ? aliases : {};
  const rename = (productKey: string, name: string) => {
    const next = { ...currentAliases, [productKey]: name };
    setAliases(next);
    try {
      if (userId && loadedKey === key)
        writeRevenueExportAliases(window.localStorage, key, next);
    } catch (error) {
      console.error("[revenueExportPreferences] save:", error);
      if (!notified.current) gooeyToast.error(errorMessage);
      notified.current = true;
    }
  };
  const reset = (productKey: string) => {
    const next = { ...currentAliases };
    delete next[productKey];
    setAliases(next);
    try {
      if (userId && loadedKey === key)
        writeRevenueExportAliases(window.localStorage, key, next);
    } catch (error) {
      console.error("[revenueExportPreferences] reset:", error);
      if (!notified.current) gooeyToast.error(errorMessage);
      notified.current = true;
    }
  };
  const isSelected = (productKey: string) =>
    selection[productKey] ?? defaultSelected;
  const selected = products.filter((product) => isSelected(product.key));
  return {
    aliases: currentAliases,
    rename,
    reset,
    isSelected,
    selected,
    useOriginalNames,
    setUseOriginalNames,
    toggle: (productKey: string) =>
      setSelection((previous) => ({
        ...previous,
        [productKey]: !(previous[productKey] ?? defaultSelected),
      })),
    selectAll: (value: boolean) => {
      setDefaultSelected(value);
      setSelection({});
    },
    payload: selected.map((product) => ({
      key: product.key,
      exportName: useOriginalNames
        ? undefined
        : currentAliases[product.key]?.trim() || undefined,
    })),
    preferencesLoading: loadedKey !== key,
  };
}
