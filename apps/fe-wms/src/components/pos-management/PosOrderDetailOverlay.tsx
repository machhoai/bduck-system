"use client";

import type {
  PosOrderCancelResult,
  PosOrderDetail,
  PosOrderRefundPreview,
  PosOrderSummary,
} from "@bduck/shared-types";
import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";

import { posManagementApi } from "@/api/posManagementApi";
import { BottomSheet } from "@/components/ui/BottomSheet";

import { PosOrderDetailContent } from "./PosOrderDetailContent";
import { usePosOrderCopy } from "./usePosOrderCopy";

interface Props {
  warehouseId: string;
  selectedOrder: PosOrderSummary | null;
  canCancelLocal: boolean;
  canRefundRemote: boolean;
  onClose: () => void;
}

export function PosOrderDetailOverlay({
  warehouseId,
  selectedOrder,
  canCancelLocal,
  canRefundRemote,
  onClose,
}: Props) {
  const copy = usePosOrderCopy();
  const isDesktop = useDesktopLayout();
  const dialogRef = useRef<HTMLDivElement>(null);
  const [detail, setDetail] = useState<PosOrderDetail | null>(null);
  const [preview, setPreview] = useState<PosOrderRefundPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    if (!selectedOrder) {
      setDetail(null);
      setPreview(null);
      setError(null);
      setPreviewError(null);
      return undefined;
    }
    let active = true;
    setLoading(true);
    setPreviewLoading(true);
    setError(null);
    setPreviewError(null);
    const detailRequest = posManagementApi.getOrder(
      warehouseId,
      selectedOrder.localOrderId,
    );
    const previewRequest = posManagementApi.getOrderRefundPreview(
      warehouseId,
      selectedOrder.localOrderId,
    );
    void Promise.allSettled([detailRequest, previewRequest]).then(
      ([detailResult, previewResult]) => {
        if (!active) return;
        if (detailResult.status === "fulfilled") setDetail(detailResult.value);
        else setError(toMessage(detailResult.reason));
        if (previewResult.status === "fulfilled")
          setPreview(previewResult.value);
        else setPreviewError(toMessage(previewResult.reason));
        setLoading(false);
        setPreviewLoading(false);
      },
    );
    return () => {
      active = false;
    };
  }, [selectedOrder, warehouseId]);

  useEffect(() => {
    if (!selectedOrder || !isDesktop) return undefined;
    const previousFocus = document.activeElement as HTMLElement | null;
    const timer = window.setTimeout(() => dialogRef.current?.focus(), 0);
    return () => {
      window.clearTimeout(timer);
      previousFocus?.focus();
    };
  }, [isDesktop, selectedOrder]);

  if (!selectedOrder) return null;

  const body = error ? (
    <p className="rounded-lg border border-red-100 bg-red-50 p-3 text-xs font-semibold text-red-700">
      {error}
    </p>
  ) : loading || !detail ? (
    <DetailSkeleton />
  ) : (
    <PosOrderDetailContent
      warehouseId={warehouseId}
      order={detail}
      preview={preview}
      previewError={previewError}
      previewLoading={previewLoading}
      canCancelLocal={canCancelLocal}
      canRefundRemote={canRefundRemote}
      onCancelled={(result: PosOrderCancelResult) => setDetail(result.order)}
    />
  );

  if (!isDesktop) {
    return (
      <BottomSheet
        isOpen
        defaultSnap="full"
        title={copy.detail}
        onClose={onClose}
        zIndex={80}
        contentClassName="flex-1 overflow-y-auto overscroll-contain px-3 pt-3 pb-8"
      >
        {body}
      </BottomSheet>
    );
  }

  const handleDialogKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      onClose();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    if (!focusable?.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (
      event.shiftKey &&
      (document.activeElement === first ||
        document.activeElement === dialogRef.current)
    ) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/45 p-4"
      onMouseDown={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pos-order-detail-title"
        tabIndex={-1}
        onKeyDown={handleDialogKeyDown}
        onMouseDown={(event) => event.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-2xl outline-none"
      >
        <header className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
          <div className="min-w-0">
            <h2
              id="pos-order-detail-title"
              className="text-sm font-bold text-slate-900"
            >
              {copy.detail}
            </h2>
            <p className="truncate text-xxs text-slate-400">
              {selectedOrder.localOrderId}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={copy.close}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800"
          >
            <X size={17} />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto overscroll-contain p-4">
          {body}
        </div>
      </div>
    </div>
  );
}

function useDesktopLayout() {
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(min-width: 768px)");
    const update = () => setIsDesktop(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return isDesktop;
}

function DetailSkeleton() {
  return (
    <div className="space-y-3" aria-label="Loading">
      <div className="h-36 animate-pulse rounded-xl bg-slate-100" />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="h-32 animate-pulse rounded-xl bg-slate-100" />
        <div className="h-32 animate-pulse rounded-xl bg-slate-100" />
      </div>
      <div className="h-48 animate-pulse rounded-xl bg-slate-100" />
    </div>
  );
}

const toMessage = (value: unknown) =>
  value instanceof Error ? value.message : "Không thể tải thông tin đơn hàng.";
