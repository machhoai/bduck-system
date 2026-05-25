"use client";

import { useEffect, useState } from "react";
import type React from "react";
import { Loader2, X } from "lucide-react";
import { gooeyToast } from "goey-toast";
import { ActiveStatus, WarehouseType } from "@bduck/shared-types";
import type { Warehouse } from "@bduck/shared-types";
import { useOrganizations } from "@/hooks/useOrganizations";
import { useTranslation } from "@/lib/i18n";

interface WarehouseFormModalProps {
    isOpen: boolean;
    warehouse?: Warehouse | null;
    onClose: () => void;
    onSave: (payload: unknown) => Promise<unknown>;
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
    const isEdit = Boolean(warehouse);
    const [formData, setFormData] = useState(initialForm);
    const [isSubmitting, setIsSubmitting] = useState(false);

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
            return;
        }

        setFormData(initialForm);
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
        setIsSubmitting(true);
        try {
            const hasCoordinate =
                formData.longitude !== "" && formData.latitude !== "";
            const payload = {
                organization_id: formData.organization_id,
                name: formData.name,
                code: formData.code,
                type: formData.type,
                status: formData.status,
                address: formData.address || null,
                manager_id: formData.manager_id || null,
                warehouse_description: formData.warehouse_description || null,
                warehouse_image_url: formData.warehouse_image_url || null,
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

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-3 pb-3 pt-16 backdrop-blur-sm sm:items-center sm:p-4">
            <div className="flex max-h-[92vh] w-[90%] flex-col overflow-hidden rounded-lg bg-white shadow-xl">
                <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
                    <h2 className="text-lg font-semibold text-gray-950">
                        {isEdit ? t.warehouses.editWarehouse : t.warehouses.addNew}
                    </h2>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-md p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
                    >
                        <X size={18} />
                    </button>
                </div>

                <form
                    id="warehouseForm"
                    onSubmit={handleSubmit}
                    className="flex-1 space-y-4 overflow-y-auto p-5"
                >
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
                                className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
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
                                    <p className="mt-1.5 text-xs text-red-600">
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
                                className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            />
                        </Field>
                        <Field label={t.warehouses.name} required>
                            <input
                                required
                                value={formData.name}
                                onChange={(event) =>
                                    setFormData({ ...formData, name: event.target.value })
                                }
                                className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            />
                        </Field>
                        <Field label={t.warehouses.managerId}>
                            <input
                                value={formData.manager_id}
                                onChange={(event) =>
                                    setFormData({ ...formData, manager_id: event.target.value })
                                }
                                className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
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
                                className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
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
                                className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            >
                                {Object.values(ActiveStatus).map((status) => (
                                    <option key={status} value={status}>
                                        {t.warehouses.statuses[status]}
                                    </option>
                                ))}
                            </select>
                        </Field>
                        <Field label={t.warehouses.longitude}>
                            <input
                                type="number"
                                step="any"
                                value={formData.longitude}
                                onChange={(event) =>
                                    setFormData({ ...formData, longitude: event.target.value })
                                }
                                className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
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
                                className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            />
                        </Field>
                    </div>

                    <Field label={t.warehouses.address}>
                        <input
                            value={formData.address}
                            onChange={(event) =>
                                setFormData({ ...formData, address: event.target.value })
                            }
                            className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        />
                    </Field>
                    <Field label={t.warehouses.imageUrl}>
                        <input
                            type="url"
                            value={formData.warehouse_image_url}
                            onChange={(event) =>
                                setFormData({
                                    ...formData,
                                    warehouse_image_url: event.target.value,
                                })
                            }
                            className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        />
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
                            className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        />
                    </Field>
                </form>

                <div className="flex justify-end gap-3 border-t border-gray-100 bg-gray-50 px-5 py-4">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="h-10 rounded-lg border border-gray-300 bg-white px-4 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                        {t.common.cancel}
                    </button>
                    <button
                        type="submit"
                        form="warehouseForm"
                        disabled={isSubmitting}
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
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
            <span className="mb-1.5 block text-sm font-medium text-gray-700">
                {label}
                {required && <span className="text-red-500"> *</span>}
            </span>
            {children}
        </label>
    );
}
