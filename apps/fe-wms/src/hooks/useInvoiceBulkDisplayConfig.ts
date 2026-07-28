"use client";

import type {
  InvoiceBulkIssueDisplayConfig,
  InvoiceBulkSelectionMode,
} from "@bduck/shared-types";
import { useEffect, useMemo, useState } from "react";
import {
  invoiceApi,
  type InvoiceBulkIssueSelectionPayload,
} from "@/api/invoiceApi";
import { showToast } from "@/utils/toast";

const sortedEntries = (mapping: Record<string, string>) =>
  Object.entries(mapping).sort(([left], [right]) => left.localeCompare(right));

const sameMapping = (
  left: Record<string, string>,
  right: Record<string, string>,
) =>
  JSON.stringify(sortedEntries(left)) === JSON.stringify(sortedEntries(right));

const withMappingValue = (
  current: Record<string, string>,
  source: string,
  target: string,
) => {
  const next = { ...current };
  const normalized = target.trim();
  if (normalized) next[source] = normalized;
  else delete next[source];
  return next;
};

export const useInvoiceBulkDisplayConfig = ({
  warehouseId,
  businessDate,
  selectedIds,
  canIssue,
  lang,
  onError,
}: {
  warehouseId: string;
  businessDate: string;
  selectedIds: string[];
  canIssue: boolean;
  lang: "vi" | "zh";
  onError: (message: string | null) => void;
}) => {
  const [selection, setSelection] =
    useState<InvoiceBulkIssueSelectionPayload | null>(null);
  const [configOpen, setConfigOpen] = useState(false);
  const [displayConfig, setDisplayConfig] =
    useState<InvoiceBulkIssueDisplayConfig | null>(null);
  const [itemNameMapping, setItemNameMapping] = useState<
    Record<string, string>
  >({});
  const [itemUnitMapping, setItemUnitMapping] = useState<
    Record<string, string>
  >({});
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);

  const configDirty = useMemo(
    () =>
      Boolean(displayConfig) &&
      (!sameMapping(itemNameMapping, displayConfig?.item_name_mapping ?? {}) ||
        !sameMapping(itemUnitMapping, displayConfig?.item_unit_mapping ?? {})),
    [displayConfig, itemNameMapping, itemUnitMapping],
  );

  useEffect(() => {
    setSelection(null);
    setConfigOpen(false);
    setDisplayConfig(null);
    setItemNameMapping({});
    setItemUnitMapping({});
  }, [warehouseId, businessDate]);

  const startConfiguration = async (mode: InvoiceBulkSelectionMode) => {
    if (!warehouseId || !canIssue || loadingConfig) return;
    setSelection({
      warehouse_id: warehouseId,
      business_date: businessDate,
      selection_mode: mode,
      source_order_ids: mode === "SELECTED" ? selectedIds : [],
    });
    setConfigOpen(true);
    setDisplayConfig(null);
    setLoadingConfig(true);
    onError(null);
    try {
      const nextConfig = await invoiceApi.getBulkIssueDisplayConfig(
        warehouseId,
        businessDate,
      );
      setDisplayConfig(nextConfig);
      setItemNameMapping(nextConfig.item_name_mapping);
      setItemUnitMapping(nextConfig.item_unit_mapping);
    } catch (error) {
      console.error("[useInvoiceBulkDisplayConfig] load", error);
      const message =
        error instanceof Error
          ? error.message
          : "Unable to load bulk invoice display config.";
      onError(message);
      setConfigOpen(false);
      showToast.error(
        lang === "vi" ? "Không thể tải cấu hình" : "无法加载配置",
        message,
      );
    } finally {
      setLoadingConfig(false);
    }
  };

  const saveDisplayConfig = async () => {
    if (!displayConfig || savingConfig || !configDirty) return;
    setSavingConfig(true);
    onError(null);
    const operation = invoiceApi.saveBulkIssueDisplayConfig(
      warehouseId,
      businessDate,
      {
        item_name_mapping: itemNameMapping,
        item_unit_mapping: itemUnitMapping,
      },
    );
    try {
      const saved = await showToast.promise(operation, {
        loading: lang === "vi" ? "Đang lưu cấu hình…" : "正在保存配置…",
        success: lang === "vi" ? "Đã lưu cấu hình" : "配置已保存",
        error: lang === "vi" ? "Không thể lưu cấu hình" : "无法保存配置",
        successDescription:
          lang === "vi"
            ? "Tên sản phẩm và đơn vị sẽ được áp dụng khi xuất hóa đơn."
            : "商品名称和单位将在开票时应用。",
        errorDescription: (error) =>
          error instanceof Error ? error.message : "Unknown error",
        retry: () => void saveDisplayConfig(),
        retryLabel: lang === "vi" ? "Thử lại" : "重试",
      });
      setDisplayConfig(saved);
      setItemNameMapping(saved.item_name_mapping);
      setItemUnitMapping(saved.item_unit_mapping);
    } catch (error) {
      console.error("[useInvoiceBulkDisplayConfig] save", error);
      onError(
        error instanceof Error ? error.message : "Unable to save config.",
      );
    } finally {
      setSavingConfig(false);
    }
  };

  return {
    selection,
    configOpen,
    displayConfig,
    itemNameMapping,
    itemUnitMapping,
    loadingConfig,
    savingConfig,
    configDirty,
    startConfiguration,
    saveDisplayConfig,
    closeConfiguration: () => setConfigOpen(false),
    changeItemName: (source: string, target: string) =>
      setItemNameMapping((current) =>
        withMappingValue(current, source, target),
      ),
    changeItemUnit: (source: string, target: string) =>
      setItemUnitMapping((current) =>
        withMappingValue(current, source, target),
      ),
  };
};
