"use client";

/**
 * PdfViewer — Full-screen overlay PDF viewer
 *
 * Uses react-pdf (pdfjs-dist) to render PDF pages.
 * Features: zoom, page navigation, download, keyboard shortcuts.
 * Responsive: full-screen on mobile, center overlay on desktop.
 *
 * LUẬT THÉP: Skeleton loading while PDF renders.
 */

import { useCallback, useEffect, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import {
  X,
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  Download,
  Maximize2,
} from "lucide-react";
import { Skeleton } from "../ui/Skeleton";

// Configure pdf.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

interface PdfViewerProps {
  /** URL of the PDF file */
  url: string;
  /** Filename for download */
  fileName?: string;
  /** Called when overlay is closed */
  onClose: () => void;
}

// ─────────────────────────────────────────────
// ZOOM LEVELS
// ─────────────────────────────────────────────

const ZOOM_LEVELS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
const DEFAULT_ZOOM_INDEX = 2; // 1.0x

// ─────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────

export function PdfViewer({ url, fileName = "document.pdf", onClose }: PdfViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [zoomIndex, setZoomIndex] = useState(DEFAULT_ZOOM_INDEX);
  const [isLoading, setIsLoading] = useState(true);

  const scale = ZOOM_LEVELS[zoomIndex];

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        setPageNumber((p) => Math.max(1, p - 1));
      }
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        setPageNumber((p) => Math.min(numPages, p + 1));
      }
      if (e.key === "+" || e.key === "=") {
        setZoomIndex((z) => Math.min(ZOOM_LEVELS.length - 1, z + 1));
      }
      if (e.key === "-") {
        setZoomIndex((z) => Math.max(0, z - 1));
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    // Lock body scroll
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [numPages, onClose]);

  const onDocumentLoadSuccess = useCallback(
    ({ numPages: total }: { numPages: number }) => {
      setNumPages(total);
      setIsLoading(false);
    },
    [],
  );

  const handleDownload = useCallback(() => {
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.click();
  }, [url, fileName]);

  const handleZoomIn = () =>
    setZoomIndex((z) => Math.min(ZOOM_LEVELS.length - 1, z + 1));
  const handleZoomOut = () => setZoomIndex((z) => Math.max(0, z - 1));
  const handleFitPage = () => setZoomIndex(DEFAULT_ZOOM_INDEX);
  const prevPage = () => setPageNumber((p) => Math.max(1, p - 1));
  const nextPage = () => setPageNumber((p) => Math.min(numPages, p + 1));

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col bg-black/80 backdrop-blur-sm">
      {/* ── Toolbar ── */}
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-white/10 bg-[var(--color-surface-nav)] px-3 text-white">
        {/* Left: close + filename */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 transition-colors hover:bg-white/10"
            aria-label="Close"
          >
            <X size={18} />
          </button>
          <span className="max-w-[200px] truncate text-xs font-normal text-white/70 sm:max-w-none sm:text-sm">
            {fileName}
          </span>
        </div>

        {/* Center: page navigation */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={prevPage}
            disabled={pageNumber <= 1}
            className="rounded p-1.5 transition-colors hover:bg-white/10 disabled:opacity-30"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="min-w-[60px] text-center text-xs tabular-nums">
            {pageNumber} / {numPages || "..."}
          </span>
          <button
            type="button"
            onClick={nextPage}
            disabled={pageNumber >= numPages}
            className="rounded p-1.5 transition-colors hover:bg-white/10 disabled:opacity-30"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Right: zoom + download */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleZoomOut}
            disabled={zoomIndex <= 0}
            className="rounded p-1.5 transition-colors hover:bg-white/10 disabled:opacity-30"
          >
            <ZoomOut size={16} />
          </button>
          <span className="min-w-[40px] text-center text-xs tabular-nums">
            {Math.round(scale * 100)}%
          </span>
          <button
            type="button"
            onClick={handleZoomIn}
            disabled={zoomIndex >= ZOOM_LEVELS.length - 1}
            className="rounded p-1.5 transition-colors hover:bg-white/10 disabled:opacity-30"
          >
            <ZoomIn size={16} />
          </button>
          <button
            type="button"
            onClick={handleFitPage}
            className="rounded p-1.5 transition-colors hover:bg-white/10"
            title="Fit page"
          >
            <Maximize2 size={16} />
          </button>
          <div className="mx-1 h-4 w-px bg-white/20" />
          <button
            type="button"
            onClick={handleDownload}
            className="rounded p-1.5 transition-colors hover:bg-white/10"
            title="Download"
          >
            <Download size={16} />
          </button>
        </div>
      </div>

      {/* ── PDF Content ── */}
      <div className="flex-1 overflow-auto">
        <div className="flex min-h-full items-start justify-center py-6">
          {isLoading && (
            <div className="flex flex-col items-center gap-4 py-20">
              <Skeleton className="h-[600px] w-[450px]" variant="rect" />
              <Skeleton className="h-3 w-32" variant="text" />
            </div>
          )}

          <Document
            file={url}
            onLoadSuccess={onDocumentLoadSuccess}
            loading={null}
            error={
              <div className="py-20 text-center text-sm text-white/60">
                Không thể tải PDF. Vui lòng thử lại.
              </div>
            }
          >
            <Page
              pageNumber={pageNumber}
              scale={scale}
              className="shadow-2xl"
              loading={
                <Skeleton className="h-[600px] w-[450px]" variant="rect" />
              }
            />
          </Document>
        </div>
      </div>
    </div>
  );
}
