"use client";

import type { Organization, User, Warehouse } from "@bduck/shared-types";
import type React from "react";

import { WarehouseFormGeneralSection } from "./WarehouseFormGeneralSection";
import { WarehouseFormLocationSection } from "./WarehouseFormLocationSection";
import { WarehouseFormMediaSection } from "./WarehouseFormMediaSection";
import type { WarehouseFormValues } from "./types";
import { PartnerWarehouseMappingField } from "../PartnerWarehouseMappingField";
import type { Dictionary } from "@/lib/i18n";

interface WarehouseFormFieldsProps {
  formData: WarehouseFormValues;
  setFormData: React.Dispatch<React.SetStateAction<WarehouseFormValues>>;
  organizations: Organization[];
  organizationsLoading: boolean;
  organizationsError: string | null;
  managerOptions: User[];
  usersLoading: boolean;
  usersError: string | null;
  selectedImage: File | null;
  isSubmitting: boolean;
  onImageChange: (file: File) => void;
  warehouse?: Warehouse | null;
  t: Dictionary;
}

export function WarehouseFormFields({
  formData,
  setFormData,
  organizations,
  organizationsLoading,
  organizationsError,
  managerOptions,
  usersLoading,
  usersError,
  selectedImage,
  isSubmitting,
  onImageChange,
  warehouse,
  t,
}: WarehouseFormFieldsProps) {
  return (
    <>
      <WarehouseFormGeneralSection
        formData={formData}
        setFormData={setFormData}
        organizations={organizations}
        organizationsLoading={organizationsLoading}
        organizationsError={organizationsError}
        t={t}
      />

      <WarehouseFormLocationSection
        formData={formData}
        setFormData={setFormData}
        managerOptions={managerOptions}
        usersLoading={usersLoading}
        usersError={usersError}
        t={t}
      />

      <WarehouseFormMediaSection
        formData={formData}
        setFormData={setFormData}
        selectedImage={selectedImage}
        isSubmitting={isSubmitting}
        onImageChange={onImageChange}
        t={t}
      />

      {warehouse && (
        <PartnerWarehouseMappingField warehouseId={warehouse.id} />
      )}
    </>
  );
}
