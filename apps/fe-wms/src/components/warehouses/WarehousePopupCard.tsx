"use client";

/**
 * WarehousePopupCard — Premium popup card shown on map marker click.
 *
 * Design:
 * - Full-bleed image header with gradient overlay + glassmorphism type badge
 * - Inline close button on the image
 * - Clean info body with code, type, address
 * - Bold CTA button with arrow icon
 */

import Image from "next/image";
import Link from "next/link";
import { MapPin, ArrowRight, Warehouse as WarehouseIcon, X } from "lucide-react";
import type { Warehouse } from "@bduck/shared-types";
import { useTranslation } from "@/lib/i18n";

interface WarehousePopupCardProps {
    warehouse: Warehouse;
    onClose: () => void;
}

export function WarehousePopupCard({ warehouse, onClose }: WarehousePopupCardProps) {
    const { t } = useTranslation();

    return (
        <div className="flex flex-col w-72">
            {/* ── Image header ── */}
            <div className="relative h-36 w-full overflow-hidden bg-gradient-to-br from-slate-100 to-slate-200">
                {warehouse.warehouse_image_url ? (
                    <Image
                        src={warehouse.warehouse_image_url}
                        alt={warehouse.name}
                        fill
                        className="object-cover"
                    />
                ) : (
                    <div className="flex h-full w-full items-center justify-center">
                        <WarehouseIcon className="h-10 w-10 text-slate-300" />
                    </div>
                )}

                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

                {/* Close button — top right */}
                <button
                    type="button"
                    onClick={onClose}
                    className="absolute right-2.5 top-2.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-sm transition-colors hover:bg-black/50"
                    aria-label="Đóng"
                >
                    <X size={13} />
                </button>

                {/* Type badge — bottom left on image */}
                <span className="absolute bottom-2.5 left-3 rounded-full bg-white/20 px-2.5 py-0.5 text-xxs font-semibold uppercase tracking-wider text-white backdrop-blur-sm">
                    {t.warehouses.types[warehouse.type]}
                </span>
            </div>

            {/* ── Info body ── */}
            <div className="flex flex-col gap-2.5 p-3.5">
                {/* Name + code */}
                <div>
                    <h3 className="text-sm font-bold leading-tight text-[var(--color-text-primary)] line-clamp-1">
                        {warehouse.name}
                    </h3>
                    <p className="mt-0.5 text-xxs font-mono font-medium text-[var(--color-text-muted)] tracking-wide">
                        #{warehouse.code}
                    </p>
                </div>

                {/* Address */}
                {warehouse.address && (
                    <div className="flex items-start gap-1.5">
                        <MapPin size={12} className="mt-0.5 shrink-0 text-[var(--color-text-disabled)]" />
                        <p className="text-xxs leading-relaxed text-[var(--color-text-secondary)] line-clamp-2">
                            {warehouse.address}
                        </p>
                    </div>
                )}

                {/* Divider */}
                <div className="h-px bg-[var(--color-border-subtle)]" />

                {/* CTA */}
                <Link
                    href={`/warehouses/${warehouse.id}`}
                    className="flex h-8 w-full items-center justify-center gap-1.5 rounded-xl bg-[var(--color-brand-primary)] px-3 text-xs font-semibold text-white transition-all hover:bg-[var(--color-brand-primary-hover)] hover:shadow-md active:scale-[0.97]"
                >
                    {t.warehouses.enterWarehouse}
                    <ArrowRight size={13} />
                </Link>
            </div>
        </div>
    );
}
