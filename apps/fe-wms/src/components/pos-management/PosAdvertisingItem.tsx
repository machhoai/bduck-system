"use client";

import type { PosCustomerDisplayMediaView, PosCustomerDisplayPlaylistItem } from "@bduck/shared-types";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2 } from "lucide-react";

import { usePosAdvertisingCopy } from "./usePosAdvertisingCopy";

export function PosAdvertisingItem({ item, media, disabled, onChange, onRemove }: {
  item: PosCustomerDisplayPlaylistItem;
  media: PosCustomerDisplayMediaView;
  disabled: boolean;
  onChange: (next: PosCustomerDisplayPlaylistItem) => void;
  onRemove: () => void;
}) {
  const copy = usePosAdvertisingCopy();
  const sortable = useSortable({ id: item.media_id, disabled });
  const style = { transform: CSS.Transform.toString(sortable.transform), transition: sortable.transition };
  return (
    <article ref={sortable.setNodeRef} style={style} className="grid gap-3 rounded-xl border border-slate-200 bg-white p-3 md:grid-cols-[auto_9rem_1fr_auto] md:items-center">
      <button type="button" aria-label="Drag" disabled={disabled} {...sortable.attributes} {...sortable.listeners} className="cursor-grab text-slate-400 disabled:cursor-default"><GripVertical size={18} /></button>
      <div className="h-20 overflow-hidden rounded-lg bg-slate-900">
        {media.type === "VIDEO" ? (
          <video src={media.download_url} muted preload="metadata" className="h-full w-full object-cover" />
        ) : (
          // Signed URLs are short-lived and intentionally bypass Next image optimization.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={media.download_url} alt={media.file_name} className="h-full w-full object-cover" />
        )}
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-bold text-slate-900">{media.file_name}</p>
        <p className="mt-1 text-xs text-slate-500">{media.type === "VIDEO" ? copy.video : copy.image}</p>
        <div className="mt-2 flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-700">
          <label className="flex items-center gap-2"><input type="checkbox" checked={item.enabled} disabled={disabled} onChange={(event) => onChange({ ...item, enabled: event.target.checked })} className="accent-amber-500" />{copy.enabled}</label>
          {media.type === "IMAGE" && <label className="flex items-center gap-2">{copy.duration}<input type="number" min={3} max={15} value={item.image_duration_seconds ?? 7} disabled={disabled} onChange={(event) => onChange({ ...item, image_duration_seconds: Math.min(15, Math.max(3, Number(event.target.value) || 3)) })} className="h-8 w-16 rounded-lg border border-slate-200 px-2" />{copy.seconds}</label>}
        </div>
      </div>
      <button type="button" disabled={disabled} onClick={onRemove} className="flex h-8 items-center gap-2 rounded-lg px-3 text-xs font-bold text-red-600 hover:bg-red-50 disabled:opacity-50"><Trash2 size={14} />{copy.remove}</button>
    </article>
  );
}
