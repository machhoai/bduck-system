"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Cloud, CloudDrizzle, CloudLightning, CloudRain, CloudSnow, Droplets, Sun, Wind } from "lucide-react";

/* ── Types ── */
interface WeatherData {
    temp: number;
    code: number;
}

type Locale = "vi" | "zh";

/* ── Weather icon mapper (WMO codes) ── */
function weatherIcon(code: number) {
    if (code === 0 || code === 1) return Sun;
    if (code === 2 || code === 3) return Cloud;
    if (code >= 45 && code <= 48) return Wind;
    if (code >= 51 && code <= 55) return CloudDrizzle;
    if (code >= 56 && code <= 57) return Droplets;
    if (code >= 61 && code <= 65) return CloudRain;
    if (code >= 66 && code <= 67) return CloudSnow;
    if (code >= 71 && code <= 77) return CloudSnow;
    if (code >= 80 && code <= 82) return CloudRain;
    if (code >= 85 && code <= 86) return CloudSnow;
    if (code >= 95) return CloudLightning;
    return Cloud;
}

/* ── Day labels ── */
const DAYS_VI = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"] as const;
const DAYS_ZH = ["\u65e5", "\u4e00", "\u4e8c", "\u4e09", "\u56db", "\u4e94", "\u516d"] as const;

const MONTHS_VI = [
    "Th\u00e1ng 1", "Th\u00e1ng 2", "Th\u00e1ng 3", "Th\u00e1ng 4",
    "Th\u00e1ng 5", "Th\u00e1ng 6", "Th\u00e1ng 7", "Th\u00e1ng 8",
    "Th\u00e1ng 9", "Th\u00e1ng 10", "Th\u00e1ng 11", "Th\u00e1ng 12",
] as const;

/* ── Pad number ── */
function pad(n: number) {
    return n < 10 ? `0${n}` : `${n}`;
}

/* ── Component ── */
interface Props {
    locale?: Locale;
}

export default function ClockWeatherWidget({ locale = "vi" }: Props) {
    const [now, setNow] = useState(() => new Date());
    const [weather, setWeather] = useState<WeatherData | null>(null);
    const [hovered, setHovered] = useState(false);
    const collapsedRef = useRef<HTMLDivElement>(null);
    const expandedRef = useRef<HTMLDivElement>(null);
    const [collapsedW, setCollapsedW] = useState(0);
    const [expandedW, setExpandedW] = useState(0);

    /* ── Tick every second ── */
    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    /* ── Fetch weather (Open-Meteo free, no key) ── */
    const fetchWeather = useCallback(async (lat: number, lon: number) => {
        try {
            const res = await fetch(
                `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&timezone=auto`,
            );
            const data = await res.json();
            if (data.current) {
                setWeather({
                    temp: Math.round(data.current.temperature_2m),
                    code: data.current.weather_code,
                });
            }
        } catch {
            /* silent fail – widget still shows clock */
        }
    }, []);

    useEffect(() => {
        /* Default: Ho Chi Minh City */
        let lat = 10.7769;
        let lon = 106.7009;

        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    lat = pos.coords.latitude;
                    lon = pos.coords.longitude;
                    fetchWeather(lat, lon);
                },
                () => fetchWeather(lat, lon),
                { timeout: 5000 },
            );
        } else {
            fetchWeather(lat, lon);
        }

        /* Refresh weather every 10 minutes */
        const interval = setInterval(() => fetchWeather(lat, lon), 600_000);
        return () => clearInterval(interval);
    }, [fetchWeather]);

    /* ── Measure widths ── */
    useEffect(() => {
        if (collapsedRef.current) setCollapsedW(collapsedRef.current.scrollWidth);
        if (expandedRef.current) setExpandedW(expandedRef.current.scrollWidth);
    }, [now, weather]);

    /* ── Derived strings ── */
    const dayLabel = locale === "zh"
        ? `\u5468${DAYS_ZH[now.getDay()]}`
        : DAYS_VI[now.getDay()];

    const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

    const fullDate = locale === "zh"
        ? `${now.getFullYear()}\u5e74${now.getMonth() + 1}\u6708${now.getDate()}\u65e5 \u5468${DAYS_ZH[now.getDay()]}`
        : `${DAYS_VI[now.getDay()]}, ${pad(now.getDate())} ${MONTHS_VI[now.getMonth()]} ${now.getFullYear()}`;

    const WIcon = weather ? weatherIcon(weather.code) : null;

    const currentWidth = hovered
        ? Math.max(expandedW + 8, collapsedW + 8)
        : collapsedW + 8;

    return (
        <div
            className="relative flex h-full cursor-default items-center overflow-hidden rounded-full bg-white transition-[width] duration-300 ease-in-out"
            style={{ width: currentWidth || "auto" }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
        >
            {/* Collapsed content (always rendered for measurement) */}
            <div
                ref={collapsedRef}
                className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap px-3 transition-opacity duration-200 ${hovered ? "pointer-events-none absolute opacity-0" : "opacity-100"
                    }`}
            >
                <span className="text-xxs font-semibold text-gray-500">
                    {dayLabel}
                </span>
                <span className="text-xxs font-bold tabular-nums text-gray-800">
                    {timeStr}
                </span>
                {weather && (
                    <>
                        <span className="mx-0.5 h-3 w-px bg-gray-200" />
                        {WIcon && <WIcon size={12} className="text-amber-500" />}
                        <span className="text-xxs font-semibold text-gray-600">
                            {weather.temp}&deg;C
                        </span>
                    </>
                )}
            </div>

            {/* Expanded content */}
            <div
                ref={expandedRef}
                className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap px-3 transition-opacity duration-200 ${hovered ? "opacity-100" : "pointer-events-none absolute opacity-0"
                    }`}
            >
                <span className="text-xxs font-bold tabular-nums text-gray-800">
                    {timeStr}
                </span>
                <span className="mx-0.5 h-3 w-px bg-gray-200" />
                <span className="text-xxs font-semibold text-gray-500">
                    {fullDate}
                </span>
                {weather && (
                    <>
                        <span className="mx-0.5 h-3 w-px bg-gray-200" />
                        {WIcon && <WIcon size={12} className="text-amber-500" />}
                        <span className="text-xxs font-semibold text-gray-600">
                            {weather.temp}&deg;C
                        </span>
                    </>
                )}
            </div>
        </div>
    );
}
