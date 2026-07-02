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
}: {
    format: FileLibraryFormat;
    extension: string;
}) {
    const Icon = formatIconMap[format];

    return (
        <div
            className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-sm)] ${formatClassMap[format]}`}
        >
            <Icon size={20} />
            <span className="absolute -bottom-1 -right-1 rounded-[var(--radius-xs)] bg-[var(--color-surface-elevated)] px-1 text-micro font-bold uppercase text-[var(--color-text-muted)] shadow-sm">
                {extension || "file"}
            </span>
        </div>
    );
}
