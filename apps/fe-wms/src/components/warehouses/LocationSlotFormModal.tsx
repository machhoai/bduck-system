"use client";

import { useEffect, useState } from "react";
import type React from "react";
import { Loader2, X } from "lucide-react";
import { gooeyToast } from "goey-toast";
import type {
  WarehouseLocation,
  WarehouseLocationSlot,
} from "@bduck/shared-types";
import { useTranslation } from "@/lib/i18n";

interface LocationSlotFormModalProps {
  isOpen: boolean;
  location: WarehouseLocation | null;
  slot?: WarehouseLocationSlot | null;
  defaultSortOrder: number;
  onClose: () => void;
  onSave: (payload: unknown) => Promise<unknown>;
}

const initialForm = {
  name: "",
  code: "",
  sort_order: "1",
  description: "",
  is_active: true,
};

export function LocationSlotFormModal({
  isOpen,
  location,
  slot,
  defaultSortOrder,
  onClose,
  onSave,
}: LocationSlotFormModalProps) {
  const { t } = useTranslation();
  const isEdit = Boolean(slot);
  const [formData, setFormData] = useState(initialForm);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    if (slot) {
      setFormData({
        name: slot.name,
        code: slot.code,
        sort_order: String(slot.sort_order),
        description: slot.description ?? "",
        is_active: slot.is_active,
      });
      return;
    }

    setFormData({
      ...initialForm,
      sort_order: String(defaultSortOrder),
    });
  }, [defaultSortOrder, isOpen, slot]);

  if (!isOpen || !location) return null;

  const saveAction = async () => {
    setIsSubmitting(true);
    try {
      const editablePayload = {
        name: formData.name.trim(),
        code: formData.code.trim(),
        sort_order: Number(formData.sort_order),
        description: formData.description.trim() || null,
        is_active: formData.is_active,
      };

      await onSave(
        isEdit
          ? editablePayload
          : {
              ...editablePayload,
              warehouse_id: location.warehouse_id,
              warehouse_location_id: location.id,
            },
      );
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    void gooeyToast.promise(saveAction(), {
      loading: t.warehouses.slotSaving,
      success: t.warehouses.slotSaveSuccess,
      error: (error: unknown) =>
        error instanceof Error ? error.message : t.warehouses.slotSaveError,
      description: {
        success: t.warehouses.slotSaveSuccess,
        error: t.warehouses.slotSaveError,
      },
      action: {
        error: {
          label: t.common.retry,
          onClick: () => void saveAction(),
        },
      },
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-3 pb-3 pt-16 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="flex max-h-[92vh] w-[90%] max-w-2xl flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)]">
        <div className="flex items-center justify-between border-b border-[var(--color-border-soft)] px-5 py-4">
          <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
            {isEdit ? t.warehouses.editSlot : t.warehouses.addSlot}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-[var(--color-text-muted)] transition-all hover:bg-[var(--color-surface-card)] hover:text-[var(--color-text-primary)] active:scale-95"
          >
            <X size={18} />
          </button>
        </div>

        <form
          id="slotForm"
          onSubmit={handleSubmit}
          className="flex-1 space-y-4 overflow-y-auto p-5"
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label={t.warehouses.slotName} required>
              <input
                required
                maxLength={120}
                value={formData.name}
                onChange={(event) =>
                  setFormData({ ...formData, name: event.target.value })
                }
                className="h-8 w-full rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] px-4 text-sm outline-none focus:border-[var(--color-border-focus)]"
              />
            </Field>
            <Field label={t.warehouses.slotCode} required>
              <input
                required
                maxLength={80}
                value={formData.code}
                onChange={(event) =>
                  setFormData({ ...formData, code: event.target.value })
                }
                className="h-8 w-full rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] px-4 text-sm outline-none focus:border-[var(--color-border-focus)]"
              />
            </Field>
            <Field label={t.warehouses.slotSortOrder} required>
              <input
                required
                type="number"
                min={0}
                value={formData.sort_order}
                onChange={(event) =>
                  setFormData({ ...formData, sort_order: event.target.value })
                }
                className="h-8 w-full rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] px-4 text-sm outline-none focus:border-[var(--color-border-focus)]"
              />
            </Field>
            <label className="flex items-end gap-2 pb-1 text-sm text-[var(--color-text-secondary)]">
              <input
                type="checkbox"
                checked={formData.is_active}
                onChange={(event) =>
                  setFormData({ ...formData, is_active: event.target.checked })
                }
                className="h-4 w-4 rounded border-[var(--color-border-subtle)]"
              />
              {t.warehouses.slotActive}
            </label>
          </div>

          <Field label={t.warehouses.slotDescription}>
            <textarea
              rows={3}
              maxLength={500}
              value={formData.description}
              onChange={(event) =>
                setFormData({ ...formData, description: event.target.value })
              }
              className="w-full resize-none rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] px-3 py-2 text-sm outline-none focus:border-[var(--color-border-focus)]"
            />
          </Field>
        </form>

        <div className="flex justify-end gap-3 border-t border-[var(--color-border-soft)] bg-[var(--color-surface-card)] px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="h-8 rounded-full border border-[var(--color-border-subtle)] bg-white px-4 text-sm font-normal text-[var(--color-text-secondary)] transition-all hover:bg-[var(--color-surface-card)] active:scale-95 disabled:opacity-50"
          >
            {t.common.cancel}
          </button>
          <button
            type="submit"
            form="slotForm"
            disabled={isSubmitting}
            className="inline-flex h-8 items-center justify-center gap-2 rounded-full bg-[var(--color-brand-primary)] px-5 text-sm font-normal text-white transition-all hover:bg-[var(--color-brand-primary-hover)] active:scale-95 disabled:opacity-50"
          >
            {isSubmitting && <Loader2 size={16} className="animate-spin" />}
            {t.common.save}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-normal text-[var(--color-text-secondary)]">
        {label}
        {required && (
          <span className="text-[var(--color-accent-error)]"> *</span>
        )}
      </span>
      {children}
    </label>
  );
}
