"use client";

import {
    AttendanceVerificationStrategy,
    type AttendanceCheckInContext,
} from "@bduck/shared-types";
import { motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Clock3, LogIn, MapPin, WifiOff } from "lucide-react";
import { gooeyToast } from "goey-toast";
import { formatCheckInTime } from "@/utils/attendance";

interface TimeCheckInPanelProps {
    context: AttendanceCheckInContext | null;
    labels: Record<string, string>;
    onCheckIn: () => Promise<unknown>;
    onReportLate?: () => void;
}

export function TimeCheckInPanel({
    context,
    labels,
    onCheckIn,
    onReportLate,
}: TimeCheckInPanelProps) {
    if (!context?.can_check_in) return null;

    const checkedIn = Boolean(context.today_success_log);
    const networkVerified = context.is_company_network === true;
    const networkRejected = context.is_company_network === false;
    const canUseGps =
        context.verification_strategy !== AttendanceVerificationStrategy.IP_ONLY;
    const shouldUseGps =
        Boolean(context.active_work_arrangement) ||
        context.location_required ||
        context.verification_strategy === AttendanceVerificationStrategy.GPS_ONLY ||
        context.verification_strategy === AttendanceVerificationStrategy.IP_AND_GPS;

    const handleCheckIn = async () => {
        const task = onCheckIn();
        await gooeyToast.promise(task, {
            loading: labels.checkingIn,
            success: labels.checkInSuccess,
            error: labels.checkInError,
            description: {
                success: labels.checkInSuccessDesc,
                error: shouldUseGps
                    ? labels.gpsCheckInHint
                    : labels.companyNetworkRequired,
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
    } else if (shouldUseGps) {
        btnText = labels.checkInWithGps;
        btnDisabled = false;
        btnIcon = <MapPin size={17} />;
        btnTooltip =
            labels.gpsCheckInHint;
    } else if (networkRejected && !canUseGps) {
        btnText = labels.cannotCheckIn || "Không thể check-in";
        btnDisabled = true;
        btnIcon = <WifiOff size={17} />;
        btnTooltip = labels.companyNetworkRequired || "Bạn đang không dùng mạng công ty. Vui lòng kết nối mạng công ty để check-in.";
    } else if (networkVerified) {
        btnText = labels.checkInNow || "Check-in ngay";
        btnDisabled = false;
        btnIcon = <LogIn size={17} />;
    } else if (canUseGps) {
        btnText = labels.checkInWithGps;
        btnDisabled = false;
        btnIcon = <MapPin size={17} />;
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
            className="overflow-hidden gap-2 md:flex shrink-0 rounded-4xl border border-white/80 bg-white p-3 shadow-sm lg:rounded-full lg:border-[var(--color-border-soft)] lg:bg-[var(--color-surface-elevated)] lg:p-2 lg:shadow-none"
        >
            <div className="mb-1 flex items-center justify-between gap-3 lg:hidden">
                <div className="min-w-0">
                    <p className="text-xs font-semibold text-[var(--color-text-muted)]">
                        {shouldUseGps
                            ? labels.gpsCheckInHint
                            : labels.companyNetworkRequired}
                    </p>
                </div>
                <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${networkRejected
                        ? "bg-[#b4231810] text-[#b42318]"
                        : checkedIn
                            ? "bg-[#257a3e10] text-[#257a3e]"
                            : "bg-[var(--color-brand-primary-muted)] text-[var(--color-brand-primary)]"
                        }`}
                >
                    {btnIcon}
                </div>
            </div>
            <button
                type="button"
                onClick={() => void handleCheckIn()}
                disabled={btnDisabled}
                className="relative inline-flex h-[52px] w-full items-center justify-center gap-2 rounded-full bg-[var(--color-brand-primary)] px-4 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:brightness-105 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-[var(--color-text-muted)] disabled:opacity-70 lg:h-11"
            >
                {btnIcon}
                <span>{btnText}</span>
            </button>
            {onReportLate ? (
                <button
                    type="button"
                    onClick={onReportLate}
                    className="inline-flex mt-2 md:mt-0 h-11 w-full items-center justify-center gap-2 rounded-full border border-[#f59e0b30] bg-[#f59e0b10] px-4 text-sm font-semibold text-[#936000] transition-all hover:bg-[#f59e0b18] active:scale-[0.98]"
                >
                    <AlertTriangle size={16} />
                    <span>{labels.reportLate || "Bao den tre"}</span>
                </button>
            ) : null}
        </motion.section>
    );
}
