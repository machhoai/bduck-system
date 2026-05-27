"use client";

import { Image as ImageIcon, Upload } from "lucide-react";
import { useEffect, useState } from "react";

interface ImageUploadFieldProps {
  inputId: string;
  previewUrl?: string | null;
  selectedFile: File | null;
  alt: string;
  buttonLabel: string;
  disabled?: boolean;
  onFileChange: (file: File) => void;
}

export function ImageUploadField({
  inputId,
  previewUrl,
  selectedFile,
  alt,
  buttonLabel,
  disabled,
  onFileChange,
}: ImageUploadFieldProps) {
  const [localPreviewUrl, setLocalPreviewUrl] = useState("");

  useEffect(() => {
    if (!selectedFile) {
      setLocalPreviewUrl("");
      return;
    }

    const objectUrl = URL.createObjectURL(selectedFile);
    setLocalPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [selectedFile]);

  const displayUrl = localPreviewUrl || previewUrl || "";

  return (
    <div className="space-y-2">
      <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)]">
        {displayUrl ? (
          <img src={displayUrl} alt={alt} className="h-full w-full object-cover" />
        ) : (
          <ImageIcon size={36} className="text-[var(--color-text-muted)]" />
        )}
      </div>
      <label
        htmlFor={inputId}
        className={`inline-flex h-10 w-full items-center justify-center gap-2 rounded-full border border-[var(--color-border-subtle)] bg-white px-3 text-sm font-normal text-[var(--color-text-secondary)] transition-all active:scale-95 ${
          disabled
            ? "cursor-not-allowed opacity-50"
            : "cursor-pointer hover:bg-[var(--color-surface-card)]"
        }`}
      >
        <Upload size={16} />
        {buttonLabel}
        <input
          id={inputId}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={disabled}
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) onFileChange(file);
          }}
        />
      </label>
    </div>
  );
}
