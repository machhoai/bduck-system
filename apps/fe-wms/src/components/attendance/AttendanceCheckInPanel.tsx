"use client";

import type { AttendanceCheckInContext } from "@bduck/shared-types";
import { motion } from "framer-motion";
import { CheckCircle2, Clock3, LogIn, Wifi, WifiOff } from "lucide-react";
import { gooeyToast } from "goey-toast";
import { formatCheckInTime } from "@/utils/attendance";

interface AttendanceCheckInPanelProps {
    context: AttendanceCheckInContext | null;
    labels: Record<string, string>;
    onCheckIn: () => Promise<unknown>;
}

export function AttendanceCheckInPanel({
    context,
    labels,
    onCheckIn,
}: AttendanceCheckInPanelProps) {
    if (!context?.can_check_in) return null;

    const checkedIn = Boolean(context.today_success_log);
    const networkVerified = context.is_company_network === true;
    const networkRejected = context.is_company_network === false;

    const handleCheckIn = async () => {
        const task = onCheckIn();
        await gooeyToast.promise(task, {
            loading: labels.checkingIn,
            success: labels.checkInSuccess,
            error: labels.checkInError,
            description: {
                success: labels.checkInSuccessDesc,
                error: labels.companyNetworkRequired,
            },
            action: {
                error: {
                    label: labels.retry,
                    onClick: () => void handleCheckIn(),
                },
            },
        });
    };

    let btnText = "";
    let btnDisabled = false;
    let btnIcon = <LogIn size={17} />;
    let btnTooltip: string | undefined = undefined;

    if (checkedIn) {
        const time = formatCheckInTime(context.today_success_log?.check_in_at);
        btnText = (labels.checkedInAt || "Đã check-in lúc {time}").replace("{time}", time);
        btnDisabled = true;
        btnIcon = <CheckCircle2 size={17} />;
    } else if (networkRejected) {
        btnText = labels.cannotCheckIn || "Không thể check-in";
        btnDisabled = true;
        btnIcon = <WifiOff size={17} />;
        btnTooltip = labels.companyNetworkRequired || "Bạn đang không dùng mạng công ty. Vui lòng kết nối mạng công ty để check-in.";
    } else if (networkVerified) {
        btnText = labels.checkInNow || "Check-in ngay";
        btnDisabled = false;
        btnIcon = <LogIn size={17} />;
    } else {
        btnText = labels.networkChecking || "Đang kiểm tra...";
        btnDisabled = true;
        btnIcon = <Clock3 size={17} />;
    }

    return (
        <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            title={btnTooltip}
            className="overflow-hidden rounded-full border border-[var(--color-border-soft)] bg-[var(--color-surface-elevated)]"
        >
            <button
                type="button"
                onClick={() => void handleCheckIn()}
                disabled={btnDisabled}
                className="inline-flex p-2 relative h-full w-full items-center justify-center gap-2 rounded-full bg-[var(--color-brand-primary)] px-4 text-sm font-semibold text-white shadow-sm transition-all hover:brightness-105 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-[var(--color-text-muted)] disabled:opacity-70"
            >
                {btnIcon}
                <span>{btnText}</span>
            </button>
        </motion.section>
    );
}
