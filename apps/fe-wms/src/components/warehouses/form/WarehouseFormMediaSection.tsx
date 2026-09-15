"use client";

import { ImageIcon } from "lucide-react";
import type React from "react";

import { WarehouseFormField } from "./WarehouseFormField";
import type { WarehouseFormValues } from "./types";
import { ImageUploadField } from "@/components/shared/ImageUploadField";
import type { Dictionary } from "@/lib/i18n";

interface WarehouseFormMediaSectionProps {
  formData: WarehouseFormValues;
  setFormData: React.Dispatch<React.SetStateAction<WarehouseFormValues>>;
  selectedImage: File | null;
  isSubmitting: boolean;
  onImageChange: (file: File) => void;
  t: Dictionary;
}

export function WarehouseFormMediaSection({
  formData,
  setFormData,
  selectedImage,
  isSubmitting,
  onImageChange,
  t,
}: WarehouseFormMediaSectionProps) {
  return (
    <div className="space-y-3 rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-surface-card)]/50 p-3.5 sm:p-4">
      <div className="flex items-center gap-2 border-b border-[var(--color-border-soft)] pb-2">
        <div className="flex h-5 w-5 items-center justify-center rounded-md bg-[var(--color-brand-primary-muted)] text-[var(--color-brand-primary)]">
          <ImageIcon size={13} />
        </div>
        <span className="text-xxs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
          {t.warehouses.image} & {t.warehouses.descriptionField}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-12">
        <div className="sm:col-span-5">
          <WarehouseFormField label={t.warehouses.image}>
            <ImageUploadField
              inputId="warehouseImageUpload"
              previewUrl={formData.warehouse_image_url}
              selectedFile={selectedImage}
              alt={formData.name || t.warehouses.image}
              buttonLabel={t.warehouses.uploadImage}
              disabled={isSubmitting}
              onFileChange={onImageChange}
            />
          </WarehouseFormField>
        </div>

        <div className="flex flex-col sm:col-span-7">
          <WarehouseFormField
            label={t.warehouses.descriptionField}
            className="flex flex-1 flex-col"
          >
            <textarea
              rows={4}
              value={formData.warehouse_description}
              placeholder="Thông tin ghi chú, hướng dẫn xuất nhập, hoặc đặc điểm cơ sở..."
              onChange={(event) =>
                setFormData((prev) => ({
                  ...prev,
                  warehouse_description: event.target.value,
                }))
              }
              className="w-full flex-1 resize-none rounded-lg border border-[var(--color-border-subtle)] bg-white p-2.5 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] outline-none transition-all focus:border-[var(--color-border-focus)] focus:ring-2 focus:ring-[var(--color-brand-primary)]/15"
            />
          </WarehouseFormField>
        </div>
      </div>
    </div>
  );
}
