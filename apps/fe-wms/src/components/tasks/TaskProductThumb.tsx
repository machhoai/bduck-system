"use client";

import { Image as ImageIcon } from "lucide-react";

interface TaskProductThumbProps {
  imageUrl?: string | null;
  name: string;
  sku?: string | null;
  className?: string;
}

function buildFallbackLabel(name: string, sku?: string | null) {
  const source = (sku || name || "").trim();
  if (!source) return "NA";
  return source.slice(0, 2).toUpperCase();
}

export default function TaskProductThumb({
  imageUrl,
  name,
  sku,
  className = "h-16 w-16",
}: TaskProductThumbProps) {
  const fallbackLabel = buildFallbackLabel(name, sku);

  return (
    <div
      className={`${className} relative shrink-0 overflow-hidden rounded-2xl border border-[var(--color-border-soft)] bg-[linear-gradient(135deg,var(--color-surface-card),var(--color-surface-pearl))]`}
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={name}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-[var(--color-text-muted)]">
          <ImageIcon className="h-4 w-4" />
          <span className="text-[10px] font-semibold tracking-wide">
            {fallbackLabel}
          </span>
        </div>
      )}
    </div>
  );
}
