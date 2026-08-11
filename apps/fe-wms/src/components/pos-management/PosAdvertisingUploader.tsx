"use client";

import { ImagePlus, LoaderCircle } from "lucide-react";
import { useRef } from "react";

import { usePosAdvertisingCopy } from "./usePosAdvertisingCopy";

const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "video/mp4"]);

const validateVideoDuration = (file: File) =>
  new Promise<boolean>((resolve) => {
    const video = document.createElement("video");
    const url = URL.createObjectURL(file);
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      const valid = Number.isFinite(video.duration) && video.duration <= 15.05;
      URL.revokeObjectURL(url);
      resolve(valid);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(false);
    };
    video.src = url;
  });

export function PosAdvertisingUploader({ disabled, uploading, onUpload, onInvalid }: {
  disabled: boolean;
  uploading: boolean;
  onUpload: (file: File) => Promise<void>;
  onInvalid: () => void;
}) {
  const copy = usePosAdvertisingCopy();
  const input = useRef<HTMLInputElement>(null);
  const choose = async (file?: File) => {
    if (!file || !ALLOWED_TYPES.has(file.type)) return onInvalid();
    const sizeLimit = file.type === "video/mp4" ? 10 * 1024 * 1024 : 20 * 1024 * 1024;
    if (file.size > sizeLimit) return onInvalid();
    if (file.type === "video/mp4" && !(await validateVideoDuration(file))) return onInvalid();
    await onUpload(file);
    if (input.current) input.current.value = "";
  };
  return (
    <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50/60 p-4">
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp,video/mp4" hidden onChange={(event) => void choose(event.target.files?.[0])} />
      <button type="button" disabled={disabled || uploading} onClick={() => input.current?.click()} className="flex h-9 items-center gap-2 rounded-lg bg-amber-500 px-4 text-xs font-bold text-white disabled:opacity-50">
        {uploading ? <LoaderCircle size={16} className="animate-spin" /> : <ImagePlus size={16} />}
        {uploading ? copy.uploading : copy.upload}
      </button>
      <p className="mt-2 text-xs text-amber-900/70">{copy.uploadHint}</p>
    </div>
  );
}
