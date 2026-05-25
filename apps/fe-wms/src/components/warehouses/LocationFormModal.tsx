"use client";

import { useEffect, useState } from "react";
import type React from "react";
import { Loader2, X } from "lucide-react";
import { gooeyToast } from "goey-toast";
import { LocationStatus, LocationType } from "@bduck/shared-types";
import type { WarehouseLocation } from "@bduck/shared-types";
import { useTranslation } from "@/lib/i18n";

interface LocationFormModalProps {
    isOpen: boolean;
    warehouseId: string;
    location?: WarehouseLocation | null;
    onClose: () => void;
    onSave: (payload: unknown) => Promise<unknown>;
}

const initialForm = {
    name: "",
    code: "",
    type: LocationType.SHELF,
    status: LocationStatus.ACTIVE,
    warehouse_location_description: "",
    warehouse_location_image_url: "",
};

export function LocationFormModal({
    isOpen,
    warehouseId,
    location,
    onClose,
    onSave,
}: LocationFormModalProps) {
    const { t } = useTranslation();
    const isEdit = Boolean(location);
    const [formData, setFormData] = useState(initialForm);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (!isOpen) return;

        if (location) {
            setFormData({
                name: location.name,
                code: location.code,
                type: location.type,
                status: location.status,
                warehouse_location_description:
                    location.warehouse_location_description || "",
                warehouse_location_image_url:
                    location.warehouse_location_image_url || "",
            });
            return;
        }

        setFormData(initialForm);
    }, [location, isOpen]);

    if (!isOpen) return null;

    const saveAction = async () => {
        setIsSubmitting(true);
        try {
            await onSave({
                warehouse_id: warehouseId,
                name: formData.name,
                code: formData.code,
                type: formData.type,
                status: formData.status,
                warehouse_location_description:
                    formData.warehouse_location_description || null,
                warehouse_location_image_url:
                    formData.warehouse_location_image_url || null,
            });
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
                        {isEdit ? t.warehouses.editLocation : t.warehouses.addLocation}
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
                    id="locationForm"
                    onSubmit={handleSubmit}
                    className="flex-1 space-y-4 overflow-y-auto p-5"
                >
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
                        <Field label={t.warehouses.locationName} required>
                            <input
                                required
                                value={formData.name}
                                onChange={(event) =>
                                    setFormData({ ...formData, name: event.target.value })
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
                                        type: event.target.value as LocationType,
                                    })
                                }
                                className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            >
                                {Object.values(LocationType).map((type) => (
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
                                        status: event.target.value as LocationStatus,
                                    })
                                }
                                className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            >
                                {Object.values(LocationStatus).map((status) => (
                                    <option key={status} value={status}>
                                        {t.warehouses.statuses[status]}
                                    </option>
                                ))}
                            </select>
                        </Field>
                    </div>

                    <Field label={t.warehouses.imageUrl}>
                        <input
                            type="url"
                            value={formData.warehouse_location_image_url}
                            onChange={(event) =>
                                setFormData({
                                    ...formData,
                                    warehouse_location_image_url: event.target.value,
                                })
                            }
                            className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        />
                    </Field>
                    <Field label={t.warehouses.descriptionField}>
                        <textarea
                            rows={3}
                            value={formData.warehouse_location_description}
                            onChange={(event) =>
                                setFormData({
                                    ...formData,
                                    warehouse_location_description: event.target.value,
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
                        form="locationForm"
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
