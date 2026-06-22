"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Product } from "@bduck/shared-types";
import {
  Check,
  Loader2,
  PackageSearch,
  Save,
  Search,
  Store,
  X,
} from "lucide-react";
import { gooeyToast } from "goey-toast";
import { externalQueueApi } from "../../../api/externalQueueApi";
import { useProducts } from "../../../hooks/useProducts";
import {
  useWarehouseLocations,
  useWarehouses,
} from "../../../hooks/useWarehouses";
import { useUserStore } from "../../../stores/useUserStore";

const normalize = (value: unknown) =>
  String(value ?? "")
    .trim()
    .toLowerCase();

const productMatches = (product: Product, query: string) => {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return true;

  return [product.name, product.code, product.barcode, product.unit]
    .filter(Boolean)
    .some((value) => normalize(value).includes(normalizedQuery));
};

export default function ExternalQueueProductConfigTab() {
  const hasPermission = useUserStore((state) => state.hasPermission);
  const canManageQueue = hasPermission("external_scan.manage_queue");
  const { warehouses, loading: warehousesLoading } = useWarehouses();
  const [warehouseId, setWarehouseId] = useState("");
  const { locations, loading: locationsLoading } = useWarehouseLocations(
    warehouseId || undefined,
  );
  const { products, loading: productsLoading } = useProducts();
  const [locationId, setLocationId] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [isConfigured, setIsConfigured] = useState(false);
  const [isConfigLoading, setIsConfigLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!warehouseId && warehouses.length > 0) {
      setWarehouseId(warehouses[0].id);
    }
  }, [warehouseId, warehouses]);

  useEffect(() => {
    if (!warehouseId) {
      setLocationId("");
      return;
    }

    if (locations.length === 0) {
      setLocationId("");
      return;
    }

    if (!locations.some((location) => location.id === locationId)) {
      setLocationId(locations[0].id);
    }
  }, [locationId, locations, warehouseId]);

  const loadConfig = useCallback(async () => {
    if (!warehouseId || !locationId || !canManageQueue) return;

    setIsConfigLoading(true);
    try {
      const response = await externalQueueApi.getScannableProductsConfig({
        warehouse_id: warehouseId,
        warehouse_location_id: locationId,
      });
      setSelectedProductIds(new Set(response.data?.product_ids ?? []));
      setIsConfigured(Boolean(response.data));
    } catch (error) {
      console.error(
        "[ExternalQueueProductConfigTab] load config failed",
        error,
      );
      setSelectedProductIds(new Set());
      setIsConfigured(false);
    } finally {
      setIsConfigLoading(false);
    }
  }, [canManageQueue, locationId, warehouseId]);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  const filteredProducts = useMemo(
    () => products.filter((product) => productMatches(product, searchTerm)),
    [products, searchTerm],
  );

  const visibleProducts = useMemo(
    () => filteredProducts.slice(0, 200),
    [filteredProducts],
  );

  const selectedCountInFilter = useMemo(
    () =>
      filteredProducts.filter((product) => selectedProductIds.has(product.id))
        .length,
    [filteredProducts, selectedProductIds],
  );

  const selectedProducts = useMemo(
    () => products.filter((product) => selectedProductIds.has(product.id)),
    [products, selectedProductIds],
  );

  const toggleProduct = (productId: string) => {
    setSelectedProductIds((current) => {
      const next = new Set(current);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  };

  const selectFilteredProducts = () => {
    setSelectedProductIds((current) => {
      const next = new Set(current);
      filteredProducts.forEach((product) => next.add(product.id));
      return next;
    });
  };

  const clearFilteredProducts = () => {
    setSelectedProductIds((current) => {
      const next = new Set(current);
      filteredProducts.forEach((product) => next.delete(product.id));
      return next;
    });
  };

  const saveConfig = async () => {
    if (!warehouseId || !locationId || isSaving) return;

    setIsSaving(true);
    const promise = externalQueueApi.updateScannableProductsConfig({
      warehouse_id: warehouseId,
      warehouse_location_id: locationId,
      product_ids: Array.from(selectedProductIds),
    });

    gooeyToast.promise(promise, {
      loading: "Dang luu danh sach san pham quet...",
      success: "Da luu cau hinh san pham quet",
      error: "Khong the luu cau hinh san pham quet",
    });

    try {
      await promise;
      setIsConfigured(true);
    } catch (error) {
      console.error(
        "[ExternalQueueProductConfigTab] save config failed",
        error,
      );
    } finally {
      setIsSaving(false);
    }
  };

  if (!canManageQueue) {
    return (
      <div className="flex h-72 flex-col items-center justify-center rounded-lg border border-[var(--color-border-subtle)] bg-white px-4 text-center">
        <Store className="mb-4 h-10 w-10 text-[var(--color-neutral-300)]" />
        <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
          Ban khong co quyen cau hinh san pham quet
        </h3>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          Can quyen external_scan.manage_queue de cai dat theo quay.
        </p>
      </div>
    );
  }

  const isBusy =
    warehousesLoading || locationsLoading || productsLoading || isConfigLoading;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
        <label className="grid gap-1 text-sm font-semibold text-[var(--color-text-secondary)]">
          Kho
          <select
            value={warehouseId}
            onChange={(event) => {
              setWarehouseId(event.target.value);
              setLocationId("");
            }}
            className="h-10 rounded-md border border-[var(--color-border-subtle)] bg-white px-3 text-sm outline-none transition focus:border-[var(--color-border-focus)] focus:ring-2 focus:ring-[var(--color-brand-primary-muted)]"
          >
            {warehouses.map((warehouse) => (
              <option key={warehouse.id} value={warehouse.id}>
                {warehouse.name || warehouse.code || warehouse.id}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1 text-sm font-semibold text-[var(--color-text-secondary)]">
          Quay / vi tri quet
          <select
            value={locationId}
            onChange={(event) => setLocationId(event.target.value)}
            className="h-10 rounded-md border border-[var(--color-border-subtle)] bg-white px-3 text-sm outline-none transition focus:border-[var(--color-border-focus)] focus:ring-2 focus:ring-[var(--color-brand-primary-muted)]"
          >
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name || location.code || location.id}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={saveConfig}
          disabled={!warehouseId || !locationId || isSaving}
          className="inline-flex h-10 items-center justify-center gap-2 self-end rounded-md bg-[var(--color-brand-primary)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--color-brand-primary-hover)] disabled:opacity-50"
        >
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Luu cau hinh
        </button>
      </div>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-h-0 overflow-hidden rounded-lg border border-[var(--color-border-subtle)] bg-white">
          <div className="flex flex-col gap-2 border-b border-[var(--color-border-subtle)] p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative min-w-0 flex-1">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
              />
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Loc theo ten, SKU, barcode, don vi..."
                className="h-9 w-full rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-neutral-50)] pl-9 pr-3 text-sm outline-none transition focus:border-[var(--color-border-focus)] focus:ring-2 focus:ring-[var(--color-brand-primary-muted)]"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={selectFilteredProducts}
                disabled={filteredProducts.length === 0}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-[var(--color-border-subtle)] px-3 text-sm font-semibold text-[var(--color-text-secondary)] transition hover:bg-[var(--color-neutral-50)] disabled:opacity-50"
              >
                <Check className="h-4 w-4" />
                Chon ket qua loc
              </button>
              <button
                type="button"
                onClick={clearFilteredProducts}
                disabled={filteredProducts.length === 0}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-[var(--color-border-subtle)] px-3 text-sm font-semibold text-[var(--color-text-secondary)] transition hover:bg-[var(--color-neutral-50)] disabled:opacity-50"
              >
                <X className="h-4 w-4" />
                Bo chon ket qua loc
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border-subtle)] px-3 py-2 text-xs font-semibold text-[var(--color-text-muted)]">
            <span>
              {filteredProducts.length.toLocaleString()} san pham phu hop, da
              chon {selectedCountInFilter.toLocaleString()} trong ket qua
            </span>
            <span>Tong da chon {selectedProductIds.size.toLocaleString()}</span>
          </div>

          <div className="max-h-[56vh] overflow-auto bg-[var(--color-neutral-50)] p-2">
            {isBusy ? (
              <div className="flex h-48 items-center justify-center text-sm text-[var(--color-text-muted)]">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Dang tai du lieu...
              </div>
            ) : visibleProducts.length === 0 ? (
              <div className="flex h-48 flex-col items-center justify-center text-center text-sm text-[var(--color-text-muted)]">
                <PackageSearch className="mb-3 h-8 w-8 text-[var(--color-neutral-300)]" />
                Khong co san pham phu hop voi bo loc.
              </div>
            ) : (
              <div className="space-y-2">
                {visibleProducts.map((product) => {
                  const isSelected = selectedProductIds.has(product.id);
                  return (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => toggleProduct(product.id)}
                      className={`flex w-full items-center gap-3 rounded-md border px-3 py-2 text-left transition ${
                        isSelected
                          ? "border-[var(--color-brand-primary)] bg-[var(--color-brand-primary-muted)]"
                          : "border-[var(--color-border-subtle)] bg-white hover:border-[var(--color-border-focus)]"
                      }`}
                    >
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                          isSelected
                            ? "border-[var(--color-brand-primary)] bg-[var(--color-brand-primary)] text-white"
                            : "border-[var(--color-border-subtle)] bg-white"
                        }`}
                      >
                        {isSelected && <Check className="h-3.5 w-3.5" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-[var(--color-text-primary)]">
                          {product.name}
                        </span>
                        <span className="mt-0.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--color-text-muted)]">
                          <span>SKU {product.code || "-"}</span>
                          <span>Barcode {product.barcode || "-"}</span>
                          <span>{product.unit || "-"}</span>
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <aside className="rounded-lg border border-[var(--color-border-subtle)] bg-white p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-[var(--color-text-primary)]">
                San pham duoc phep quet
              </p>
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                {isConfigured
                  ? "Quay nay dang ap dung allowlist da luu."
                  : "Chua cai dat: API v1 van giu hanh vi cu cho den khi ban luu."}
              </p>
            </div>
            <span className="rounded-full bg-[var(--color-neutral-100)] px-2 py-1 text-xs font-bold text-[var(--color-text-secondary)]">
              {selectedProductIds.size.toLocaleString()}
            </span>
          </div>

          <div className="mt-3 max-h-[50vh] space-y-2 overflow-auto">
            {selectedProducts.length === 0 ? (
              <div className="rounded-md border border-dashed border-[var(--color-border-subtle)] px-3 py-6 text-center text-sm text-[var(--color-text-muted)]">
                Chua chon san pham nao.
              </div>
            ) : (
              selectedProducts.map((product) => (
                <div
                  key={product.id}
                  className="flex items-center justify-between gap-2 rounded-md bg-[var(--color-neutral-50)] px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[var(--color-text-primary)]">
                      {product.name}
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      {product.code || product.barcode || product.id}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleProduct(product.id)}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[var(--color-text-muted)] transition hover:bg-white hover:text-[var(--color-status-danger-text)]"
                    title="Bo chon"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
