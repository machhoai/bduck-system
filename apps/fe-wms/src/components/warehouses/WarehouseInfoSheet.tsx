"use client";

import { useEffect, useMemo, useState } from "react";
import type React from "react";
import { Loader2, X, MapPin, User, Building, FileText, Settings, Pencil } from "lucide-react";
import { gooeyToast } from "goey-toast";
import { ActiveStatus, UserStatus, WarehouseType } from "@bduck/shared-types";
import type { Warehouse } from "@bduck/shared-types";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { ImageUploadField } from "@/components/shared/ImageUploadField";
import { useOrganizations } from "@/hooks/useOrganizations";
import { useUsers } from "@/hooks/useUsers";
import { uploadImageAsWebp } from "@/lib/firebaseStorage";
import { useTranslation } from "@/lib/i18n";
import { WarehouseManagerSelect } from "./WarehouseManagerSelect";

interface WarehouseInfoSheetProps {
    isOpen: boolean;
    warehouse: Warehouse;
    managerName: string;
    onClose: () => void;
    onSave: (payload: unknown) => Promise<unknown>;
    canEdit: boolean;
}

const initialForm = {
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
    const [formData, setFormData] = useState(initialForm);
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

    // Sync form data on open or when warehouse changes
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
            title={isEditing ? t.warehouses.editWarehouse : t.warehouses.overview}
            isOpen={isOpen}
            onClose={onClose}
            defaultSnap="full"
        >
            {!isEditing ? (
                /* Read-only View */
                <div className="flex flex-col gap-5 py-3 pb-20">
                    {/* Image Header */}
                    {warehouse.warehouse_image_url ? (
                        <div className="relative h-44 w-full overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-pearl)]">
                            <img
                                src={warehouse.warehouse_image_url}
                                alt={warehouse.name}
                                className="h-full w-full object-cover"
                            />
                        </div>
                    ) : (
                        <div className="flex h-32 w-full flex-col items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border-subtle)] bg-[var(--color-surface-pearl)] text-slate-400">
                            <Building size={32} strokeWidth={1.5} />
                            <span className="mt-1.5 text-xs text-[var(--color-text-muted)]">
                                {t.warehouses.image || "Chưa có ảnh kho"}
                            </span>
                        </div>
                    )}

                    {/* Modern High-Density Grid Cards */}
                    <div className="grid grid-cols-2 gap-2">
                        {/* Name - Span 2 */}
                        <div className="col-span-2 rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] p-2.5">
                            <div className="flex items-center gap-1.5">
                                <Building size={14} className="text-[var(--color-brand-primary)] shrink-0" />
                                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
                                    {t.warehouses.name}
                                </span>
                            </div>
                            <p className="mt-1 text-xs font-bold text-[var(--color-text-primary)]">
                                {warehouse.name}
                            </p>
                        </div>

                        {/* Code */}
                        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] p-2.5">
                            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide block">
                                {t.warehouses.code}
                            </span>
                            <span className="mt-1 inline-block rounded-full bg-blue-50 border border-blue-100 px-2 py-0.5 text-[10px] font-bold text-[var(--color-brand-primary)]">
                                {warehouse.code}
                            </span>
                        </div>

                        {/* Manager */}
                        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] p-2.5">
                            <div className="flex items-center gap-1">
                                <User size={12} className="text-slate-400 shrink-0" />
                                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
                                    {t.warehouses.managerId}
                                </span>
                            </div>
                            <p className="mt-1 text-xs font-bold text-[var(--color-text-primary)] truncate">
                                {managerName}
                            </p>
                        </div>

                        {/* Type */}
                        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] p-2.5">
                            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide block">
                                {t.warehouses.type}
                            </span>
                            <span className="mt-1 inline-block rounded-full bg-slate-100 border border-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                                {t.warehouses.types[warehouse.type]}
                            </span>
                        </div>

                        {/* Status */}
                        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] p-2.5">
                            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide block">
                                {t.warehouses.status}
                            </span>
                            <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold border ${
                                warehouse.status === ActiveStatus.ACTIVE
                                    ? "bg-emerald-50 border-emerald-100 text-emerald-700"
                                    : "bg-rose-50 border-rose-100 text-rose-700"
                            }`}>
                                {t.warehouses.statuses[warehouse.status]}
                            </span>
                        </div>

                        {/* Address - Span 2 */}
                        {warehouse.address && (
                            <div className="col-span-2 rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] p-2.5">
                                <div className="flex items-center gap-1.5">
                                    <MapPin size={12} className="text-slate-400 shrink-0" />
                                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
                                        {t.warehouses.address}
                                    </span>
                                </div>
                                <p className="mt-1 text-xs font-semibold text-[var(--color-text-primary)] break-words">
                                    {warehouse.address}
                                </p>
                            </div>
                        )}

                        {/* Coordinates - Span 2 */}
                        {warehouse.coordinate && (
                            <div className="col-span-2 rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] p-2.5">
                                <div className="flex items-center gap-1.5">
                                    <MapPin size={12} className="text-slate-400 shrink-0" />
                                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
                                        Tọa độ GPS
                                    </span>
                                </div>
                                <p className="mt-1 text-xs font-semibold text-[var(--color-text-primary)]">
                                    {warehouse.coordinate.latitude}, {warehouse.coordinate.longitude}
                                </p>
                            </div>
                        )}

                        {/* Description - Span 2 */}
                        {warehouse.warehouse_description && (
                            <div className="col-span-2 rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] p-2.5">
                                <div className="flex items-center gap-1.5">
                                    <FileText size={12} className="text-slate-400 shrink-0" />
                                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
                                        {t.warehouses.descriptionField}
                                    </span>
                                </div>
                                <p className="mt-1 text-xs text-[var(--color-text-secondary)] whitespace-pre-line leading-relaxed">
                                    {warehouse.warehouse_description}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Edit Trigger Button */}
                    {canEdit && (
                        <button
                            type="button"
                            onClick={() => setIsEditing(true)}
                            className="mt-2 w-full h-8 rounded-full bg-[var(--color-brand-primary)] text-white text-xs font-bold shadow-md hover:bg-[var(--color-brand-primary-hover)] active:scale-95 transition-all duration-150 flex items-center justify-center gap-1.5"
                        >
                            <Pencil size={12} />
                            Chỉnh sửa thông tin
                        </button>
                    )}
                </div>
            ) : (
                /* Editing Form View */
                <form onSubmit={handleSubmit} className="flex flex-col gap-4 py-3 pb-20">
                    <div className="grid grid-cols-1 gap-4">
                        <Field label={t.warehouses.organizationId} required>
                            <select
                                required
                                value={formData.organization_id}
                                disabled={organizationsLoading || organizations.length === 0}
                                onChange={(event) =>
                                    setFormData({
                                        ...formData,
                                        organization_id: event.target.value,
                                    })
                                }
                                className="h-8 w-full rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] px-4 text-xs outline-none focus:border-[var(--color-border-focus)]"
                            >
                                <option value="">
                                    {organizationsLoading
                                        ? t.common.loading
                                        : t.warehouses.selectOrganization}
                                </option>
                                {organizations.map((organization) => (
                                    <option key={organization.id} value={organization.id}>
                                        {organization.name} ({organization.code})
                                    </option>
                                ))}
                            </select>
                            {(organizationsError || organizations.length === 0) &&
                                !organizationsLoading && (
                                    <p className="mt-1.5 text-xs text-[var(--color-accent-error)]">
                                        {organizationsError || t.warehouses.noOrganizations}
                                    </p>
                                )}
                        </Field>

                        <Field label={t.warehouses.code} required>
                            <input
                                required
                                value={formData.code}
                                onChange={(event) =>
                                    setFormData({ ...formData, code: event.target.value })
                                }
                                className="h-8 w-full rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] px-4 text-xs outline-none focus:border-[var(--color-border-focus)]"
                            />
                        </Field>

                        <Field label={t.warehouses.name} required>
                            <input
                                required
                                value={formData.name}
                                onChange={(event) =>
                                    setFormData({ ...formData, name: event.target.value })
                                }
                                className="h-8 w-full rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] px-4 text-xs outline-none focus:border-[var(--color-border-focus)]"
                            />
                        </Field>

                        <Field label={t.warehouses.managerId}>
                            <WarehouseManagerSelect
                                users={managerOptions}
                                value={formData.manager_id}
                                loading={usersLoading}
                                error={usersError}
                                disabled={usersLoading}
                                onChange={(managerId) =>
                                    setFormData({ ...formData, manager_id: managerId })
                                }
                            />
                        </Field>

                        <Field label={t.warehouses.type} required>
                            <select
                                value={formData.type}
                                onChange={(event) =>
                                    setFormData({
                                        ...formData,
                                        type: event.target.value as WarehouseType,
                                    })
                                }
                                className="h-8 w-full rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] px-4 text-xs outline-none focus:border-[var(--color-border-focus)]"
                            >
                                {Object.values(WarehouseType).map((type) => (
                                    <option key={type} value={type}>
                                        {t.warehouses.types[type]}
                                    </option>
                                ))}
                            </select>
                        </Field>

                        <Field label={t.warehouses.status} required>
                            <select
                                value={formData.status}
                                onChange={(event) =>
                                    setFormData({
                                        ...formData,
                                        status: event.target.value as ActiveStatus,
                                    })
                                }
                                className="h-8 w-full rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] px-4 text-xs outline-none focus:border-[var(--color-border-focus)]"
                            >
                                {Object.values(ActiveStatus).map((status) => (
                                    <option key={status} value={status}>
                                        {t.warehouses.statuses[status]}
                                    </option>
                                ))}
                            </select>
                        </Field>

                        <div className="grid grid-cols-2 gap-3">
                            <Field label={t.warehouses.longitude}>
                                <input
                                    type="number"
                                    step="any"
                                    value={formData.longitude}
                                    onChange={(event) =>
                                        setFormData({ ...formData, longitude: event.target.value })
                                    }
                                    className="h-8 w-full rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] px-4 text-xs outline-none focus:border-[var(--color-border-focus)]"
                                />
                            </Field>
                            <Field label={t.warehouses.latitude}>
                                <input
                                    type="number"
                                    step="any"
                                    value={formData.latitude}
                                    onChange={(event) =>
                                        setFormData({ ...formData, latitude: event.target.value })
                                    }
                                    className="h-8 w-full rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] px-4 text-xs outline-none focus:border-[var(--color-border-focus)]"
                                />
                            </Field>
                        </div>

                        <Field label={t.warehouses.address}>
                            <input
                                value={formData.address}
                                onChange={(event) =>
                                    setFormData({ ...formData, address: event.target.value })
                                }
                                className="h-8 w-full rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] px-4 text-xs outline-none focus:border-[var(--color-border-focus)]"
                            />
                        </Field>

                        <Field label={t.warehouses.image}>
                            <div className="w-[min(220px,100%)]">
                                <ImageUploadField
                                    inputId="warehouseImageUploadMobile"
                                    previewUrl={formData.warehouse_image_url}
                                    selectedFile={selectedImage}
                                    alt={formData.name || t.warehouses.image}
                                    buttonLabel={t.warehouses.uploadImage}
                                    disabled={isSubmitting}
                                    onFileChange={handleImageChange}
                                />
                            </div>
                        </Field>

                        <Field label={t.warehouses.descriptionField}>
                            <textarea
                                rows={3}
                                value={formData.warehouse_description}
                                onChange={(event) =>
                                    setFormData({
                                        ...formData,
                                        warehouse_description: event.target.value,
                                    })
                                }
                                className="w-full resize-none rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] px-3 py-2 text-xs outline-none focus:border-[var(--color-border-focus)]"
                            />
                        </Field>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-3 mt-4">
                        <button
                            type="button"
                            onClick={() => setIsEditing(false)}
                            disabled={isSubmitting}
                            className="flex-1 h-8 rounded-full border border-[var(--color-border-subtle)] bg-white text-xs font-semibold text-[var(--color-text-secondary)] transition-all active:scale-95 disabled:opacity-50"
                        >
                            {t.common.cancel}
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex-1 inline-flex h-8 items-center justify-center gap-1.5 rounded-full bg-[var(--color-brand-primary)] text-xs font-semibold text-white transition-all active:scale-95 disabled:opacity-50 shadow-sm"
                        >
                            {isSubmitting && <Loader2 size={12} className="animate-spin" />}
                            {t.common.save}
                        </button>
                    </div>
                </form>
            )}
        </BottomSheet>
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
            <span className="mb-1.5 block text-xs font-normal text-[var(--color-text-secondary)]">
                {label}
                {required && <span className="text-[var(--color-accent-error)]"> *</span>}
            </span>
            {children}
        </label>
    );
}
