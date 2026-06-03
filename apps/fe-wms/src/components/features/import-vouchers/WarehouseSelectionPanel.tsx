"use client";

import { useState } from "react";
import Map, { Marker } from "react-map-gl/mapbox";
import {
  Building2,
  CheckCircle2,
  MapPin,
  Navigation,
  PackageOpen,
  Warehouse as WarehouseIcon,
} from "lucide-react";
import type { Warehouse, WarehouseLocation } from "@bduck/shared-types";
import { ActiveStatus } from "@bduck/shared-types";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

type Locale = "vi" | "zh";

const COPY = {
  vi: {
    warehouse: "Kho nhận hàng",
    chooseWarehouse: "Chọn kho nhận",
    mapTitle: "Vị trí kho",
    noWarehouse:
      "Chọn một kho để xem vị trí và khu vực lưu trữ.",
    noCoordinate: "Kho này chưa có toạ độ bản đồ.",
    noMapToken:
      "Chưa cấu hình Mapbox token, đang hiển thị bản đồ tĩnh.",
    active: "Đang hoạt động",
    inactive: "Ngưng hoạt động",
    locations: "vị trí",
    address: "Địa chỉ",
    coordinates: "Toạ độ",
    webGlErrorTitle: "Không thể tải bản đồ",
    webGlErrorMessage:
      "Trình duyệt không hỗ trợ WebGL hoặc tăng tốc phần cứng đang bị tắt.",
  },
  zh: {
    warehouse: "收货仓库",
    chooseWarehouse: "选择收货仓库",
    mapTitle: "仓库位置",
    noWarehouse: "请选择仓库以查看位置和库位。",
    noCoordinate: "此仓库尚未配置地图坐标。",
    noMapToken: "尚未配置 Mapbox token，正在显示静态地图。",
    active: "启用",
    inactive: "停用",
    locations: "个库位",
    address: "地址",
    coordinates: "坐标",
    webGlErrorTitle: "无法加载地图",
    webGlErrorMessage:
      "您的浏览器不支持 WebGL，或已禁用硬件加速。",
  },
} as const;

interface WarehouseSelectionPanelProps {
  warehouses: Warehouse[];
  locations: WarehouseLocation[];
  selectedWarehouseId: string;
  loading: boolean;
  locale: Locale;
  onSelect: (warehouseId: string) => void;
}

function formatCoordinate(value: number) {
  return value.toFixed(5);
}

function WarehouseMapPreview({
  warehouse,
  locale,
}: {
  warehouse: Warehouse | null;
  locale: Locale;
}) {
  const [webGlError, setWebGlError] = useState(false);
  const copy = COPY[locale];
  const coordinate = warehouse?.coordinate;

  return (
    <section className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)]">
      <div className="flex items-center justify-between border-b border-[var(--color-border-subtle)] px-4 py-3">
        <div className="flex items-center gap-2">
          <MapPin size={16} className="text-[var(--color-brand-primary)]" />
          <p className="text-sm font-semibold text-[var(--color-text-primary)]">
            {copy.mapTitle}
          </p>
        </div>
        {coordinate && (
          <span className="rounded-full bg-[var(--color-brand-primary-muted)] px-2 py-1 text-xxs font-semibold text-[var(--color-brand-primary)]">
            {formatCoordinate(coordinate.latitude)},{" "}
            {formatCoordinate(coordinate.longitude)}
          </span>
        )}
      </div>

      <div className="relative h-56 bg-[var(--color-surface-card)] sm:h-64 lg:h-[340px]">
        {webGlError ? (
          <div className="flex h-full flex-col items-center justify-center bg-[var(--color-surface-card)] p-4 text-center">
            <MapPin
              size={40}
              className="mx-auto mb-3 text-[var(--color-text-muted)] opacity-50"
            />
            <h3 className="mb-1 text-base font-semibold text-[var(--color-text-primary)]">
              {copy.webGlErrorTitle}
            </h3>
            <p className="text-xs text-[var(--color-text-muted)]">
              {copy.webGlErrorMessage}
            </p>
          </div>
        ) : warehouse && coordinate && MAPBOX_TOKEN ? (
          <Map
            longitude={coordinate.longitude}
            latitude={coordinate.latitude}
            zoom={14}
            style={{ width: "100%", height: "100%" }}
            mapStyle="mapbox://styles/mapbox/light-v11"
            mapboxAccessToken={MAPBOX_TOKEN}
            attributionControl={false}
            interactive={false}
            onError={(e) => {
              if (e.error?.message?.toLowerCase().includes("webgl")) {
                setWebGlError(true);
              }
            }}
          >
            <Marker
              longitude={coordinate.longitude}
              latitude={coordinate.latitude}
              anchor="bottom"
            >
              <div className="flex h-8 w-10 items-center justify-center rounded-full border-4 border-white bg-[var(--color-brand-primary)] text-white shadow-lg">
                <WarehouseIcon size={18} />
              </div>
            </Marker>
          </Map>
        ) : (
          <div className="relative flex h-full items-center justify-center overflow-hidden bg-[linear-gradient(135deg,#eff6ff_0%,#f8fafc_45%,#ecfdf5_100%)]">
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(148,163,184,0.16)_1px,transparent_1px),linear-gradient(0deg,rgba(148,163,184,0.16)_1px,transparent_1px)] bg-[size:28px_28px]" />
            <div className="relative flex flex-col items-center text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-white bg-[var(--color-brand-primary)] text-white shadow-lg">
                {warehouse ? <WarehouseIcon size={26} /> : <Navigation size={26} />}
              </div>
              <p className="mt-3 text-sm font-semibold text-[var(--color-text-primary)]">
                {!warehouse
                  ? copy.noWarehouse
                  : coordinate
                    ? copy.noMapToken
                    : copy.noCoordinate}
              </p>
            </div>
          </div>
        )}
      </div>

      {warehouse && (
        <div className="grid gap-3 border-t border-[var(--color-border-subtle)] p-4 sm:grid-cols-2">
          <div className="flex items-start gap-2">
            <Building2
              size={15}
              className="mt-0.5 text-[var(--color-text-muted)]"
            />
            <div className="min-w-0">
              <p className="text-xxs font-semibold uppercase text-[var(--color-text-muted)]">
                {copy.address}
              </p>
              <p className="mt-0.5 line-clamp-2 text-xs text-[var(--color-text-secondary)]">
                {warehouse.address || "-"}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Navigation
              size={15}
              className="mt-0.5 text-[var(--color-text-muted)]"
            />
            <div className="min-w-0">
              <p className="text-xxs font-semibold uppercase text-[var(--color-text-muted)]">
                {copy.coordinates}
              </p>
              <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
                {coordinate
                  ? `${formatCoordinate(coordinate.latitude)}, ${formatCoordinate(
                      coordinate.longitude,
                    )}`
                  : "-"}
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export function WarehouseSelectionPanel({
  warehouses,
  locations,
  selectedWarehouseId,
  loading,
  locale,
  onSelect,
}: WarehouseSelectionPanelProps) {
  const copy = COPY[locale];
  const selectedWarehouse =
    warehouses.find((warehouse) => warehouse.id === selectedWarehouseId) ?? null;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(280px,360px)_minmax(0,1fr)]">
      <section className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] p-3">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">
              {copy.chooseWarehouse}
            </p>
            <p className="text-xs text-[var(--color-text-muted)]">
              {warehouses.length} {copy.warehouse.toLowerCase()}
            </p>
          </div>
          <WarehouseIcon
            size={18}
            className="text-[var(--color-brand-primary)]"
          />
        </div>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="h-20 animate-pulse rounded-[var(--radius-sm)] bg-[var(--color-surface-card)]"
              />
            ))}
          </div>
        ) : warehouses.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-[var(--radius-sm)] border border-dashed border-[var(--color-border-subtle)] py-10 text-center">
            <PackageOpen size={26} className="text-[var(--color-text-muted)]" />
            <p className="mt-2 text-sm text-[var(--color-text-muted)]">
              {copy.noWarehouse}
            </p>
          </div>
        ) : (
          <div className="max-h-[340px] space-y-2 overflow-y-auto pr-1">
            {warehouses.map((warehouse) => {
              const isSelected = warehouse.id === selectedWarehouseId;
              const isActive = warehouse.status === ActiveStatus.ACTIVE;
              const warehouseLocations = locations.filter(
                (location) => location.warehouse_id === warehouse.id,
              );

              return (
                <button
                  key={warehouse.id}
                  type="button"
                  onClick={() => onSelect(warehouse.id)}
                  className={`w-full rounded-[var(--radius-sm)] border p-3 text-left transition-all active:scale-[0.99] ${
                    isSelected
                      ? "border-[var(--color-brand-primary)] bg-[var(--color-brand-primary-muted)]"
                      : "border-[var(--color-border-subtle)] bg-white hover:border-[var(--color-border-focus)]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[var(--color-text-primary)]">
                        {warehouse.name}
                      </p>
                      <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                        {warehouse.code} / {warehouseLocations.length}{" "}
                        {copy.locations}
                      </p>
                    </div>
                    {isSelected ? (
                      <CheckCircle2
                        size={18}
                        className="shrink-0 text-[var(--color-brand-primary)]"
                      />
                    ) : (
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-xxs font-semibold ${
                          isActive
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {isActive ? copy.active : copy.inactive}
                      </span>
                    )}
                  </div>
                  {warehouse.address && (
                    <p className="mt-2 line-clamp-2 text-xs leading-5 text-[var(--color-text-muted)]">
                      {warehouse.address}
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </section>

      <WarehouseMapPreview warehouse={selectedWarehouse} locale={locale} />
    </div>
  );
}
