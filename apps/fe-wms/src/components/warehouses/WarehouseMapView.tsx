"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Map, { Marker, NavigationControl, Popup } from "react-map-gl/mapbox";
import { Plus, Search, Warehouse as WarehouseIcon } from "lucide-react";
import type { MapRef } from "react-map-gl/mapbox";
import type { Warehouse } from "@bduck/shared-types";
import Link from "next/link";
import { useTranslation } from "@/lib/i18n";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { WarehouseMapCard } from "./WarehouseMapCard";
import { WarehousePopupCard } from "./WarehousePopupCard";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

/** Default center: Ho Chi Minh City */
const DEFAULT_CENTER = { latitude: 10.7769, longitude: 106.7009 };
const DEFAULT_ZOOM = 10;

const getLightPresetByTime = () => {
    const hour = new Date().getHours();

    if (hour >= 5 && hour < 7) return "dawn";
    if (hour >= 7 && hour < 17) return "day";
    if (hour >= 17 && hour < 19) return "dusk";
    return "night"; // Từ 19h đến 5h sáng
};

interface WarehouseMapViewProps {
    warehouses: Warehouse[];
    loading: boolean;
    onAdd: () => void;
}

export function WarehouseMapView({
    warehouses,
    loading,
    onAdd,
}: WarehouseMapViewProps) {
    const { t } = useTranslation();
    const mapRef = useRef<MapRef>(null);
    const listRef = useRef<HTMLDivElement>(null);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [popupWarehouse, setPopupWarehouse] = useState<Warehouse | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [webGlError, setWebGlError] = useState(false);
    const [lightPreset, setLightPreset] = useState(getLightPresetByTime());

    useEffect(() => {
        const interval = setInterval(() => {
            const currentPreset = getLightPresetByTime();
            setLightPreset((prev) => {
                if (prev !== currentPreset) return currentPreset;
                return prev;
            });
        }, 60000); // Kiểm tra mỗi phút 1 lần

        return () => clearInterval(interval);
    }, []);

    const filteredWarehouses = useMemo(() => {
        if (!searchQuery.trim()) return warehouses;
        const q = searchQuery.toLowerCase();
        return warehouses.filter(
            (w) =>
                w.name.toLowerCase().includes(q) ||
                w.code.toLowerCase().includes(q) ||
                (w.address && w.address.toLowerCase().includes(q)),
        );
    }, [warehouses, searchQuery]);

    const warehousesWithCoords = useMemo(
        () => filteredWarehouses.filter((w) => w.coordinate !== null),
        [filteredWarehouses],
    );

    // Fit bounds when warehouses change
    useEffect(() => {
        if (!mapRef.current || warehousesWithCoords.length === 0) return;

        const timeout = setTimeout(() => {
            if (!mapRef.current || warehousesWithCoords.length === 0) return;

            if (warehousesWithCoords.length === 1) {
                const w = warehousesWithCoords[0];
                mapRef.current.flyTo({
                    center: [w.coordinate!.longitude, w.coordinate!.latitude],
                    zoom: 14,
                    duration: 1200,
                });
                return;
            }

            const lngs = warehousesWithCoords.map((w) => w.coordinate!.longitude);
            const lats = warehousesWithCoords.map((w) => w.coordinate!.latitude);

            mapRef.current.fitBounds(
                [
                    [Math.min(...lngs) - 0.05, Math.min(...lats) - 0.05],
                    [Math.max(...lngs) + 0.05, Math.max(...lats) + 0.05],
                ],
                { padding: 60, duration: 1200 },
            );
        }, 300);

        return () => clearTimeout(timeout);
    }, [warehousesWithCoords]);

    const handleSelectWarehouse = useCallback(
        (warehouse: Warehouse) => {
            setSelectedId(warehouse.id);
            setPopupWarehouse(warehouse);

            if (warehouse.coordinate && mapRef.current) {
                mapRef.current.flyTo({
                    center: [
                        warehouse.coordinate.longitude,
                        warehouse.coordinate.latitude,
                    ],
                    zoom: 17,
                    pitch: 45,
                    duration: 1200,
                });
            }
        },
        [],
    );

    const handleMarkerClick = useCallback(
        (warehouse: Warehouse) => {
            setSelectedId(warehouse.id);
            setPopupWarehouse(warehouse);

            // Scroll sidebar to the warehouse card
            if (listRef.current) {
                const card = listRef.current.querySelector(
                    `[data-warehouse-id="${warehouse.id}"]`,
                );
                card?.scrollIntoView({ behavior: "smooth", block: "center" });
            }

            if (warehouse.coordinate && mapRef.current) {
                mapRef.current.flyTo({
                    center: [
                        warehouse.coordinate.longitude,
                        warehouse.coordinate.latitude,
                    ],
                    zoom: 17,
                    pitch: 45,
                    duration: 1200,
                });
            }
        },
        [],
    );

    const sidebarContent = (
        <>
            <div className="relative mb-3">
                <Search
                    size={16}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
                />
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t.warehouses.searchWarehouse}
                    className="h-8 w-full rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] pl-10 pr-4 text-sm outline-none focus:border-[var(--color-border-focus)]"
                />
            </div>

            <p className="mb-2 text-xs text-[var(--color-text-muted)]">
                {filteredWarehouses.length} {t.warehouses.tabWarehouses.toLowerCase()}
            </p>

            {loading ? (
                <SidebarSkeleton />
            ) : filteredWarehouses.length === 0 ? (
                <div className="flex flex-col items-center py-10 text-center">
                    <WarehouseIcon
                        size={36}
                        className="mb-2 text-[var(--color-text-muted)]"
                    />
                    <p className="text-sm text-[var(--color-text-muted)]">
                        {t.warehouses.empty}
                    </p>
                </div>
            ) : (
                <div ref={listRef} className="space-y-2">
                    {filteredWarehouses.map((warehouse) => (
                        <div key={warehouse.id} data-warehouse-id={warehouse.id}>
                            <WarehouseMapCard
                                warehouse={warehouse}
                                isSelected={selectedId === warehouse.id}
                                onSelect={handleSelectWarehouse}
                            />
                        </div>
                    ))}
                </div>
            )}

            <button
                type="button"
                onClick={onAdd}
                className="inline-flex h-8 w-full mt-2 items-center justify-center gap-2 rounded-full bg-[var(--color-brand-primary)] px-5 text-sm font-normal text-white transition-all hover:bg-[var(--color-brand-primary-hover)] active:scale-95"
            >
                <Plus size={18} />
                {t.warehouses.addNew}
            </button>
        </>
    );

    return (
        <section className="absolute inset-0 flex flex-1 overflow-hidden">
            {/* Map */}
            <div className="relative flex-1 w-full">
                {webGlError ? (
                    <div className="flex h-full flex-col items-center justify-center bg-[var(--color-surface-card)] p-4 text-center">
                        <WarehouseIcon size={48} className="mx-auto mb-3 text-[var(--color-text-muted)] opacity-50" />
                        <h3 className="mb-2 text-lg font-semibold text-[var(--color-text-primary)]">
                            {t.warehouses.mapLoadError}
                        </h3>
                        <p className="text-sm text-[var(--color-text-muted)]">
                            {t.warehouses.webglErrorDesc}
                        </p>
                    </div>
                ) : MAPBOX_TOKEN ? (
                    <Map
                        ref={mapRef}
                        initialViewState={{
                            ...DEFAULT_CENTER,
                            zoom: DEFAULT_ZOOM,
                            pitch: 45,
                        }}
                        style={{ width: "100%", height: "100%" }}
                        mapStyle='mapbox://styles/mapbox/standard'
                        config={{
                            basemap: {
                                lightPreset,
                                colorMotorways: "#2e89ff",
                                showPedestrianRoads: false,
                                show3dObjects: true
                            }
                        }}
                        mapboxAccessToken={MAPBOX_TOKEN}
                        attributionControl={false}
                        onError={(e) => {
                            console.error("Mapbox error:", e.error);
                            if (e.error?.message?.toLowerCase().includes("webgl")) {
                                setWebGlError(true);
                            }
                        }}
                    >
                        {/* <NavigationControl position="bottom-right" /> */}

                        {warehousesWithCoords.map((warehouse) => (
                            <Marker
                                key={warehouse.id}
                                longitude={warehouse.coordinate!.longitude}
                                latitude={warehouse.coordinate!.latitude}
                                anchor="bottom"
                                onClick={(e) => {
                                    e.originalEvent.stopPropagation();
                                    handleMarkerClick(warehouse);
                                }}
                            >
                                <div
                                    className={`flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border-2 transition-all ${selectedId === warehouse.id
                                        ? "scale-125 border-white bg-[var(--color-brand-primary)] shadow-lg"
                                        : "border-white bg-[var(--color-brand-primary)] shadow-md hover:scale-110"
                                        }`}
                                >
                                    <WarehouseIcon size={14} className="text-white" />
                                </div>
                            </Marker>
                        ))}

                        {popupWarehouse?.coordinate && (
                            <Popup
                                longitude={popupWarehouse.coordinate.longitude}
                                latitude={popupWarehouse.coordinate.latitude}
                                anchor="bottom"
                                offset={20}
                                closeOnClick={false}
                                onClose={() => setPopupWarehouse(null)}
                                className="[&_.mapboxgl-popup-content]:overflow-hidden [&_.mapboxgl-popup-content]:w-fit [&_.mapboxgl-popup-content]:rounded-[30px] [&_.mapboxgl-popup-content]:border [&_.mapboxgl-popup-content]:border-[var(--color-border-subtle)] [&_.mapboxgl-popup-content]:p-0 [&_.mapboxgl-popup-content]:shadow-2xl [&_.mapboxgl-popup-close-button]:hidden"
                            >
                                <WarehousePopupCard
                                    warehouse={popupWarehouse}
                                    onClose={() => setPopupWarehouse(null)}
                                />
                            </Popup>
                        )}
                    </Map>
                ) : (
                    <div className="flex h-full items-center justify-center bg-[var(--color-surface-card)] p-4 text-center">
                        <div>
                            <WarehouseIcon
                                size={48}
                                className="mx-auto mb-3 text-[var(--color-text-muted)]"
                            />
                            <p className="text-sm text-[var(--color-text-muted)]">
                                Missing NEXT_PUBLIC_MAPBOX_TOKEN
                            </p>
                        </div>
                    </div>
                )}
            </div>

            <aside className="hidden absolute left-4 bottom-4 max-h-[calc(100vh-140px)] rounded-2xl z-10 w-80 flex-col border border-[var(--color-border-soft)] bg-white/95 backdrop-blur-md shadow-lg md:flex">
                <div className="flex-1 overflow-y-auto p-3 scrollbar-none">{sidebarContent}</div>
            </aside>

            {/* Mobile bottom sheet */}
            <BottomSheet
                title={`${filteredWarehouses.length} ${t.warehouses.tabWarehouses.toLowerCase()}`}
                defaultSnap="collapsed"
            >
                {sidebarContent}
            </BottomSheet>
        </section>
    );
}

function SidebarSkeleton() {
    return (
        <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
                <div
                    key={i}
                    className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] p-3.5"
                >
                    <div className="mb-2 h-4 w-3/4 rounded skeleton-pulse" />
                    <div className="mb-3 h-3 w-1/2 rounded skeleton-pulse" />
                    <div className="h-3 w-full rounded skeleton-pulse" />
                </div>
            ))}
        </div>
    );
}
