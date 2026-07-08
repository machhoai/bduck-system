"use client";

/**
 * BreadcrumbNav — Smart breadcrumb tự động resolve tên entity từ route
 *
 * Animation pattern: expand on hover (tương tự ClockWeatherWidget)
 *  - Collapsed: chỉ show segment cuối + Home icon
 *  - Hovered: expand toàn bộ path với max-width + opacity animation
 *
 * Entity resolution ([id] segments):
 *  - /warehouses/[id]       → warehouse.name
 *  - /import-vouchers/[id]  → voucher_number (IMP-YYYYMMDD-XXX)
 *  - /export-vouchers/[id]  → voucher_number (EXP-YYYYMMDD-XXX)
 *  - /transfers/[id]        → order_number (TRF-I-XXX / TRF-X-XXX)
 *
 * Performance: Tất cả entity data đã cache trong Firestore listener hooks,
 * không tạo thêm network request. useMemo memoize toàn bộ segment array.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import { ChevronRight, Home } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { useWarehouses } from "@/hooks/useWarehouses";
import { useImportVouchers } from "@/hooks/useImportVouchers";
import { useExportVouchers } from "@/hooks/useExportVouchers";
import { useTransferOrders } from "@/hooks/useTransferOrders";

// ── Route segment → nav i18n key ────────────────────────────────────────────

const SEGMENT_NAV_KEY: Record<string, string> = {
    "dashboard": "dashboard",
    "warehouses": "warehouses",
    "products": "products",
    "categories": "categories",
    "import-vouchers": "importVoucher",
    "export-vouchers": "exportVoucher",
    "transfers": "transfer",
    "tasks": "tasks",
    "users": "users",
    "roles": "roles",
    "audit-logs": "auditLogs",
    "expenses": "expenses",
    "entry": "expenseEntry",
    "employee-admin": "employeeAdmin",
    "process-configs": "processConfigs",
    "workflows": "workflows",
    "inventory": "inventory",
};

/** Detect Firebase UID / UUID-like IDs — dài ≥15 ký tự alphanumeric+dash+underscore */
function looksLikeId(s: string): boolean {
    return s.length >= 15 && /^[a-zA-Z0-9_-]+$/.test(s) && !(s in SEGMENT_NAV_KEY);
}

// ── Types ────────────────────────────────────────────────────────────────────

interface Segment {
    label: string;
    href: string;
}

// ── Component ────────────────────────────────────────────────────────────────

export function BreadcrumbNav() {
    const { t } = useTranslation();
    const pathname = usePathname();
    const [hovered, setHovered] = useState(false);

    // Entity data — already cached from Firestore real-time listeners
    const { warehouses } = useWarehouses();
    const { allVouchers: importVouchers } = useImportVouchers();
    const { activeVouchers: exportActive, completedVouchers: exportDone } = useExportVouchers();
    const allExportVouchers = useMemo(() => [...exportActive, ...exportDone], [exportActive, exportDone]);
    const { activeOrders, completedOrders } = useTransferOrders();
    const allTransfers = useMemo(() => [...activeOrders, ...completedOrders], [activeOrders, completedOrders]);

    const nav = t.nav as Record<string, string>;

    // ── Parse pathname → label segments ─────────────────────────────────────

    const segments: Segment[] = useMemo(() => {
        if (!pathname || pathname === "/") return [];

        const parts = pathname.split("/").filter(Boolean);
        const result: Segment[] = [];
        let cumHref = "";

        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            const parent = parts[i - 1] ?? "";
            cumHref += `/${part}`;

            let label: string;

            if (looksLikeId(part)) {
                // Resolve entity name / code để hiển thị thay cho raw ID
                switch (parent) {
                    case "warehouses":
                        label = warehouses.find((w) => w.id === part)?.name ?? part;
                        break;
                    case "import-vouchers":
                        label = importVouchers.find((v) => v.id === part)?.voucher_number ?? part;
                        break;
                    case "export-vouchers":
                        label = allExportVouchers.find((v) => v.id === part)?.voucher_number ?? part;
                        break;
                    case "transfers":
                        label = allTransfers.find((tr) => tr.id === part)?.order_number ?? part;
                        break;
                    default:
                        label = part;
                }
            } else {
                // Static segment — translate từ nav key
                label = nav[SEGMENT_NAV_KEY[part] ?? ""] ?? part;
            }

            result.push({ label, href: cumHref });
        }

        return result;
    }, [pathname, nav, warehouses, importVouchers, allExportVouchers, allTransfers]);

    if (segments.length === 0 || pathname === "/dashboard") return null;

    const lastSeg = segments[segments.length - 1];
    const parents = segments.slice(0, -1);

    return (
        <div
            // Để thẻ cha tự giãn theo con một cách tự nhiên theo từng khung hình (frame-by-frame)
            className="relative flex w-fit h-8 cursor-default select-none items-center overflow-hidden rounded-full bg-white shadow-sm"
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            role="navigation"
            aria-label="Breadcrumb"
        >
            <div className="flex shrink-0 items-center whitespace-nowrap px-2">

                {/* Home — always visible */}
                <Link
                    href="/dashboard"
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-card)] hover:text-[var(--color-brand-primary)]"
                    aria-label="Trang chủ"
                >
                    <Home size={13} strokeWidth={2} />
                </Link>

                {/* Parent segments — slide in when expanded */}
                <div
                    className="grid transition-all duration-300 ease-in-out"
                    style={{
                        // 2. SỬ DỤNG minmax(0, ...) để ép trình duyệt cho phép track này thu nhỏ về đúng số 0 mà không bị cản trở bởi nội dung
                        gridTemplateColumns: hovered ? "minmax(0, 1fr)" : "minmax(0, 0fr)",
                        opacity: hovered ? 1 : 0,
                    }}
                    aria-hidden={!hovered}
                >
                    {/* 3. BẮT BUỘC THÊM 'min-w-0' ở đây để flexbox cho phép chữ bên trong co giãn mượt mà theo Grid */}
                    <div className="flex items-center overflow-hidden min-w-0">
                        {parents.map((seg) => (
                            <span key={seg.href} className="flex items-center">
                                <ChevronRight size={11} className="mx-0.5 shrink-0 text-[var(--color-border-subtle)]" />
                                <Link
                                    href={seg.href}
                                    className="rounded px-1 py-0.5 text-xs font-medium text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-card)] hover:text-[var(--color-brand-primary)]"
                                >
                                    {seg.label}
                                </Link>
                            </span>
                        ))}
                    </div>
                </div>

                {/* Separator before last segment */}
                {segments.length > 1 && (
                    <ChevronRight
                        size={11}
                        className="mx-0.5 shrink-0 text-[var(--color-border-subtle)] transition-all duration-500 ease-in-out"
                        style={{
                            opacity: hovered ? 1 : 0.5,
                        }}
                        aria-hidden
                    />
                )}

                {/* Last segment — always visible, truncated with ellipsis */}
                <span
                    className="block overflow-hidden text-ellipsis whitespace-nowrap text-xs font-semibold text-[var(--color-text-primary)] transition-all duration-500 ease-in-out"
                    style={{
                        maxWidth: hovered ? "300px" : "120px",
                    }}
                    title={lastSeg.label}
                >
                    {lastSeg.label}
                </span>
            </div>
        </div>
    );
}
