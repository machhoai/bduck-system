"use client";

import { ActiveStatus, UserStatus, WarehouseType } from "@bduck/shared-types";
import type { Warehouse } from "@bduck/shared-types";
import { gooeyToast } from "goey-toast";
import { Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type React from "react";

import { WarehouseFormFields } from "./form/WarehouseFormFields";
import type { WarehouseFormValues } from "./form/types";
import { WarehouseInfoReadonlyView } from "./info/WarehouseInfoReadonlyView";

import { BottomSheet } from "@/components/ui/BottomSheet";
import { useOrganizations } from "@/hooks/useOrganizations";
import { useUsers } from "@/hooks/useUsers";
import { uploadImageAsWebp } from "@/lib/firebaseStorage";
import { useTranslation } from "@/lib/i18n";

interface WarehouseInfoSheetProps {
  isOpen: boolean;
  warehouse: Warehouse;
  managerName: string;
  onClose: () => void;
  onSave: (payload: unknown) => Promise<unknown>;
  canEdit: boolean;
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

export function WarehouseInfoSheet({
  isOpen,
  warehouse,
  managerName,
  onClose,
  onSave,
  canEdit,
}: WarehouseInfoSheetProps) {
  const { t } = useTranslation();
  const {
    organizations,
    loading: organizationsLoading,
    error: organizationsError,
  } = useOrganizations();
  const { users, isLoading: usersLoading, error: usersError } = useUsers();

  const [isEditing, setIsEditing] = useState(false);
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
    setIsEditing(false);
  }, [warehouse, isOpen]);

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
      setIsEditing(false);
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

  return (
    <BottomSheet
      title={isEditing ? t.warehouses.editWarehouse : (t.warehouses.openDetail || "Chi tiết cơ sở")}
      isOpen={isOpen}
      onClose={onClose}
      defaultSnap="full"
    >
      {!isEditing ? (
        <WarehouseInfoReadonlyView
          warehouse={warehouse}
          managerName={managerName}
          canEdit={canEdit}
          onEdit={() => setIsEditing(true)}
          t={t}
        />
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3.5 pb-20 pt-1">
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

          <div className="flex items-center gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              disabled={isSubmitting}
              className="flex-1 h-8 rounded-lg border border-[var(--color-border-subtle)] bg-white text-xs font-medium text-[var(--color-text-secondary)] transition-all hover:bg-[var(--color-surface-card)] active:scale-95 disabled:opacity-50"
            >
              {t.common.cancel}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-[var(--color-brand-primary)] text-xs font-medium text-white shadow-xs transition-all hover:bg-[var(--color-brand-primary-hover)] active:scale-95 disabled:opacity-50"
            >
              {isSubmitting && <Loader2 size={13} className="animate-spin" />}
              {t.common.save}
            </button>
          </div>
        </form>
      )}
    </BottomSheet>
  );
}
