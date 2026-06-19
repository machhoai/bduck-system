/**
 * StatusBadge — WMS Voucher / Task Status Badge
 *
 * Component dùng chung để render badge trạng thái.
 * Màu sắc 100% từ CSS variables khai báo trong globals.css.
 * Không hard-code bất kỳ màu Tailwind nào.
 */

import type { LucideIcon } from "lucide-react";
import {
  CheckCircle,
  Clock,
  PackageOpen,
  Truck,
  XCircle,
  FileText,
  Package,
  RotateCcw,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { STATUS_BADGE_TEXT } from "@/lib/i18n/componentTranslations";

// ────────────────────────────────────────────────
// Status Config — ánh xạ status → token CSS var
// ────────────────────────────────────────────────

type StatusConfig = {
  labelKey: keyof typeof STATUS_BADGE_TEXT.vi;
  style: string;     // Tailwind classes dùng [var(--...)]
  iconStyle: string; // class màu cho icon
  Icon: LucideIcon;
};

const STATUS_MAP: Record<string, StatusConfig> = {
  // ── Nháp ─────────────────────────────────────
  DRAFT: {
    labelKey: "DRAFT",
    style:
      "bg-[var(--color-status-draft-bg)] text-[var(--color-status-draft-text)] border-[var(--color-status-draft-border)]",
    iconStyle: "text-[var(--color-status-draft-text)]",
    Icon: FileText,
  },

  // ── Chờ duyệt ─────────────────────────────────
  PENDING_APPROVAL: {
    labelKey: "PENDING_APPROVAL",
    style:
      "bg-[var(--color-status-pending-bg)] text-[var(--color-status-pending-text)] border-[var(--color-status-pending-border)]",
    iconStyle: "text-[var(--color-status-pending-icon)]",
    Icon: Clock,
  },

  // ── Đã duyệt ─────────────────────────────────
  APPROVED: {
    labelKey: "APPROVED",
    style:
      "bg-[var(--color-status-approved-bg)] text-[var(--color-status-approved-text)] border-[var(--color-status-approved-border)]",
    iconStyle: "text-[var(--color-status-approved-icon)]",
    Icon: CheckCircle,
  },

  // ── Đang nhận hàng ────────────────────────────
  RECEIVING: {
    labelKey: "RECEIVING",
    style:
      "bg-[var(--color-status-receiving-bg)] text-[var(--color-status-receiving-text)] border-[var(--color-status-receiving-border)]",
    iconStyle: "text-[var(--color-status-receiving-icon)]",
    Icon: Package,
  },

  // ── Hoàn thành ────────────────────────────────
  COMPLETED: {
    labelKey: "COMPLETED",
    style:
      "bg-[var(--color-status-completed-bg)] text-[var(--color-status-completed-text)] border-[var(--color-status-completed-border)]",
    iconStyle: "text-[var(--color-status-completed-icon)]",
    Icon: CheckCircle,
  },

  // ── Từ chối ───────────────────────────────────
  REJECTED: {
    labelKey: "REJECTED",
    style:
      "bg-[var(--color-status-rejected-bg)] text-[var(--color-status-rejected-text)] border-[var(--color-status-rejected-border)]",
    iconStyle: "text-[var(--color-status-rejected-icon)]",
    Icon: XCircle,
  },

  // ── Huỷ bỏ ───────────────────────────────────
  CANCELLED: {
    labelKey: "CANCELLED",
    style:
      "bg-[var(--color-status-rejected-bg)] text-[var(--color-status-rejected-text)] border-[var(--color-status-rejected-border)]",
    iconStyle: "text-[var(--color-status-rejected-icon)]",
    Icon: XCircle,
  },

  // ── Đang picking (xuất kho) ───────────────────
  PICKING: {
    labelKey: "PICKING",
    style:
      "bg-[var(--color-status-picking-bg)] text-[var(--color-status-picking-text)] border-[var(--color-status-picking-border)]",
    iconStyle: "text-[var(--color-status-picking-icon)]",
    Icon: PackageOpen,
  },

  // ── Đang vận chuyển ───────────────────────────
  IN_TRANSIT: {
    labelKey: "IN_TRANSIT",
    style:
      "bg-[var(--color-status-transit-bg)] text-[var(--color-status-transit-text)] border-[var(--color-status-transit-border)]",
    iconStyle: "text-[var(--color-status-transit-icon)]",
    Icon: Truck,
  },

  // ── Chờ xuất (export pending) ─────────────────
  EXPORT_PENDING: {
    labelKey: "EXPORT_PENDING",
    style:
      "bg-[var(--color-status-export-bg)] text-[var(--color-status-export-text)] border-[var(--color-status-export-border)]",
    iconStyle: "text-[var(--color-status-export-icon)]",
    Icon: RotateCcw,
  },

  // ── Nội bộ (intra) ────────────────────────────
  INTRA: {
    labelKey: "INTRA",
    style:
      "bg-[var(--color-status-intra-bg)] text-[var(--color-status-intra-text)] border-[var(--color-status-intra-border)]",
    iconStyle: "text-[var(--color-status-intra-icon)]",
    Icon: RotateCcw,
  },
};

// ── Fallback cho status chưa map ───────────────
const FALLBACK_STATUS: StatusConfig = {
  labelKey: "fallback",
  style:
    "bg-[var(--color-status-draft-bg)] text-[var(--color-status-draft-text)] border-[var(--color-status-draft-border)]",
  iconStyle: "text-[var(--color-status-draft-text)]",
  Icon: AlertCircle,
};

// ────────────────────────────────────────────────
// Props
// ────────────────────────────────────────────────

type BadgeSize = "sm" | "md";
type BadgeLang = "vi" | "zh";

interface StatusBadgeProps {
  /** Status code — vd: "APPROVED", "PENDING_APPROVAL", "PICKING" */
  status: string;
  /** Ngôn ngữ hiển thị label */
  lang?: BadgeLang;
  /** sm = h-5 text-xxs | md = h-6 text-xs (mặc định: sm) */
  size?: BadgeSize;
  /** Ẩn icon bên trái */
  hideIcon?: boolean;
  /** Custom label ghi đè */
  label?: string;
  className?: string;
}

// ────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────

export function StatusBadge({
  status,
  lang = "vi",
  size = "sm",
  hideIcon = false,
  label,
  className,
}: StatusBadgeProps) {
  const config = STATUS_MAP[status] ?? FALLBACK_STATUS;
  const { Icon, style, iconStyle } = config;
  const displayLabel = label ?? STATUS_BADGE_TEXT[lang][config.labelKey];

  const sizeClasses =
    size === "sm"
      ? "h-5 gap-0.5 px-1.5 text-xxs"
      : "h-6 gap-1 px-2 text-xs";

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border font-semibold",
        sizeClasses,
        style,
        className,
      )}
    >
      {!hideIcon && (
        <Icon
          className={cn(
            "shrink-0",
            size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5",
            iconStyle,
          )}
        />
      )}
      {displayLabel}
    </span>
  );
}

// ────────────────────────────────────────────────
// Named export: helper để lấy style string (dùng trong className động)
// ────────────────────────────────────────────────

export function getStatusStyle(status: string): string {
  return (STATUS_MAP[status] ?? FALLBACK_STATUS).style;
}

export function getStatusIconStyle(status: string): string {
  return (STATUS_MAP[status] ?? FALLBACK_STATUS).iconStyle;
}

export function getStatusLabel(status: string, lang: BadgeLang = "vi"): string {
  const config = STATUS_MAP[status] ?? FALLBACK_STATUS;
  return STATUS_BADGE_TEXT[lang][config.labelKey];
}

export { STATUS_MAP };
