"use client";

import { useUserStore } from "../../stores/useUserStore";
import { useTranslation } from "../../lib/i18n";
import NotificationBell from "../ui/NotificationBell";
import ClockWeatherWidget from "../ui/ClockWeatherWidget";

export default function TopBar() {
    const user = useUserStore((s) => s.user);
    const { lang } = useTranslation();

    return (
        <div className="flex h-10 justify-between items-center gap-2 px-2 py-2 backdrop-blur-md">
            <div className="h-full flex">
                <ClockWeatherWidget locale={(lang || "vi") as "vi" | "zh"} />
            </div>
            <div className="bg-white rounded-full">
                <NotificationBell />
            </div>
        </div >
    );
}
