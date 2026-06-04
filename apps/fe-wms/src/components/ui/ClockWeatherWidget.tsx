"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
    sunny,
    partlySunny,
    cloud,
    cloudy,
    thunderstorm,
    rainy,
    snow,
    water,
} from "ionicons/icons";
import { IonIcon } from "@/components/ui/IonIcon";

/* ── Types ── */
interface WeatherData {
    temp: number;
    code: number;
}

type Locale = "vi" | "zh";

/* ── Weather icon mapper (WMO codes) → ionicons filled strings ── */
function weatherIcon(code: number): string {
    if (code === 0 || code === 1) return sunny;           // ☀️  Nắng
    if (code === 2)               return partlySunny;     // ⛅  Mây rải rác
    if (code === 3)               return cloudy;          // ☁️  Nhiều mây
    if (code >= 45 && code <= 48) return cloud;           // 🌫️  Sương mù
    if (code >= 51 && code <= 55) return rainy;           // 🌦️  Mưa phùn
    if (code >= 56 && code <= 57) return snow;            // 🌨️  Mưa đá nhẹ
    if (code >= 61 && code <= 65) return rainy;           // 🌧️  Mưa
    if (code >= 66 && code <= 67) return snow;            // 🌨️  Mưa lạnh
    if (code >= 71 && code <= 77) return snow;            // ❄️  Tuyết
    if (code >= 80 && code <= 82) return water;           // 🌧️  Mưa nặng hạt
    if (code >= 85 && code <= 86) return snow;            // 🌨️  Tuyết rào
    if (code >= 95)               return thunderstorm;    // ⛈️  Sấm sét
    return cloud;
}

/* ── Weather icon color mapper (WMO codes) ── */
function weatherColor(code: number): string {
    if (code === 0 || code === 1) return "text-amber-400";        // ☀️ Nắng — vàng
    if (code === 2 || code === 3) return "text-slate-400";        // ⛅ Nhiều mây — xám
    if (code >= 45 && code <= 48) return "text-slate-500";        // 🌫️ Sương mù/gió — slate đậm
    if (code >= 51 && code <= 55) return "text-cyan-400";         // 🌦️ Mưa phùn — cyan
    if (code >= 56 && code <= 57) return "text-cyan-300";         // 🌨️ Mưa đá nhẹ — cyan nhạt
    if (code >= 61 && code <= 65) return "text-blue-500";         // 🌧️ Mưa — xanh dương
    if (code >= 66 && code <= 67) return "text-blue-300";         // 🌨️ Mưa lạnh — xanh nhạt
    if (code >= 71 && code <= 77) return "text-sky-300";          // ❄️ Tuyết — sky
    if (code >= 80 && code <= 82) return "text-blue-600";         // 🌧️ Mưa nặng hạt — xanh đậm
    if (code >= 85 && code <= 86) return "text-sky-400";          // 🌨️ Tuyết rào — sky
    if (code >= 95)               return "text-violet-500";       // ⛈️ Sấm sét — tím
    return "text-slate-400";
}

/* ── Day labels ── */
const DAYS_VI = ["Chủ Nhật", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"] as const;
const DAYS_ZH = ["\u65e5", "\u4e00", "\u4e8c", "\u4e09", "\u56db", "\u4e94", "\u516d"] as const;

const MONTHS_VI = [
    "Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4",
    "Tháng 5", "Tháng 6", "Tháng 7", "Tháng 8",
    "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12",
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
        : `${pad(now.getDate())} ${MONTHS_VI[now.getMonth()]} ${now.getFullYear()}`;

    const wIcon = weather ? weatherIcon(weather.code) : null;
    const wColor = weather ? weatherColor(weather.code) : "";

    return (
        <div
            className="relative flex w-fit h-full cursor-default items-center overflow-hidden rounded-full bg-white transition-[width] duration-300 ease-in-out shadow-sm"
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
        >
            <div className="flex w-fit shrink-0 items-center gap-1.5 whitespace-nowrap px-3">
                <div className={`flex gap-1 overflow-hidden ease-in-out duration-300 ${!hovered && locale === "vi" ? "w-[35px]" : `${locale === "zh" && !hovered ? "w-[30px]" : "w-[140px]"}`}`}>
                    <span className="text-xs font-semibold text-gray-500">
                        {dayLabel},
                    </span>
                    <span className="text-xs font-semibold text-gray-500">
                        {fullDate}
                    </span>
                </div>
                <span className="text-xs font-bold tabular-nums text-gray-800">
                    {timeStr}
                </span>
                {weather && wIcon && (
                    <>
                        <span className="mx-0.5 h-3 w-px bg-gray-200" />
                        <IonIcon icon={wIcon} size={16} className={wColor} />
                        <span className="text-xs font-semibold text-gray-600">
                            {weather.temp}&deg;C
                        </span>
                    </>
                )}
            </div>
        </div>
    );
}
