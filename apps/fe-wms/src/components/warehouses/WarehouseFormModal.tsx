"use client";

import { ActiveStatus, UserStatus, WarehouseType } from "@bduck/shared-types";
import type { Warehouse } from "@bduck/shared-types";
import { gooeyToast } from "goey-toast";
import { Loader2, Warehouse as WarehouseIcon, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type React from "react";

import { WarehouseFormFields } from "./form/WarehouseFormFields";
import type { WarehouseFormValues } from "./form/types";

import { BottomSheet } from "@/components/ui/BottomSheet";
import { useOrganizations } from "@/hooks/useOrganizations";
import { useUsers } from "@/hooks/useUsers";
import { uploadImageAsWebp } from "@/lib/firebaseStorage";
import { useTranslation } from "@/lib/i18n";

interface WarehouseFormModalProps {
  isOpen: boolean;
  warehouse?: Warehouse | null;
  onClose: () => void;
  onSave: (payload: unknown) => Promise<unknown>;
}

const initialForm: WarehouseFormValues = {
  organization_id: "",
  name: "",
  code: "",
  type: WarehouseType.MAIN,
  status: ActiveStatus.ACTIVE,
  address: "",
  manager_id: "",
  warehouse_description: "",
  warehouse_image_url: "",
  longitude: "",
  latitude: "",
};

const MAX_IMAGE_SIZE = 20 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function WarehouseFormModal({
  isOpen,
  warehouse,
  onClose,
  onSave,
}: WarehouseFormModalProps) {
  const { t } = useTranslation();
  const {
    organizations,
    loading: organizationsLoading,
    error: organizationsError,
  } = useOrganizations();
  const { users, isLoading: usersLoading, error: usersError } = useUsers();
  const isEdit = Boolean(warehouse);
  const [formData, setFormData] = useState<WarehouseFormValues>(initialForm);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const managerOptions = useMemo(
    () =>
      users
        .filter(
          (user) =>
            user.status === UserStatus.ACTIVE ||
            user.id === formData.manager_id,
        )
        .sort((a, b) => a.full_name.localeCompare(b.full_name, "vi")),
    [formData.manager_id, users],
  );

  useEffect(() => {
    if (!isOpen) return;

    if (warehouse) {
      setFormData({
        organization_id: warehouse.organization_id,
        name: warehouse.name,
        code: warehouse.code,
        type: warehouse.type,
        status: warehouse.status,
        address: warehouse.address || "",
        manager_id: warehouse.manager_id || "",
        warehouse_description: warehouse.warehouse_description || "",
        warehouse_image_url: warehouse.warehouse_image_url || "",
        longitude: warehouse.coordinate?.longitude?.toString() || "",
        latitude: warehouse.coordinate?.latitude?.toString() || "",
      });
      setSelectedImage(null);
      return;
    }

    setFormData(initialForm);
    setSelectedImage(null);
  }, [warehouse, isOpen]);

  useEffect(() => {
    if (!isOpen || warehouse || formData.organization_id) return;
    if (organizations.length === 1) {
      setFormData((current) => ({
        ...current,
        organization_id: organizations[0].id,
      }));
    }
  }, [formData.organization_id, isOpen, organizations, warehouse]);

  if (!isOpen) return null;

  const saveAction = async () => {
    const managerId = formData.manager_id.trim() || null;

    setIsSubmitting(true);
    try {
      const hasCoordinate =
        formData.longitude !== "" && formData.latitude !== "";
      let imageUrl = formData.warehouse_image_url || null;
      if (selectedImage) {
        imageUrl = await uploadImageAsWebp(selectedImage, "warehouses");
      }

      const payload = {
        organization_id: formData.organization_id,
        name: formData.name,
        code: formData.code,
        type: formData.type,
        status: formData.status,
        address: formData.address || null,
        manager_id: managerId,
        warehouse_description: formData.warehouse_description || null,
        warehouse_image_url: imageUrl,
        coordinate: hasCoordinate
          ? {
              longitude: Number(formData.longitude),
              latitude: Number(formData.latitude),
            }
          : null,
      };

      await onSave(payload);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    void gooeyToast.promise(saveAction(), {
      loading: t.warehouses.saving,
      success: t.warehouses.saveSuccess,
      error: (error: unknown) =>
        error instanceof Error ? error.message : t.warehouses.saveError,
      description: {
        success: t.warehouses.saveSuccess,
        error: t.warehouses.saveError,
      },
      action: {
        error: {
          label: t.common.retry,
          onClick: () => void saveAction(),
        },
      },
    });
  };

  const handleImageChange = (file: File) => {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      gooeyToast.error(t.warehouses.invalidImage, {
        description: t.warehouses.invalidImageDescription,
        preset: "snappy",
        timing: { displayDuration: 6000 },
      });
      return;
    }

    if (file.size > MAX_IMAGE_SIZE) {
      gooeyToast.error(t.warehouses.imageTooLarge, {
        description: t.warehouses.imageTooLargeDescription,
        preset: "snappy",
        timing: { displayDuration: 6000 },
      });
      return;
    }

    setSelectedImage(file);
  };

  const title = isEdit ? t.warehouses.editWarehouse : t.warehouses.addNew;

  const formContent = (
    <WarehouseFormFields
      formData={formData}
      setFormData={setFormData}
      organizations={organizations}
      organizationsLoading={organizationsLoading}
      organizationsError={organizationsError}
      managerOptions={managerOptions}
      usersLoading={usersLoading}
      usersError={usersError}
      selectedImage={selectedImage}
      isSubmitting={isSubmitting}
      onImageChange={handleImageChange}
      warehouse={warehouse}
      t={t}
    />
  );

  return (
    <>
      {/* Desktop Modal (>= md) */}
      <div className="fixed inset-0 z-50 hidden items-center justify-center bg-black/40 p-4 backdrop-blur-sm md:flex">
        <div className="relative flex max-h-[90vh] w-[90%] max-w-[760px] flex-col overflow-hidden rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] shadow-2xl transition-all">
          {/* Modal Header */}
          <div className="flex items-center justify-between border-b border-[var(--color-border-soft)] bg-white px-5 py-3.5">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--color-brand-primary-muted)] text-[var(--color-brand-primary)]">
                <WarehouseIcon size={18} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
                    {title}
                  </h2>
                  {isEdit && (
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xxs font-medium ${
                        formData.status === ActiveStatus.ACTIVE
                          ? "bg-[var(--color-success-bg)] text-[var(--color-success-text)] border border-[var(--color-success-border)]"
                          : "bg-[var(--color-neutral-100)] text-[var(--color-neutral-600)] border border-[var(--color-neutral-200)]"
                      }`}
                    >
                      {t.warehouses.statuses[formData.status]}
                    </span>
                  )}
                </div>
                <p className="text-xs text-[var(--color-text-muted)]">
                  {isEdit
                    ? `${formData.name || formData.code || ""} · ${t.warehouses.types[formData.type]}`
                    : t.warehouses.description}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label={t.common.cancel}
              className="rounded-full p-2 text-[var(--color-text-muted)] transition-all hover:bg-[var(--color-surface-card)] hover:text-[var(--color-text-primary)] active:scale-95"
            >
              <X size={18} />
            </button>
          </div>

          {/* Modal Body Form */}
          <form
            id="warehouseFormDesktop"
            onSubmit={handleSubmit}
            className="no-scrollbar flex-1 space-y-3.5 overflow-y-auto p-4 sm:p-5"
          >
            {formContent}
          </form>

          {/* Modal Sticky Footer */}
          <div className="flex items-center justify-end gap-3 border-t border-[var(--color-border-soft)] bg-[var(--color-surface-card)] px-5 py-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="h-8 rounded-lg border border-[var(--color-border-subtle)] bg-white px-4 text-sm font-medium text-[var(--color-text-secondary)] transition-all hover:bg-[var(--color-surface-card)] active:scale-95 disabled:opacity-50"
            >
              {t.common.cancel}
            </button>
            <button
              type="submit"
              form="warehouseFormDesktop"
              disabled={isSubmitting}
              className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-[var(--color-brand-primary)] px-5 text-sm font-medium text-white shadow-sm transition-all hover:bg-[var(--color-brand-primary-hover)] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting && <Loader2 size={15} className="animate-spin" />}
              {t.common.save}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Native BottomSheet (< md) */}
      <BottomSheet
        title={title}
        isOpen={isOpen}
        onClose={onClose}
        defaultSnap="full"
        zIndex={50}
        contentClassName="flex flex-col overflow-y-auto overscroll-contain px-4 pb-6"
      >
        <form
          id="warehouseFormMobile"
          onSubmit={handleSubmit}
          className="flex flex-col gap-3.5 pt-2 pb-2"
        >
          {formContent}

          {/* Sticky Mobile Action Buttons at Bottom of Sheet */}
          <div className="sticky bottom-0 -mx-4 -mb-6 mt-4 flex items-center justify-end gap-3 border-t border-[var(--color-border-soft)] bg-[var(--color-surface-elevated)]/95 px-4 py-3 backdrop-blur-sm">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 h-8 rounded-lg border border-[var(--color-border-subtle)] bg-white px-4 text-xs font-medium text-[var(--color-text-secondary)] transition-all active:scale-95 disabled:opacity-50"
            >
              {t.common.cancel}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-[var(--color-brand-primary)] px-5 text-xs font-medium text-white shadow-xs transition-all active:scale-95 disabled:opacity-50"
            >
              {isSubmitting && <Loader2 size={13} className="animate-spin" />}
              {t.common.save}
            </button>
          </div>
        </form>
      </BottomSheet>
    </>
  );
}
