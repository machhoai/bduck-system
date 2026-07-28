/* eslint-disable @next/next/no-img-element */
"use client";

import { AlertTriangle, Camera, Package } from "lucide-react";
import type { ExternalCountItem } from "@/api/externalCountApi";
import type { ExternalCountDetailText } from "./externalCountDetailCopy";

type ExternalCountItemCardProps = {
  item: ExternalCountItem;
  index: number;
  lang: "vi" | "zh";
  text: ExternalCountDetailText;
  onOpenImages: (images: string[], index: number) => void;
};

function formatQuantity(value: number | null | undefined, lang: "vi" | "zh") {
  if (value === null || value === undefined) return "-";
  return new Intl.NumberFormat(lang === "zh" ? "zh-CN" : "vi-VN", {
    maximumFractionDigits: 3,
  }).format(value);
}

function QuantityCell({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "warning" | "success";
}) {
  const toneClass =
    tone === "warning"
      ? "text-[var(--color-warning-text)]"
      : tone === "success"
        ? "text-[var(--color-success-text)]"
        : "text-[var(--color-text-primary)]";
  return (
    <div className="rounded-md bg-[var(--color-neutral-50)] px-2.5 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
        {label}
      </p>
      <p className={`mt-0.5 text-sm font-bold tabular-nums ${toneClass}`}>
        {value}
      </p>
    </div>
  );
}

export default function ExternalCountItemCard({
  item,
  index,
  lang,
  text,
  onOpenImages,
}: ExternalCountItemCardProps) {
  const evidence = item.evidence_urls?.filter(Boolean) ?? [];
  const expected =
    item.expected_at_count_time ?? item.base_atp ?? item.system_quantity;
  const condition =
    text.conditions[item.condition as keyof typeof text.conditions] ??
    item.condition;
  const hasIssue =
    item.has_discrepancy || item.discrepancy !== 0 || item.condition !== "GOOD";

  return (
    <article
      className={`overflow-hidden rounded-lg border bg-white ${
        hasIssue
          ? "border-[var(--color-warning-border)]"
          : "border-[var(--color-border-subtle)]"
      }`}
    >
      <div className="flex items-start gap-3 p-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
            hasIssue
              ? "bg-[var(--color-warning-bg)] text-[var(--color-warning-text)]"
              : "bg-[var(--color-neutral-100)] text-[var(--color-text-secondary)]"
          }`}
        >
          {hasIssue ? (
            <AlertTriangle className="h-5 w-5" />
          ) : (
            <Package className="h-5 w-5" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-[var(--color-text-muted)]">
              #{index + 1}
            </span>
            <span className="rounded-full border border-[var(--color-border-subtle)] px-2 py-0.5 text-[10px] font-bold text-[var(--color-text-secondary)]">
              {condition}
            </span>
          </div>
          <p className="mt-1 truncate text-sm font-bold text-[var(--color-text-primary)]">
            {item.product_name || item.product_code || item.product_id}
          </p>
          <p className="mt-0.5 truncate text-xs text-[var(--color-text-muted)]">
            {item.product_code || "-"} · {text.barcode}:{" "}
            {item.product_barcode || "-"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 border-t border-[var(--color-border-soft)] p-3">
        <QuantityCell
          label={text.expected}
          value={`${formatQuantity(expected, lang)} ${item.product_unit || ""}`}
        />
        <QuantityCell
          label={text.counted}
          value={`${formatQuantity(item.counted_quantity, lang)} ${item.product_unit || ""}`}
          tone={!hasIssue ? "success" : undefined}
        />
        <QuantityCell
          label={text.difference}
          value={formatQuantity(item.discrepancy, lang)}
          tone={item.discrepancy !== 0 ? "warning" : "success"}
        />
      </div>

      {(item.discrepancy_reason || item.discrepancy_note || item.notes) && (
        <div className="grid gap-2 border-t border-[var(--color-border-soft)] px-3 py-2.5 text-xs">
          {item.discrepancy_reason && (
            <p className="text-[var(--color-text-secondary)]">
              <span className="font-bold text-[var(--color-text-primary)]">
                {text.reason}:
              </span>{" "}
              {item.discrepancy_reason}
            </p>
          )}
          {(item.discrepancy_note || item.notes) && (
            <p className="text-[var(--color-text-secondary)]">
              <span className="font-bold text-[var(--color-text-primary)]">
                {text.itemNote}:
              </span>{" "}
              {item.discrepancy_note || item.notes}
            </p>
          )}
        </div>
      )}

      <div className="border-t border-[var(--color-border-soft)] px-3 py-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--color-text-primary)]">
            <Camera className="h-4 w-4 text-[var(--color-brand-primary)]" />
            {text.evidenceImages}
          </p>
          <span className="text-xs font-semibold tabular-nums text-[var(--color-text-muted)]">
            {evidence.length}
          </span>
        </div>
        {evidence.length === 0 ? (
          <p className="rounded-md bg-[var(--color-neutral-50)] px-3 py-2 text-xs text-[var(--color-text-muted)]">
            {text.noEvidence}
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {evidence.map((url, evidenceIndex) => (
              <button
                key={`${url}-${evidenceIndex}`}
                type="button"
                aria-label={`${text.openImage} ${evidenceIndex + 1}`}
                onClick={() => onOpenImages(evidence, evidenceIndex)}
                className="group relative aspect-square overflow-hidden rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-neutral-50)] focus:outline-none focus:ring-2 focus:ring-[var(--color-border-focus)]"
              >
                <img
                  src={url}
                  alt={`${text.imagePosition} ${evidenceIndex + 1}`}
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover transition duration-200 group-hover:scale-105"
                />
              </button>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
