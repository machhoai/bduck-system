"use client";

import { useTranslation } from "../../lib/i18n";
import NotificationBell from "../ui/NotificationBell";
import ClockWeatherWidget from "../ui/ClockWeatherWidget";
import DeviceStatusIndicator from "../ui/DeviceStatusIndicator";

export default function TopBar() {
    const { lang } = useTranslation();

    return (
        <div className="flex absolute top-0 z-50 h-10 w-full justify-between items-center gap-2 px-4 pt-2">
            <div className="h-full flex items-center gap-2">
                <ClockWeatherWidget locale={(lang || "vi") as "vi" | "zh"} />
                <DeviceStatusIndicator />
            </div>
            <NotificationBell />
        </div>
    );
}
