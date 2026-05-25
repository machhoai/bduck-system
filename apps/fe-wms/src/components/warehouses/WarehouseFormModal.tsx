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

const UUID_REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
        const managerId = formData.manager_id.trim() || null;
        if (managerId && !UUID_REGEX.test(managerId)) {
            gooeyToast.error(t.warehouses.invalidManagerId, {
                description: t.warehouses.invalidManagerIdDescription,
                preset: "snappy",
                timing: { displayDuration: 6000 },
            });
            return;
        }

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
                manager_id: managerId,
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
            <div className="flex max-h-[92vh] w-[90%] flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)]">
                <div className="flex items-center justify-between border-b border-[var(--color-border-soft)] px-5 py-4">
                    <h2 className="text-[21px] font-semibold text-[var(--color-text-primary)]">
                        {isEdit ? t.warehouses.editWarehouse : t.warehouses.addNew}
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
                                className="h-11 w-full rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] px-4 text-sm outline-none focus:border-[var(--color-border-focus)]"
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
                                className="h-11 w-full rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] px-4 text-sm outline-none focus:border-[var(--color-border-focus)]"
                            />
                        </Field>
                        <Field label={t.warehouses.name} required>
                            <input
                                required
                                value={formData.name}
                                onChange={(event) =>
                                    setFormData({ ...formData, name: event.target.value })
                                }
                                className="h-11 w-full rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] px-4 text-sm outline-none focus:border-[var(--color-border-focus)]"
                            />
                        </Field>
                        <Field label={t.warehouses.managerId}>
                            <input
                                value={formData.manager_id}
                                onChange={(event) =>
                                    setFormData({ ...formData, manager_id: event.target.value })
                                }
                                className="h-11 w-full rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] px-4 text-sm outline-none focus:border-[var(--color-border-focus)]"
                            />
                            <p className="mt-1.5 text-xs text-[var(--color-text-muted)]">
                                {t.warehouses.managerIdHint}
                            </p>
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
                                className="h-11 w-full rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] px-4 text-sm outline-none focus:border-[var(--color-border-focus)]"
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
                                className="h-11 w-full rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] px-4 text-sm outline-none focus:border-[var(--color-border-focus)]"
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
                                className="h-11 w-full rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] px-4 text-sm outline-none focus:border-[var(--color-border-focus)]"
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
                                className="h-11 w-full rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] px-4 text-sm outline-none focus:border-[var(--color-border-focus)]"
                            />
                        </Field>
                    </div>

                    <Field label={t.warehouses.address}>
                        <input
                            value={formData.address}
                            onChange={(event) =>
                                setFormData({ ...formData, address: event.target.value })
                            }
                            className="h-11 w-full rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] px-4 text-sm outline-none focus:border-[var(--color-border-focus)]"
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
                            className="h-11 w-full rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] px-4 text-sm outline-none focus:border-[var(--color-border-focus)]"
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
                            className="w-full resize-none rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] px-3 py-2 text-sm outline-none focus:border-[var(--color-border-focus)]"
                        />
                    </Field>
                </form>

                <div className="flex justify-end gap-3 border-t border-[var(--color-border-soft)] bg-[var(--color-surface-card)] px-5 py-4">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="h-10 rounded-full border border-[var(--color-border-subtle)] bg-white px-4 text-sm font-normal text-[var(--color-text-secondary)] transition-all hover:bg-[var(--color-surface-card)] active:scale-95 disabled:opacity-50"
                    >
                        {t.common.cancel}
                    </button>
                    <button
                        type="submit"
                        form="warehouseForm"
                        disabled={isSubmitting}
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-[var(--color-brand-primary)] px-5 text-sm font-normal text-white transition-all hover:bg-[var(--color-brand-primary-hover)] active:scale-95 disabled:opacity-50"
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
                {required && <span className="text-[var(--color-accent-error)]"> *</span>}
            </span>
            {children}
        </label>
    );
}
