"use client";

import type { PosCustomerDisplayPlaylistItem } from "@bduck/shared-types";
import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { gooeyToast } from "goey-toast";
import { Radio, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { posCustomerDisplayApi } from "@/api/posCustomerDisplayApi";
import { usePosCustomerDisplaySettings } from "@/hooks/usePosCustomerDisplaySettings";

import { PosAdvertisingItem } from "./PosAdvertisingItem";
import { PosAdvertisingUploader } from "./PosAdvertisingUploader";
import { usePosAdvertisingCopy } from "./usePosAdvertisingCopy";

export function PosAdvertisingPanel({ warehouseId, canManage }: { warehouseId: string; canManage: boolean }) {
  const copy = usePosAdvertisingCopy();
  const sync = usePosCustomerDisplaySettings(warehouseId, true);
  const [draft, setDraft] = useState<PosCustomerDisplayPlaylistItem[]>([]);
  const [busy, setBusy] = useState<"save" | "upload" | "remove" | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const mediaById = useMemo(() => new Map(sync.view?.media.map((item) => [item.id, item]) ?? []), [sync.view?.media]);

  useEffect(() => {
    setDraft((sync.view?.settings?.playlist ?? []).slice().sort((a, b) => a.sort_order - b.sort_order));
  }, [sync.view?.settings?.version, sync.view?.settings?.playlist]);

  const updateOrder = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    setDraft((current) => {
      const from = current.findIndex((item) => item.media_id === active.id);
      const to = current.findIndex((item) => item.media_id === over.id);
      return arrayMove(current, from, to).map((item, index) => ({ ...item, sort_order: index }));
    });
  };
  const save = async () => {
    setBusy("save");
    try {
      const next = await posCustomerDisplayApi.save(warehouseId, { expected_version: sync.view?.settings?.version ?? 0, playlist: draft.map((item, index) => ({ ...item, sort_order: index })), action_time: new Date().toISOString() });
      sync.replace(next);
      gooeyToast.success(copy.saved);
    } catch (error) { gooeyToast.error(error instanceof Error ? error.message : copy.invalid); }
    finally { setBusy(null); }
  };
  const upload = async (file: File) => {
    if (draft.length >= 10) {
      gooeyToast.error(copy.limit);
      return;
    }
    setBusy("upload");
    try { sync.replace(await posCustomerDisplayApi.upload(warehouseId, file, sync.view?.settings?.version ?? 0)); }
    catch (error) { gooeyToast.error(error instanceof Error ? error.message : copy.invalid); }
    finally { setBusy(null); }
  };
  const remove = async (mediaId: string) => {
    if (!window.confirm(copy.removeConfirm)) return;
    setBusy("remove");
    try { sync.replace(await posCustomerDisplayApi.remove(warehouseId, mediaId, sync.view?.settings?.version ?? 0)); }
    catch (error) { gooeyToast.error(error instanceof Error ? error.message : copy.invalid); }
    finally { setBusy(null); }
  };
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex gap-2"><Radio size={19} className="mt-0.5 text-amber-600" /><div><h2 className="text-sm font-bold text-slate-900">{copy.title}</h2><p className="text-xs text-slate-500">{copy.hint}</p><p className="mt-1 text-[11px] font-bold text-emerald-700">{copy.realtime} · {copy.version} {sync.view?.settings?.version ?? 0}</p></div></div>
        {canManage && <button type="button" disabled={busy !== null || sync.loading} onClick={() => void save()} className="flex h-9 items-center gap-2 rounded-lg bg-slate-900 px-4 text-xs font-bold text-white disabled:opacity-50"><Save size={15} />{busy === "save" ? copy.saving : copy.save}</button>}
      </div>
      {sync.error && <p className="rounded-lg bg-red-50 p-3 text-xs font-bold text-red-700">{sync.error}</p>}
      {canManage && <PosAdvertisingUploader disabled={draft.length >= 10 || busy !== null} uploading={busy === "upload"} onUpload={upload} onInvalid={() => gooeyToast.error(copy.invalid)} />}
      {draft.length === 0 ? <p className="rounded-xl bg-slate-50 p-8 text-center text-xs font-semibold text-slate-500">{copy.empty}</p> : <DndContext sensors={sensors} onDragEnd={updateOrder}><SortableContext items={draft.map((item) => item.media_id)} strategy={verticalListSortingStrategy}><div className="space-y-3">{draft.map((item) => { const media = mediaById.get(item.media_id); return media ? <PosAdvertisingItem key={item.media_id} item={item} media={media} disabled={!canManage || busy !== null} onChange={(next) => setDraft((current) => current.map((entry) => entry.media_id === next.media_id ? next : entry))} onRemove={() => void remove(item.media_id)} /> : null; })}</div></SortableContext></DndContext>}
    </section>
  );
}
