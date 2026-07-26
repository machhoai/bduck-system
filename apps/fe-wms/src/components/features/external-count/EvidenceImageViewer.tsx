/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { createPortal } from "react-dom";
import type { ExternalCountDetailText } from "./externalCountDetailCopy";

type EvidenceImageViewerProps = {
  images: string[];
  activeIndex: number;
  text: ExternalCountDetailText;
  onChange: (index: number) => void;
  onClose: () => void;
};

export default function EvidenceImageViewer({
  images,
  activeIndex,
  text,
  onChange,
  onClose,
}: EvidenceImageViewerProps) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft" && images.length > 1) {
        onChange((activeIndex - 1 + images.length) % images.length);
      }
      if (event.key === "ArrowRight" && images.length > 1) {
        onChange((activeIndex + 1) % images.length);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeIndex, images.length, onChange, onClose]);

  if (images.length === 0) return null;
  const imageUrl = images[activeIndex];

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={text.imageViewer}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-3 sm:p-6"
      onClick={onClose}
    >
      <div
        className="relative flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-[var(--color-border-subtle)] px-4">
          <p className="text-sm font-semibold text-[var(--color-text-primary)]">
            {text.imagePosition} {activeIndex + 1}/{images.length}
          </p>
          <button
            type="button"
            aria-label={text.close}
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[var(--color-text-secondary)] transition hover:bg-[var(--color-neutral-100)]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="relative flex min-h-0 flex-1 items-center justify-center bg-[var(--color-neutral-50)] p-3">
          <img
            src={imageUrl}
            alt={`${text.imagePosition} ${activeIndex + 1}`}
            className="max-h-full max-w-full object-contain"
            referrerPolicy="no-referrer"
          />
          {images.length > 1 && (
            <>
              <button
                type="button"
                aria-label={text.previousImage}
                onClick={() =>
                  onChange((activeIndex - 1 + images.length) % images.length)
                }
                className="absolute left-2 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/95 text-[var(--color-text-primary)] shadow-lg transition hover:bg-white sm:left-4"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button
                type="button"
                aria-label={text.nextImage}
                onClick={() => onChange((activeIndex + 1) % images.length)}
                className="absolute right-2 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/95 text-[var(--color-text-primary)] shadow-lg transition hover:bg-white sm:right-4"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
