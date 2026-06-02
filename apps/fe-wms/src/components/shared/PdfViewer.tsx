"use client";

/**
 * PdfViewer — Full-screen overlay PDF viewer
 *
 * Uses the browser's native PDF viewer via <iframe> instead of pdfjs-dist.
 * This avoids the "Object.defineProperty called on non-object" crash
 * caused by pdfjs-dist@5.x module-level initialization in Webpack.
 *
 * Features: download button, keyboard close (Escape), skeleton loading.
 * Responsive: full-screen on mobile, center overlay on desktop.
 *
 * LUẬT THÉP: Skeleton loading while PDF renders.
 */

import { useCallback, useEffect, useState } from "react";
import { X, Download, ExternalLink } from "lucide-react";

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
// COMPONENT
// ─────────────────────────────────────────────

export function PdfViewer({
  url,
  fileName = "document.pdf",
  onClose,
}: PdfViewerProps) {
  const [isLoading, setIsLoading] = useState(true);

  // ── Keyboard: Escape to close ──
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const handleDownload = useCallback(() => {
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.click();
  }, [url, fileName]);

  const handleOpenInNewTab = useCallback(() => {
    window.open(url, "_blank", "noopener,noreferrer");
  }, [url]);

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col bg-black/80 backdrop-blur-sm">
      {/* ── Toolbar ── */}
      <div className="flex h-8 shrink-0 items-center justify-between border-b border-white/10 bg-gray-900 px-3 text-white">
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
          <span className="min-w-0 truncate text-xs font-normal text-white/70 sm:text-sm">
            {fileName}
          </span>
        </div>

        {/* Right: open in new tab + download */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleOpenInNewTab}
            className="rounded p-1.5 transition-colors hover:bg-white/10"
            title="Mở trong tab mới"
          >
            <ExternalLink size={16} />
          </button>
          <div className="mx-1 h-4 w-px bg-white/20" />
          <button
            type="button"
            onClick={handleDownload}
            className="rounded p-1.5 transition-colors hover:bg-white/10"
            title="Tải xuống"
          >
            <Download size={16} />
          </button>
        </div>
      </div>

      {/* ── PDF Content via native iframe viewer ── */}
      <div className="relative flex-1">
        {/* Skeleton while iframe loads */}
        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-gray-900">
            <div className="h-96 w-1/2 animate-pulse rounded-lg bg-gray-800" />
            <div className="h-3 w-32 animate-pulse rounded bg-gray-700" />
          </div>
        )}

        <iframe
          src={url}
          title={fileName}
          className="h-full w-full border-0"
          onLoad={() => setIsLoading(false)}
        />
      </div>
    </div>
  );
}
