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
  const currentIpLabel = context.current_ip_address
    ? `${labels.currentIp || "IP hien tai"}: ${context.current_ip_address}`
    : labels.networkChecking || labels.waitingCheckIn;

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

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface-elevated)]"
    >
      <div className="border-b border-[var(--color-border-soft)] bg-[var(--color-surface-card)] p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--color-brand-primary)] text-white">
            <Clock3 size={18} />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
              {labels.personalCheckIn}
            </h2>
            <p className="truncate text-xs text-[var(--color-text-muted)]">
              {labels.vietnamTimezone}
            </p>
          </div>
        </div>
      </div>

      <div className="p-4">
        <div
          className={`mb-4 rounded-[var(--radius-sm)] border p-3 ${
            checkedIn || networkVerified
              ? "border-[#257a3e33] bg-[#257a3e0d] text-[#257a3e]"
              : networkRejected
                ? "border-[#dc262633] bg-[#dc26260d] text-[#991b1b]"
                : "border-[#f59e0b33] bg-[#f59e0b0d] text-[#9a5b00]"
          }`}
        >
          <div className="flex items-center gap-2 text-sm font-semibold">
            {checkedIn ? (
              <CheckCircle2 size={16} />
            ) : networkVerified ? (
              <Wifi size={16} />
            ) : networkRejected ? (
              <WifiOff size={16} />
            ) : (
              <Clock3 size={16} />
            )}
            <span>
              {checkedIn
                ? labels.checkedInToday
                : networkVerified
                  ? labels.companyNetworkReady || labels.waitingCheckIn
                  : networkRejected
                    ? labels.companyNetworkRequired
                    : labels.waitingCheckIn}
            </span>
          </div>
          {checkedIn && (
            <p className="mt-1 text-xs">
              {labels.checkInTime}:{" "}
              {formatCheckInTime(context.today_success_log?.check_in_at)}
            </p>
          )}
          {!checkedIn && networkRejected && (
            <p className="mt-1 text-xs">{labels.companyNetworkRequired}</p>
          )}
          {!checkedIn && !networkRejected && (
            <p className="mt-1 text-xs">{currentIpLabel}</p>
          )}
        </div>

        <button
          type="button"
          onClick={() => void handleCheckIn()}
          disabled={checkedIn}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[var(--radius-sm)] bg-[var(--color-brand-primary)] px-4 text-sm font-semibold text-white shadow-sm transition-all hover:brightness-105 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-[var(--color-text-muted)] disabled:opacity-70"
        >
          <LogIn size={17} />
          <span>{checkedIn ? labels.checkedInToday : labels.checkIn}</span>
        </button>
      </div>
    </motion.section>
  );
}
