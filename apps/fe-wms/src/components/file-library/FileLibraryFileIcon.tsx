import { IconType } from "react-icons";
import { FaFilePdf, FaFileWord, FaFileExcel, FaFileCsv, FaFileAlt } from "react-icons/fa";
import type { FileLibraryFormat } from "@/utils/fileLibrary";

const formatIconMap: Record<FileLibraryFormat, IconType> = {
    pdf: FaFilePdf,
    docx: FaFileWord,
    xlsx: FaFileExcel,
    csv: FaFileCsv,
    other: FaFileAlt,
};

const formatClassMap: Record<FileLibraryFormat, string> = {
    pdf: "bg-[var(--color-error-bg)] text-[var(--color-error-text)]",
    docx: "bg-[var(--color-status-approved-bg)] text-[var(--color-status-approved-text)]",
    xlsx: "bg-[var(--color-status-completed-bg)] text-[var(--color-status-completed-text)]",
    csv: "bg-[var(--color-status-pending-bg)] text-[var(--color-status-pending-text)]",
    other: "bg-[var(--color-status-draft-bg)] text-[var(--color-status-draft-text)]",
};

export function FileLibraryFileIcon({
    format,
    extension,
    className = "rounded-[var(--radius-sm)]",
    iconClassName = "",
}: {
    format: FileLibraryFormat;
    extension: string;
    className?: string;
    iconClassName?: string;
}) {
    const Icon = formatIconMap[format];

    return (
        <div
            className={`relative h-full aspect-square flex shrink-0 p-4 items-center justify-center ${className} ${formatClassMap[format]}`}
        >
            <Icon className={`size-full aspect-square ${iconClassName}`} />
            <span className="absolute bottom-3 right-4 rounded-full px-2 bg-[var(--color-surface-elevated)] px-1 text-xs font-bold text-[var(--color-text-muted)] shadow-sm">
                {extension || "file"}
            </span>
        </div>
    );
}
