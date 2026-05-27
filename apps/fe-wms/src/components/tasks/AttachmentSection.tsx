"use client";

/**
 * AttachmentSection — Displays file attachments with inline PdfViewer
 *
 * Supports: PDF (inline viewer), DOCX/XLSX/CSV (download link)
 * Uses the existing PdfViewer component.
 *
 * LUẬT THÉP: i18n, skeleton loading
 */

import { useState, useCallback } from "react";
import { FileText, Eye, Download } from "lucide-react";
import dynamic from "next/dynamic";
import type { Dictionary } from "@/lib/i18n";

// Lazy-load PdfViewer to avoid pdfjs-dist crash at module init
const PdfViewer = dynamic(
    () => import("@/components/shared/PdfViewer").then((m) => m.PdfViewer),
    { ssr: false },
);

interface AttachmentSectionProps {
    urls: string[];
    t: Dictionary;
}

/** Extract filename from Firebase Storage URL */
function extractFileName(url: string): string {
    try {
        const decoded = decodeURIComponent(url);
        const match = decoded.match(/\/([^/?]+)\?/);
        if (match) return match[1];
        // Fallback: last path segment
        const parts = new URL(url).pathname.split("/");
        return parts[parts.length - 1] || "file";
    } catch {
        return "file";
    }
}

/** Get file extension from URL/filename */
function getFileExt(url: string): string {
    const name = extractFileName(url);
    const dotIdx = name.lastIndexOf(".");
    if (dotIdx === -1) return "";
    return name.slice(dotIdx + 1).toLowerCase();
}

/** File type badge color */
function getExtColor(ext: string): string {
    switch (ext) {
        case "pdf":
            return "bg-red-100 text-red-700";
        case "docx":
            return "bg-blue-100 text-blue-700";
        case "xlsx":
            return "bg-green-100 text-green-700";
        case "csv":
            return "bg-amber-100 text-amber-700";
        default:
            return "bg-gray-100 text-gray-600";
    }
}

export default function AttachmentSection({ urls, t }: AttachmentSectionProps) {
    const [viewingPdf, setViewingPdf] = useState<string | null>(null);

    const handleView = useCallback((url: string) => {
        const ext = getFileExt(url);
        if (ext === "pdf") {
            setViewingPdf(url);
        } else {
            // For non-PDF: open in new tab
            window.open(url, "_blank", "noopener,noreferrer");
        }
    }, []);

    const handleDownload = useCallback((url: string) => {
        const link = document.createElement("a");
        link.href = url;
        link.download = extractFileName(url);
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.click();
    }, []);

    if (urls.length === 0) {
        return (
            <div className="mt-4 px-6">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
                    {t.tasks.attachments.title}
                </h3>
                <p className="py-3 text-center text-sm text-gray-400">
                    {t.tasks.attachments.empty}
                </p>
            </div>
        );
    }

    return (
        <div className="mt-4 px-6">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
                {t.tasks.attachments.title} ({urls.length} {t.tasks.attachments.fileCount})
            </h3>

            <div className="space-y-2">
                {urls.map((url, idx) => {
                    const fileName = extractFileName(url);
                    const ext = getFileExt(url);
                    const isPdf = ext === "pdf";

                    return (
                        <div
                            key={idx}
                            className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50/50 px-4 py-3"
                        >
                            {/* File icon + badge */}
                            <div className="relative flex-shrink-0">
                                <FileText className="h-8 w-8 text-gray-400" />
                                <span
                                    className={`absolute -bottom-1 -right-1 rounded px-1 text-[9px] font-bold uppercase ${getExtColor(ext)}`}
                                >
                                    {ext || "?"}
                                </span>
                            </div>

                            {/* Filename */}
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium text-gray-900">
                                    {fileName}
                                </p>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-1">
                                <button
                                    type="button"
                                    onClick={() => handleView(url)}
                                    className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-50"
                                    title={t.tasks.attachments.viewFile}
                                >
                                    <Eye className="h-3.5 w-3.5" />
                                    {isPdf ? t.tasks.attachments.viewFile : ""}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleDownload(url)}
                                    className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                                    title={t.tasks.attachments.download}
                                >
                                    <Download className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* PDF Viewer overlay */}
            {viewingPdf && (
                <PdfViewer
                    url={viewingPdf}
                    fileName={extractFileName(viewingPdf)}
                    onClose={() => setViewingPdf(null)}
                />
            )}
        </div>
    );
}
