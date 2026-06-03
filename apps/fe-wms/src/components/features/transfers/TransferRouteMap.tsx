"use client";

/**
 * TransferRouteMap — Real road route preview from source → destination warehouse
 *
 * Uses Mapbox Directions API for actual driving route (not a straight line).
 * Always visible — shows an empty map waiting for warehouse selection,
 * then animates the real route once both warehouses are chosen.
 */

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import Map, { Marker, Source, Layer } from "react-map-gl/mapbox";
import type { MapRef } from "react-map-gl/mapbox";
import {
    ArrowRight,
    MapPin,
    Navigation,
    Warehouse as WarehouseIcon,
} from "lucide-react";
import type { Warehouse } from "@bduck/shared-types";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

/** Default center: Ho Chi Minh City */
const DEFAULT_CENTER = { longitude: 106.7009, latitude: 10.7769 };

type Locale = "vi" | "zh";

const COPY = {
    vi: {
        routePreview: "Lộ trình chuyển kho",
        from: "Từ",
        to: "Đến",
        distance: "Khoảng cách",
        duration: "Thời gian",
        waiting: "Chọn kho nguồn và kho đích để xem lộ trình",
        waitingSource: "Chọn kho nguồn",
        waitingDest: "Chọn kho đích",
        noCoordinates: "Kho chưa có toạ độ bản đồ",
        loadingRoute: "Đang tải lộ trình...",
        routeError: "Không thể tải lộ trình đường đi",
        webGlError: "Trình duyệt không hỗ trợ WebGL.",
    },
    zh: {
        routePreview: "调拨路线",
        from: "从",
        to: "到",
        distance: "距离",
        duration: "时间",
        waiting: "选择源仓库和目标仓库以查看路线",
        waitingSource: "选择源仓库",
        waitingDest: "选择目标仓库",
        noCoordinates: "仓库尚未配置地图坐标",
        loadingRoute: "正在加载路线...",
        routeError: "无法加载行驶路线",
        webGlError: "浏览器不支持 WebGL。",
    },
} as const;

/** Format duration in minutes/hours */
function formatDuration(seconds: number): string {
    if (seconds < 3600) return `${Math.round(seconds / 60)} phút`;
    const h = Math.floor(seconds / 3600);
    const m = Math.round((seconds % 3600) / 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

/** Format distance */
function formatDistance(meters: number): string {
    if (meters < 1000) return `${Math.round(meters)}m`;
    return `${(meters / 1000).toFixed(1)} km`;
}

interface RouteData {
    coordinates: [number, number][];
    distance: number; // meters
    duration: number; // seconds
}

interface TransferRouteMapProps {
    sourceWarehouse: Warehouse | null;
    destinationWarehouse: Warehouse | null;
    locale: Locale;
}

export default function TransferRouteMap({
    sourceWarehouse,
    destinationWarehouse,
    locale,
}: TransferRouteMapProps) {
    const mapRef = useRef<MapRef>(null);
    const [webGlError, setWebGlError] = useState(false);
    const [route, setRoute] = useState<RouteData | null>(null);
    const [routeLoading, setRouteLoading] = useState(false);
    const [routeError, setRouteError] = useState(false);
    const [animProgress, setAnimProgress] = useState(0);
    const animRef = useRef<number>(0);
    const copy = COPY[locale];

    const srcCoord = sourceWarehouse?.coordinate;
    const dstCoord = destinationWarehouse?.coordinate;
    const hasBothCoords = !!(srcCoord && dstCoord);

    // ─── Fetch real driving route from Mapbox Directions API ───
    useEffect(() => {
        if (!srcCoord || !dstCoord || !MAPBOX_TOKEN) {
            setRoute(null);
            setRouteError(false);
            return;
        }

        let cancelled = false;
        setRouteLoading(true);
        setRouteError(false);
        setAnimProgress(0);

        const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${srcCoord.longitude},${srcCoord.latitude};${dstCoord.longitude},${dstCoord.latitude}?geometries=geojson&overview=full&access_token=${MAPBOX_TOKEN}`;

        fetch(url)
            .then((res) => res.json())
            .then((data) => {
                if (cancelled) return;
                if (data.routes && data.routes.length > 0) {
                    const r = data.routes[0];
                    setRoute({
                        coordinates: r.geometry.coordinates,
                        distance: r.distance,
                        duration: r.duration,
                    });
                } else {
                    setRouteError(true);
                }
            })
            .catch(() => {
                if (!cancelled) setRouteError(true);
            })
            .finally(() => {
                if (!cancelled) setRouteLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [srcCoord?.longitude, srcCoord?.latitude, dstCoord?.longitude, dstCoord?.latitude]);

    // ─── Animate route drawing ───
    useEffect(() => {
        if (!route) return;
        setAnimProgress(0);
        const startTime = performance.now();
        const duration = 2500;

        const animate = (now: number) => {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
            setAnimProgress(eased);
            if (progress < 1) {
                animRef.current = requestAnimationFrame(animate);
            }
        };

        const timeout = setTimeout(() => {
            animRef.current = requestAnimationFrame(animate);
        }, 300);

        return () => {
            clearTimeout(timeout);
            cancelAnimationFrame(animRef.current);
        };
    }, [route]);

    // ─── GeoJSON for full route (dashed background) ───
    const fullRouteGeoJson = useMemo(() => {
        if (!route) return null;
        return {
            type: "Feature" as const,
            properties: {},
            geometry: { type: "LineString" as const, coordinates: route.coordinates },
        };
    }, [route]);

    // ─── GeoJSON for animated partial route ───
    const animatedRouteGeoJson = useMemo(() => {
        if (!route) return null;
        const endIdx = Math.max(Math.floor(animProgress * route.coordinates.length), 2);
        return {
            type: "Feature" as const,
            properties: {},
            geometry: {
                type: "LineString" as const,
                coordinates: route.coordinates.slice(0, endIdx),
            },
        };
    }, [route, animProgress]);

    // ─── Fit bounds when route loads ───
    const fitBounds = useCallback(() => {
        if (!srcCoord || !dstCoord || !mapRef.current) return;
        mapRef.current.fitBounds(
            [
                [Math.min(srcCoord.longitude, dstCoord.longitude), Math.min(srcCoord.latitude, dstCoord.latitude)],
                [Math.max(srcCoord.longitude, dstCoord.longitude), Math.max(srcCoord.latitude, dstCoord.latitude)],
            ],
            { padding: { top: 50, bottom: 50, left: 50, right: 50 }, duration: 1200 },
        );
    }, [srcCoord, dstCoord]);

    // Fly to single warehouse when only one is selected
    useEffect(() => {
        if (!mapRef.current) return;
        if (hasBothCoords) {
            fitBounds();
        } else if (srcCoord) {
            mapRef.current.flyTo({ center: [srcCoord.longitude, srcCoord.latitude], zoom: 14, duration: 1000 });
        } else if (dstCoord) {
            mapRef.current.flyTo({ center: [dstCoord.longitude, dstCoord.latitude], zoom: 14, duration: 1000 });
        }
    }, [srcCoord?.longitude, srcCoord?.latitude, dstCoord?.longitude, dstCoord?.latitude, hasBothCoords, fitBounds]);

    // ─── Status label ───
    const statusLabel = useMemo(() => {
        if (!sourceWarehouse && !destinationWarehouse) return copy.waiting;
        if (!sourceWarehouse) return copy.waitingSource;
        if (!destinationWarehouse) return copy.waitingDest;
        if (srcCoord && !dstCoord) return `${destinationWarehouse.name}: ${copy.noCoordinates}`;
        if (!srcCoord && dstCoord) return `${sourceWarehouse.name}: ${copy.noCoordinates}`;
        if (!srcCoord && !dstCoord) return copy.noCoordinates;
        return null;
    }, [sourceWarehouse, destinationWarehouse, srcCoord, dstCoord, copy]);

    if (webGlError || !MAPBOX_TOKEN) {
        return (
            <section className="overflow-hidden rounded-xl border border-[var(--color-border-soft)] bg-white">
                <div className="flex items-center gap-2 border-b border-[var(--color-border-soft)] px-4 py-3">
                    <MapPin size={16} className="text-[var(--color-status-export-icon)]" />
                    <p className="text-sm font-semibold text-[var(--color-text-primary)]">{copy.routePreview}</p>
                </div>
                <div className="flex h-48 items-center justify-center bg-[var(--color-surface-subtle)] text-xs text-[var(--color-text-muted)]">
                    {webGlError ? copy.webGlError : "Missing NEXT_PUBLIC_MAPBOX_TOKEN"}
                </div>
            </section>
        );
    }

    return (
        <section className="relative overflow-hidden rounded-xl border border-[var(--color-border-soft)] bg-white">
            {/* Map */}
            <div className="relative h-56 sm:h-64 lg:h-72">
                <Map
                    ref={mapRef}
                    initialViewState={{
                        ...DEFAULT_CENTER,
                        zoom: 9,
                    }}
                    style={{ width: "100%", height: "100%" }}
                    mapStyle="mapbox://styles/mapbox/light-v11"
                    mapboxAccessToken={MAPBOX_TOKEN}
                    attributionControl={false}
                    interactive={false}
                    onLoad={() => {
                        if (hasBothCoords) fitBounds();
                    }}
                    onError={(e) => {
                        if (e.error?.message?.toLowerCase().includes("webgl")) {
                            setWebGlError(true);
                        }
                    }}
                >
                    {/* Dashed background route */}
                    {fullRouteGeoJson && (
                        <Source id="route-bg" type="geojson" data={fullRouteGeoJson}>
                            <Layer
                                id="route-bg-line"
                                type="line"
                                paint={{
                                    "line-color": "#94a3b8",
                                    "line-width": 2,
                                    "line-dasharray": [4, 4],
                                    "line-opacity": 0.35,
                                }}
                            />
                        </Source>
                    )}

                    {/* Animated solid route */}
                    {animatedRouteGeoJson && (
                        <Source id="route-anim" type="geojson" data={animatedRouteGeoJson}>
                            <Layer
                                id="route-anim-line"
                                type="line"
                                paint={{
                                    "line-color": "#f97316",
                                    "line-width": 4,
                                    "line-opacity": 0.85,
                                }}
                            />
                        </Source>
                    )}

                    {/* Source marker */}
                    {srcCoord && (
                        <Marker longitude={srcCoord.longitude} latitude={srcCoord.latitude} anchor="bottom">
                            <div className="flex flex-col items-center">
                                <div className="flex h-8 w-8 items-center justify-center rounded-full border-3 border-white bg-[var(--color-status-export-icon)] text-white shadow-lg">
                                    <WarehouseIcon size={14} />
                                </div>
                                <span className="mt-0.5 rounded bg-[var(--color-status-export-icon)] px-1.5 py-0.5 text-micro font-bold text-white shadow">
                                    {copy.from}
                                </span>
                            </div>
                        </Marker>
                    )}

                    {/* Destination marker */}
                    {dstCoord && (
                        <Marker longitude={dstCoord.longitude} latitude={dstCoord.latitude} anchor="bottom">
                            <div className="flex flex-col items-center">
                                <div className="flex h-8 w-8 items-center justify-center rounded-full border-3 border-white bg-[var(--color-status-transit-icon)] text-white shadow-lg">
                                    <WarehouseIcon size={14} />
                                </div>
                                <span className="mt-0.5 rounded bg-[var(--color-status-transit-icon)] px-1.5 py-0.5 text-micro font-bold text-white shadow">
                                    {copy.to}
                                </span>
                            </div>
                        </Marker>
                    )}
                </Map>

                {/* Overlay status */}
                {statusLabel && (
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-white/30 backdrop-blur-[2px]">
                        <div className="flex items-center gap-2 rounded-full bg-white/90 px-4 py-2 shadow-sm">
                            <Navigation size={14} className="text-[var(--color-text-muted)]" />
                            <span className="text-xs font-medium text-[var(--color-text-muted)]">{statusLabel}</span>
                        </div>
                    </div>
                )}

                {/* Loading route */}
                {routeLoading && (
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                        <div className="flex items-center gap-2 rounded-full bg-white/90 px-4 py-2 shadow-sm">
                            <div className="h-3 w-3 animate-spin rounded-full border-2 border-[var(--color-status-export-icon)] border-t-transparent" />
                            <span className="text-xs font-medium text-[var(--color-text-muted)]">{copy.loadingRoute}</span>
                        </div>
                    </div>
                )}

                {/* Route error */}
                {routeError && !routeLoading && (
                    <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2">
                        <div className="rounded-full bg-[var(--color-error-bg)] px-3 py-1 text-xxs font-medium text-[var(--color-error-icon)] shadow-sm">
                            {copy.routeError}
                        </div>
                    </div>
                )}
            </div>

            {/* Route info bar */}
            {(sourceWarehouse || destinationWarehouse) && (
                <div className="absolute top-2 left-2 rounded-full w-fit z-50 flex items-center gap-2 border-b border-[var(--color-border-soft)] bg-white/80 px-2 py-2">
                    <div className="flex items-center gap-1.5">
                        <span className={`flex h-5 w-5 items-center justify-center rounded-full text-white ${sourceWarehouse ? "bg-[var(--color-status-export-icon)]" : "bg-[var(--color-neutral-300)]"}`}>
                            <WarehouseIcon size={10} />
                        </span>
                        <span className="text-xs font-medium text-[var(--color-text-secondary)]">
                            {sourceWarehouse?.name || copy.waitingSource}
                        </span>
                    </div>
                    <ArrowRight size={14} className="shrink-0 text-[var(--color-text-muted)]" />
                    <div className="flex items-center gap-1.5">
                        <span className={`flex h-5 w-5 items-center justify-center rounded-full text-white ${destinationWarehouse ? "bg-[var(--color-status-transit-icon)]" : "bg-[var(--color-neutral-300)]"}`}>
                            <WarehouseIcon size={10} />
                        </span>
                        <span className="text-xs font-medium text-[var(--color-text-secondary)]">
                            {destinationWarehouse?.name || copy.waitingDest}
                        </span>
                    </div>
                    {route && !routeLoading && (
                        <div className="flex items-center gap-2">
                            <span className="rounded-full bg-[var(--color-status-approved-bg)] px-2 py-0.5 text-xxs font-semibold text-[var(--color-status-approved-text)]">
                                {formatDistance(route.distance)}
                            </span>
                            <span className="rounded-full bg-[var(--color-status-completed-bg)] px-2 py-0.5 text-xxs font-semibold text-[var(--color-status-completed-text)]">
                                ~{formatDuration(route.duration)}
                            </span>
                        </div>
                    )}
                </div>
            )}

        </section>
    );
}
