"use client";

import { useEffect, useState } from "react";
import type React from "react";
import { Image as ImageIcon, Loader2, Upload, X } from "lucide-react";
import { gooeyToast } from "goey-toast";
import type { Organization } from "@bduck/shared-types";
import { uploadImageAsWebp } from "@/lib/firebaseStorage";
import { useTranslation } from "@/lib/i18n";

interface OrganizationFormModalProps {
    isOpen: boolean;
    organization?: Organization | null;
    onClose: () => void;
    onSave: (payload: unknown) => Promise<unknown>;
}

const initialForm = {
    name: "",
    code: "",
    tax_code: "",
    address: "",
    organization_image_url: "",
};

const MAX_IMAGE_SIZE = 20 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function OrganizationFormModal({
    isOpen,
    organization,
    onClose,
    onSave,
}: OrganizationFormModalProps) {
    const { t } = useTranslation();
    const isEdit = Boolean(organization);
    const [formData, setFormData] = useState(initialForm);
    const [selectedImage, setSelectedImage] = useState<File | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (!isOpen) return;

        if (organization) {
            setFormData({
                name: organization.name,
                code: organization.code,
                tax_code: organization.tax_code || "",
                address: organization.address || "",
                organization_image_url: organization.organization_image_url || "",
            });
            setSelectedImage(null);
            return;
        }

        setFormData(initialForm);
        setSelectedImage(null);
    }, [isOpen, organization]);

    if (!isOpen) return null;

    const saveAction = async () => {
        setIsSubmitting(true);
        try {
            let imageUrl = formData.organization_image_url || null;
            if (selectedImage) {
                imageUrl = await uploadImageAsWebp(selectedImage, "organizations");
            }

            await onSave({
                name: formData.name,
                code: formData.code,
                tax_code: formData.tax_code || null,
                address: formData.address || null,
                organization_image_url: imageUrl,
            });
            onClose();
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        void gooeyToast.promise(saveAction(), {
            loading: t.organizations.saving,
            success: t.organizations.saveSuccess,
            error: (error: unknown) =>
                error instanceof Error ? error.message : t.organizations.saveError,
            description: {
                success: t.organizations.saveSuccess,
                error: t.organizations.saveError,
            },
            action: {
                error: {
                    label: t.common.retry,
                    onClick: () => void saveAction(),
                },
            },
        });
    };

    const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) return;

        if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
            gooeyToast.error(t.organizations.invalidImage, {
                description: t.organizations.invalidImageDescription,
                preset: "snappy",
                timing: { displayDuration: 6000 },
            });
            return;
        }

        if (file.size > MAX_IMAGE_SIZE) {
            gooeyToast.error(t.organizations.imageTooLarge, {
                description: t.organizations.imageTooLargeDescription,
                preset: "snappy",
                timing: { displayDuration: 6000 },
            });
            return;
        }

        setSelectedImage(file);
    };

    const previewUrl = selectedImage
        ? URL.createObjectURL(selectedImage)
        : formData.organization_image_url;

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-3 pb-3 pt-16 backdrop-blur-sm sm:items-center sm:p-4">
            <div className="flex max-h-[92vh] w-[90%] flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)]">
                <div className="flex items-center justify-between border-b border-[var(--color-border-soft)] px-5 py-4">
                    <h2 className="text-[21px] font-semibold text-[var(--color-text-primary)]">
                        {isEdit ? t.organizations.edit : t.organizations.addNew}
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
                    id="organizationForm"
                    onSubmit={handleSubmit}
                    className="flex-1 space-y-4 overflow-y-auto p-5"
                >
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-[180px_1fr]">
                        <div className="space-y-2">
                            <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)]">
                                {previewUrl ? (
                                    <img
                                        src={previewUrl}
                                        alt={formData.name || t.organizations.image}
                                        className="h-full w-full object-cover"
                                    />
                                ) : (
                                    <ImageIcon size={36} className="text-[var(--color-text-muted)]" />
                                )}
                            </div>
                            <label className="inline-flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-full border border-[var(--color-border-subtle)] bg-white px-3 text-sm font-normal text-[var(--color-text-secondary)] transition-all hover:bg-[var(--color-surface-card)] active:scale-95">
                                <Upload size={16} />
                                {t.organizations.uploadImage}
                                <input
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp"
                                    className="hidden"
                                    onChange={handleImageChange}
                                />
                            </label>
                        </div>
                        <div className="space-y-4">
                            <Field label={t.organizations.code} required>
                                <input
                                    required
                                    value={formData.code}
                                    onChange={(event) =>
                                        setFormData({ ...formData, code: event.target.value })
                                    }
                                    className="h-11 w-full rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] px-4 text-sm outline-none focus:border-[var(--color-border-focus)]"
                                />
                            </Field>
                            <Field label={t.organizations.name} required>
                                <input
                                    required
                                    value={formData.name}
                                    onChange={(event) =>
                                        setFormData({ ...formData, name: event.target.value })
                                    }
                                    className="h-11 w-full rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] px-4 text-sm outline-none focus:border-[var(--color-border-focus)]"
                                />
                            </Field>
                        </div>
                    </div>
                    <Field label={t.organizations.taxCode}>
                        <input
                            value={formData.tax_code}
                            onChange={(event) =>
                                setFormData({ ...formData, tax_code: event.target.value })
                            }
                            className="h-11 w-full rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] px-4 text-sm outline-none focus:border-[var(--color-border-focus)]"
                        />
                    </Field>
                    <Field label={t.organizations.address}>
                        <input
                            value={formData.address}
                            onChange={(event) =>
                                setFormData({ ...formData, address: event.target.value })
                            }
                            className="h-11 w-full rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] px-4 text-sm outline-none focus:border-[var(--color-border-focus)]"
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
                        form="organizationForm"
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
