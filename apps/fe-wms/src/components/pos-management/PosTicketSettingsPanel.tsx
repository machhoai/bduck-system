"use client";

import type { PosTicketSettings } from "@bduck/shared-types";
import { gooeyToast } from "goey-toast";
import { RotateCcw, Save } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import {
  posManagementApi,
  type PosTicketSettingsPayload,
} from "@/api/posManagementApi";

import {
  PosTicketContentSection,
  PosTicketDisplaySection,
  PosTicketTypographySection,
} from "./PosTicketContentSections";
import { createDefaultPosTicketSettings } from "./posTicketDefaults";
import { PosTicketPreview } from "./PosTicketPreview";
import {
  PosTicketBrandSection,
  PosTicketPaperSection,
} from "./PosTicketSettingsSections";
import { usePosTicketEditorCopy } from "./usePosTicketEditorCopy";

const toPayload = (settings: PosTicketSettings): PosTicketSettingsPayload => {
  const {
    id: _id,
    warehouse_id: _warehouse,
    version: _version,
    updated_by: _user,
    is_deleted: _deleted,
    created_at: _created,
    updated_at: _updated,
    ...payload
  } = settings;
  return payload;
};

export function PosTicketSettingsPanel({
  warehouseId,
  storeName,
  settings,
  canManage,
  onChanged,
}: {
  warehouseId: string;
  storeName: string;
  settings: PosTicketSettings | null;
  canManage: boolean;
  onChanged: () => Promise<void>;
}) {
  const { copy } = usePosTicketEditorCopy();
  const synchronizedForm = useMemo(
    () =>
      settings
        ? toPayload(settings)
        : createDefaultPosTicketSettings(storeName),
    [settings, storeName],
  );
  const [draftForm, setDraftForm] = useState<PosTicketSettingsPayload | null>(
    null,
  );
  const [saving, setSaving] = useState(false);
  const form = draftForm ?? synchronizedForm;
  const update = useCallback(
    <K extends keyof PosTicketSettingsPayload>(
      key: K,
      value: PosTicketSettingsPayload[K],
    ) => {
      setDraftForm((current) => ({
        ...(current ?? synchronizedForm),
        [key]: value,
      }));
    },
    [synchronizedForm],
  );

  const save = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    const action = async () => {
      const saved = await posManagementApi.saveTicketSettings(
        warehouseId,
        form,
      );
      setDraftForm(toPayload(saved));
      await onChanged();
      setDraftForm(null);
    };
    const promise = action();
    gooeyToast.promise(promise, {
      loading: copy.saveLoading,
      success: copy.saveSuccess,
      error: copy.saveError,
      description: {
        success: copy.saveSuccessDescription,
        error: copy.saveErrorDescription,
      },
      action: {
        error: {
          label: copy.retry,
          onClick: () => {
            void save();
          },
        },
      },
    });
    try {
      await promise;
    } catch (error) {
      console.error(
        "[PosTicketSettingsPanel] Không thể lưu cấu hình vé:",
        error,
      );
    } finally {
      setSaving(false);
    }
  }, [copy, form, onChanged, saving, warehouseId]);

  const handleLogoFile = useCallback(
    (file: File) => {
      if (
        !(["image/png", "image/jpeg", "image/webp"] as string[]).includes(
          file.type,
        )
      ) {
        gooeyToast.error(copy.logoInvalid, {
          description: copy.logoInvalidDescription,
        });
        return;
      }
      if (file.size > 600 * 1024) {
        gooeyToast.error(copy.logoTooLarge, {
          description: copy.logoTooLargeDescription,
        });
        return;
      }
      const reader = new FileReader();
      reader.addEventListener("load", () => {
        if (typeof reader.result !== "string") return;
        setDraftForm((current) => ({
          ...(current ?? synchronizedForm),
          logo_data_url: reader.result as string,
          show_logo: true,
        }));
        gooeyToast.success(copy.logoReady, {
          description: copy.logoReadyDescription,
        });
      });
      reader.addEventListener("error", () =>
        gooeyToast.error(copy.logoReadError, {
          description: copy.logoReadErrorDescription,
        }),
      );
      reader.readAsDataURL(file);
    },
    [copy, synchronizedForm],
  );

  return (
    <div className="space-y-4 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-slate-900">
            {copy.panelTitle}
          </h2>
          <p className="text-xs text-slate-500">
            {copy.panelHint} · {copy.version} {settings?.version ?? 0}
          </p>
        </div>
        {canManage && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setDraftForm(createDefaultPosTicketSettings(storeName))
              }
              disabled={saving}
              className="flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              <RotateCcw size={14} />
              {copy.reset}
            </button>
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving}
              className="flex h-9 items-center gap-2 rounded-lg bg-amber-500 px-3 text-xs font-bold text-white hover:bg-amber-600 disabled:opacity-50"
            >
              <Save size={14} />
              {saving ? copy.saving : copy.save}
            </button>
          </div>
        )}
      </div>
      <fieldset
        disabled={!canManage || saving}
        className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_430px]"
      >
        <div className="space-y-4">
          <PosTicketPaperSection form={form} update={update} />
          <PosTicketBrandSection
            form={form}
            update={update}
            onLogoFile={handleLogoFile}
          />
          <PosTicketContentSection form={form} update={update} />
          <PosTicketTypographySection form={form} update={update} />
          <PosTicketDisplaySection form={form} update={update} />
        </div>
        <PosTicketPreview form={form} />
      </fieldset>
    </div>
  );
}
