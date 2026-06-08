"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Boxes,
  Edit3,
  Layers,
  MapPin,
  PackageOpen,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { LocationStatus } from "@bduck/shared-types";
import type {
  Inventory,
  Product,
  WarehouseLocation,
} from "@bduck/shared-types";
import { useTranslation } from "@/lib/i18n";
import { WarehouseTableSkeleton } from "./WarehouseSkeleton";

interface LocationCardGridProps {
  locations: WarehouseLocation[];
  inventory: Inventory[];
  products: Product[];
  loading: boolean;
  onAdd: () => void;
  onEdit: (location: WarehouseLocation) => void;
  onDelete: (location: WarehouseLocation) => void;
}

interface LocationProductRow {
  product: Product;
  atp: number;
  onHold: number;
  inTransit: number;
  quarantine: number;
  total: number;
}

interface LocationSummary {
  location: WarehouseLocation;
  products: LocationProductRow[];
  productCount: number;
  atp: number;
  quarantine: number;
  total: number;
}

export function LocationCardGrid({
  locations,
  inventory,
  products,
  loading,
  onAdd,
  onEdit,
  onDelete,
}: LocationCardGridProps) {
  const { t } = useTranslation();
  const [locationSearch, setLocationSearch] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(
    null,
  );

  const summaries = useMemo<LocationSummary[]>(() => {
    const productById = new Map(
      products.map((product) => [product.id, product]),
    );

    return locations.map((location) => {
      const productRows = new Map<string, LocationProductRow>();

      for (const inv of inventory) {
        if (
          inv.warehouse_location_id !== location.id ||
          inv.is_deleted === true
        ) {
          continue;
        }

        const product = productById.get(inv.product_id);
        if (!product) {
          continue;
        }

        const existing = productRows.get(inv.product_id) ?? {
          product,
          atp: 0,
          onHold: 0,
          inTransit: 0,
          quarantine: 0,
          total: 0,
        };

        existing.atp += inv.atp_quantity;
        existing.onHold += inv.on_hold_quantity;
        existing.inTransit += inv.in_transit_quantity;
        existing.quarantine += inv.quarantine_quantity;
        existing.total += inv.total_quantity;
        productRows.set(inv.product_id, existing);
      }

      const rows = Array.from(productRows.values()).sort(
        (a, b) => b.total - a.total,
      );

      return {
        location,
        products: rows,
        productCount: rows.length,
        atp: rows.reduce((sum, item) => sum + item.atp, 0),
        quarantine: rows.reduce((sum, item) => sum + item.quarantine, 0),
        total: rows.reduce((sum, item) => sum + item.total, 0),
      };
    });
  }, [inventory, locations, products]);

  const visibleSummaries = useMemo(() => {
    const query = locationSearch.trim().toLowerCase();
    if (!query) {
      return summaries;
    }

    return summaries.filter(({ location }) => {
      return (
        location.name.toLowerCase().includes(query) ||
        location.code.toLowerCase().includes(query)
      );
    });
  }, [locationSearch, summaries]);

  useEffect(() => {
    if (visibleSummaries.length === 0) {
      setSelectedLocationId(null);
      return;
    }

    if (
      !selectedLocationId ||
      !visibleSummaries.some((item) => item.location.id === selectedLocationId)
    ) {
      setSelectedLocationId(visibleSummaries[0].location.id);
    }
  }, [selectedLocationId, visibleSummaries]);

  const selectedSummary =
    visibleSummaries.find((item) => item.location.id === selectedLocationId) ??
    visibleSummaries[0] ??
    null;

  const visibleProducts = useMemo(() => {
    if (!selectedSummary) {
      return [];
    }

    const query = productSearch.trim().toLowerCase();
    if (!query) {
      return selectedSummary.products;
    }

    return selectedSummary.products.filter(({ product }) => {
      return (
        product.name.toLowerCase().includes(query) ||
        product.code.toLowerCase().includes(query) ||
        (product.barcode?.toLowerCase().includes(query) ?? false)
      );
    });
  }, [productSearch, selectedSummary]);

  if (loading) {
    return <WarehouseTableSkeleton />;
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold leading-[1.19] tracking-normal text-[var(--color-text-primary)]">
            {t.warehouses.tabLocations}
          </h2>
          <p className="text-sm text-[var(--color-text-muted)]">
            {t.warehouses.locationTabDescription}
          </p>
        </div>
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex min-h-8 items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-brand-primary)] px-5 text-sm font-medium text-white shadow-sm transition-all hover:bg-[var(--color-brand-primary-hover)] active:scale-95"
        >
          <Plus size={18} />
          {t.warehouses.addLocation}
        </button>
      </div>

      {locations.length === 0 ? (
        <div className="flex min-h-64 flex-col items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] px-4 py-12 text-center">
          <MapPin size={42} className="mb-3 text-[var(--color-text-muted)]" />
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
            {t.warehouses.emptyLocations}
          </h3>
        </div>
      ) : (
        <div className="grid min-h-[540px] grid-cols-1 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] lg:grid-cols-[340px_minmax(0,1fr)]">
          <aside className="border-b border-[var(--color-border-subtle)] bg-[var(--color-surface-pearl)] lg:border-b-0 lg:border-r">
            <div className="border-b border-[var(--color-border-subtle)] p-3">
              <div className="relative">
                <Search
                  size={15}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
                />
                <input
                  type="text"
                  value={locationSearch}
                  onChange={(event) => setLocationSearch(event.target.value)}
                  placeholder={t.warehouses.searchLocationPlaceholder}
                  className="h-9 w-full rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] pl-9 pr-3 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-primary)]"
                />
              </div>
              <div className="mt-2 flex items-center justify-between text-xxs text-[var(--color-text-muted)]">
                <span>{visibleSummaries.length} {t.warehouses.locationCount}</span>
                <span>
                  {summaries
                    .reduce((sum, item) => sum + item.total, 0)
                    .toLocaleString()}{" "}
                  {t.warehouses.productCount}
                </span>
              </div>
            </div>

            <div className="max-h-[360px] overflow-y-auto p-2 lg:max-h-[620px]">
              {visibleSummaries.length === 0 ? (
                <div className="flex h-32 items-center justify-center rounded-[var(--radius-md)] border border-dashed border-[var(--color-border-subtle)] text-sm text-[var(--color-text-muted)]">
                  {t.warehouses.noLocationsFound}
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {visibleSummaries.map((summary) => {
                    const isSelected =
                      summary.location.id === selectedSummary?.location.id;

                    return (
                      <button
                        key={summary.location.id}
                        type="button"
                        onClick={() => {
                          setSelectedLocationId(summary.location.id);
                          setProductSearch("");
                        }}
                        className={`w-full rounded-[var(--radius-md)] border p-3 text-left transition-colors ${
                          isSelected
                            ? "border-[var(--color-brand-primary)] bg-[var(--color-surface-elevated)] shadow-sm"
                            : "border-transparent hover:border-[var(--color-border-subtle)] hover:bg-[var(--color-surface-elevated)]"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="truncate text-sm font-semibold text-[var(--color-text-primary)]">
                                {summary.location.name}
                              </h3>
                              <StatusBadge status={summary.location.status} />
                            </div>
                            <p className="mt-1 truncate text-xs text-[var(--color-text-muted)]">
                              {summary.location.code} ·{" "}
                              {t.warehouses.types[summary.location.type]}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-sm font-bold text-[var(--color-text-primary)]">
                              {summary.total.toLocaleString()}
                            </p>
                            <p className="text-xxs text-[var(--color-text-muted)]">
                              {t.warehouses.inventoryView.total.toLowerCase()}
                            </p>
                          </div>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-2 text-xxs">
                          <span className="rounded bg-[var(--color-surface-card)] px-2 py-1 text-[var(--color-text-secondary)]">
                            {summary.productCount} SKU
                          </span>
                          <span className="rounded bg-[var(--color-surface-card)] px-2 py-1 text-[var(--color-text-secondary)]">
                            ATP {summary.atp.toLocaleString()}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </aside>

          <div className="min-w-0">
            {selectedSummary ? (
              <div className="flex h-full flex-col">
                <div className="border-b border-[var(--color-border-subtle)] p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
                          {selectedSummary.location.name}
                        </h3>
                        <StatusBadge status={selectedSummary.location.status} />
                      </div>
                      <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                        {selectedSummary.location.code} ·{" "}
                        {t.warehouses.types[selectedSummary.location.type]}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onEdit(selectedSummary.location)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-card)] hover:text-[var(--color-brand-primary)]"
                        aria-label={t.common.edit}
                      >
                        <Edit3 size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(selectedSummary.location)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-card)] hover:text-[var(--color-accent-error)]"
                        aria-label={t.common.delete}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                    <MetricTile
                      icon={<Boxes size={16} />}
                      label="SKU"
                      value={selectedSummary.productCount}
                    />
                    <MetricTile
                      icon={<Layers size={16} />}
                      label={t.warehouses.inventoryView.total}
                      value={selectedSummary.total}
                    />
                    <MetricTile
                      icon={<PackageOpen size={16} />}
                      label="ATP"
                      value={selectedSummary.atp}
                    />
                    <MetricTile
                      icon={<MapPin size={16} />}
                      label={t.warehouses.inventoryView.quarantine}
                      value={selectedSummary.quarantine}
                      tone={
                        selectedSummary.quarantine > 0 ? "danger" : "default"
                      }
                    />
                  </div>

                  <div className="relative mt-4">
                    <Search
                      size={15}
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
                    />
                    <input
                      type="text"
                      value={productSearch}
                      onChange={(event) => setProductSearch(event.target.value)}
                      placeholder={t.warehouses.searchProductInLocationPlaceholder}
                      className="h-9 w-full rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] pl-9 pr-3 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-primary)]"
                    />
                  </div>
                </div>

                <div className="min-h-0 flex-1 overflow-auto">
                  {visibleProducts.length === 0 ? (
                    <div className="flex min-h-64 flex-col items-center justify-center px-4 text-center text-[var(--color-text-muted)]">
                      <PackageOpen size={28} className="mb-2 opacity-60" />
                      <p className="text-sm">
                        {selectedSummary.products.length === 0
                          ? t.warehouses.locationNoProducts
                          : t.warehouses.inventoryView.noResults}
                      </p>
                    </div>
                  ) : (
                    <table className="w-full min-w-[720px] text-left">
                      <thead className="sticky top-0 z-10 border-b border-[var(--color-border-subtle)] bg-[var(--color-surface-pearl)]">
                        <tr>
                          <th className="px-4 py-3 text-xxs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                            {t.nav.products}
                          </th>
                          <th className="px-4 py-3 text-right text-xxs font-semibold uppercase tracking-wider text-[var(--color-brand-primary)]">
                            ATP
                          </th>
                          <th className="px-4 py-3 text-right text-xxs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                            {t.warehouses.inventoryView.onHold}
                          </th>
                          <th className="px-4 py-3 text-right text-xxs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                            {t.warehouses.inventoryView.inTransit}
                          </th>
                          <th className="px-4 py-3 text-right text-xxs font-semibold uppercase tracking-wider text-red-500">
                            {t.warehouses.inventoryView.quarantine}
                          </th>
                          <th className="px-4 py-3 text-right text-xxs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                            {t.warehouses.inventoryView.total}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--color-border-subtle)]">
                        {visibleProducts.map((item) => (
                          <tr
                            key={item.product.id}
                            className="transition-colors hover:bg-[var(--color-surface-pearl)]"
                          >
                            <td className="px-4 py-3">
                              <div className="min-w-0">
                                <p className="line-clamp-1 text-sm font-semibold text-[var(--color-text-primary)]">
                                  {item.product.name}
                                </p>
                                <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                                  {item.product.code} · {item.product.unit}
                                </p>
                              </div>
                            </td>
                            <NumberCell value={item.atp} strong />
                            <NumberCell value={item.onHold} />
                            <NumberCell value={item.inTransit} />
                            <NumberCell value={item.quarantine} tone="danger" />
                            <NumberCell value={item.total} strong />
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex h-full min-h-64 items-center justify-center text-sm text-[var(--color-text-muted)]">
                {t.warehouses.noMatchingLocation}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function MetricTile({
  icon,
  label,
  value,
  tone = "default",
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone?: "default" | "danger";
}) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-3">
      <div
        className={`mb-2 flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] ${
          tone === "danger"
            ? "bg-red-100 text-red-600"
            : "bg-[var(--color-surface-elevated)] text-[var(--color-brand-primary)]"
        }`}
      >
        {icon}
      </div>
      <p className="text-xxs font-medium uppercase tracking-wider text-[var(--color-text-muted)]">
        {label}
      </p>
      <p className="mt-1 text-lg font-bold text-[var(--color-text-primary)]">
        {value.toLocaleString()}
      </p>
    </div>
  );
}

function NumberCell({
  value,
  strong = false,
  tone = "default",
}: {
  value: number;
  strong?: boolean;
  tone?: "default" | "danger";
}) {
  const muted = value <= 0;
  const color =
    tone === "danger" && value > 0
      ? "text-red-600"
      : muted
        ? "text-[var(--color-text-muted)]"
        : "text-[var(--color-text-primary)]";

  return (
    <td
      className={`px-4 py-3 text-right text-sm ${strong ? "font-bold" : "font-medium"} ${color}`}
    >
      {value > 0 ? value.toLocaleString() : "-"}
    </td>
  );
}

function StatusBadge({ status }: { status: LocationStatus }) {
  const { t } = useTranslation();
  const classes =
    status === LocationStatus.ACTIVE
      ? "bg-[var(--color-surface-success)] text-[var(--color-text-success)]"
      : status === LocationStatus.QUARANTINE
        ? "bg-[var(--color-surface-warning)] text-[var(--color-accent-warning)]"
        : "bg-[var(--color-surface-card)] text-[var(--color-text-muted)]";

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xxs font-bold uppercase tracking-wider ${classes}`}
    >
      {t.warehouses.statuses[status]}
    </span>
  );
}
