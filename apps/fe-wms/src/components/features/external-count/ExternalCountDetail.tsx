"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, RefreshCw, X } from "lucide-react";
import { gooeyToast } from "goey-toast";
import {
  externalCountApi,
  type ExternalCountDetail as ExternalCountDetailData,
} from "@/api/externalCountApi";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { useTranslation } from "@/lib/i18n";
import EvidenceImageViewer from "./EvidenceImageViewer";
import ExternalCountDetailContent, {
  ExternalCountDetailSkeleton,
} from "./ExternalCountDetailContent";
import { externalCountDetailCopy } from "./externalCountDetailCopy";

type ExternalCountDetailProps = {
  sessionId: string;
  onClose: () => void;
};

export default function ExternalCountDetail({
  sessionId,
  onClose,
}: ExternalCountDetailProps) {
  const { lang } = useTranslation();
  const text = externalCountDetailCopy[lang] ?? externalCountDetailCopy.vi;
  const [detail, setDetail] = useState<ExternalCountDetailData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [viewer, setViewer] = useState({ images: [] as string[], index: 0 });

  useEffect(() => {
    let active = true;
    setDetail(null);
    setHasError(false);
    setIsLoading(true);

    const loadDetail = async () => {
      try {
        const response = await externalCountApi.getDetail(sessionId);
        if (active) setDetail(response.data);
      } catch (error) {
        console.error("[ExternalCountDetail] load failed", error);
        if (!active) return;
        setHasError(true);
        gooeyToast.error(text.loadingError, {
          description: text.loadingErrorDescription,
          preset: "snappy",
        });
      } finally {
        if (active) setIsLoading(false);
      }
    };

    void loadDetail();
    return () => {
      active = false;
    };
  }, [reloadKey, sessionId, text.loadingError, text.loadingErrorDescription]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && viewer.images.length === 0) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, viewer.images.length]);

  const openImages = useCallback((images: string[], index: number) => {
    setViewer({ images, index });
  }, []);

  const content = useMemo(() => {
    if (isLoading) return <ExternalCountDetailSkeleton />;
    if (hasError || !detail) {
      return (
        <div className="flex min-h-72 flex-col items-center justify-center gap-3 p-6 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-error-bg)] text-[var(--color-error-text)]">
            <AlertTriangle className="h-6 w-6" />
          </span>
          <div>
            <p className="text-sm font-bold text-[var(--color-text-primary)]">
              {text.loadingError}
            </p>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              {text.loadingErrorDescription}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setReloadKey((value) => value + 1)}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[var(--color-brand-primary)] px-4 text-sm font-bold text-white"
          >
            <RefreshCw className="h-4 w-4" />
            {text.retry}
          </button>
        </div>
      );
    }
    return (
      <ExternalCountDetailContent
        detail={detail}
        lang={lang}
        text={text}
        onOpenImages={openImages}
      />
    );
  }, [detail, hasError, isLoading, lang, openImages, text]);

  return (
    <>
      <div
        className="fixed inset-0 z-50 hidden bg-black/35 md:block"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={text.title}
        className="fixed inset-y-0 right-0 z-[60] hidden w-full max-w-[640px] flex-col bg-[var(--color-surface-subtle)] shadow-2xl md:flex"
      >
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-[var(--color-border-subtle)] bg-white px-5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--color-brand-primary-muted)] text-[var(--color-brand-primary)]">
              <CheckCircle2 className="h-5 w-5" />
            </span>
            <h2 className="text-base font-bold text-[var(--color-text-primary)]">
              {text.title}
            </h2>
          </div>
          <button
            type="button"
            aria-label={text.close}
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[var(--color-text-secondary)] transition hover:bg-[var(--color-neutral-100)]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {content}
        </div>
      </aside>

      <BottomSheet
        title={text.title}
        defaultSnap="full"
        isOpen
        onClose={onClose}
        zIndex={70}
        contentClassName="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-[var(--color-surface-subtle)] pb-6"
      >
        {content}
      </BottomSheet>

      {viewer.images.length > 0 && (
        <EvidenceImageViewer
          images={viewer.images}
          activeIndex={viewer.index}
          text={text}
          onChange={(index) => setViewer((current) => ({ ...current, index }))}
          onClose={() => setViewer({ images: [], index: 0 })}
        />
      )}
    </>
  );
}
