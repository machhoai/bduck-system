"use client";

import {
    EmployeeEmploymentStatus,
    type EmployeeProfile,
    type Role,
    type Warehouse,
} from "@bduck/shared-types";
import { motion } from "framer-motion";
import { UserCheck, UserPlus, X } from "lucide-react";
import { useEffect, useState } from "react";
import type React from "react";

import { EffectiveAccessPreview } from "@/components/users/EffectiveAccessPreview";
import {
    createEmptyAssignment,
    type AssignmentDraft,
} from "@/components/users/UserAssignmentEditor";
import { toAssignmentDraft } from "@/components/users/userFormSupport";
import type { UserWithAssignments } from "@/hooks/useUsers";
import { useTranslation } from "@/lib/i18n";
import { employeeInitialContractTranslations } from "@/lib/i18n/employeeInitialContractTranslations";

import { EmployeeAccountSection } from "./EmployeeAccountSection";
import {
    buildEmployeeProfileContractBundle,
    emptyInitialContractForm,
    type EmployeeProfileContractBundle,
} from "./employeeInitialContractDraft";
import { EmployeeInitialContractSection } from "./EmployeeInitialContractSection";
import { EmployeeProfileFields } from "./EmployeeProfileFields";
import { emptyAccountForm, emptyProfileForm } from "./employeeProfileFormTypes";
import { buildEmployeeProfileMutationPayload } from "./employeeProfileMutationPayload";
export { profileStatusLabel } from "./employeeProfileFormTypes";

interface EmployeeProfileFormModalProps {
    isOpen: boolean;
    profile: EmployeeProfile | null;
    users: UserWithAssignments[];
    roles: Role[];
    warehouses: Warehouse[];
    onClose: () => void;
    onSave: (
        payload: unknown,
        contractBundle?: EmployeeProfileContractBundle,
    ) => Promise<unknown>;
    canManageEmploymentAt: (workplaceId: string) => boolean;
    canManageContractsAt: (workplaceId: string) => boolean;
    canManageContractDocumentsAt: (workplaceId: string) => boolean;
}

export function EmployeeProfileFormModal({
    isOpen,
    profile,
    users,
    roles,
    warehouses,
    onClose,
    onSave,
    canManageEmploymentAt,
    canManageContractsAt,
    canManageContractDocumentsAt,
}: EmployeeProfileFormModalProps) {
    const { t, lang } = useTranslation();
    const labels = t.employeeManagement;
    const initialContractLabels = employeeInitialContractTranslations[lang];
    const isEdit = Boolean(profile);
    const [formData, setFormData] = useState(emptyProfileForm());
    const [createAccount, setCreateAccount] = useState(false);
    const [accountData, setAccountData] = useState(emptyAccountForm());
    const [assignments, setAssignments] = useState<AssignmentDraft[]>([]);
    const [initialContract, setInitialContract] = useState(
        emptyInitialContractForm,
    );
    const [contractError, setContractError] = useState<string | null>(null);
    const [submissionId, setSubmissionId] = useState(() => crypto.randomUUID());
    const [isSubmitting, setIsSubmitting] = useState(false);
    const canManageEmployment = canManageEmploymentAt(
        formData.workplace_warehouse_id,
    );
    const canManageContracts =
        !isEdit && canManageContractsAt(formData.workplace_warehouse_id);
    const canManageContractDocuments =
        canManageContracts &&
        canManageContractDocumentsAt(formData.workplace_warehouse_id);

    useEffect(() => {
        if (!isOpen) return;
        if (profile) {
            setFormData({
                user_id: profile.user_id || "",
                employee_code: profile.employee_code,
                full_name: profile.full_name,
                email: profile.email || "",
                phone: profile.phone || "",
                job_title: profile.job_title || "",
                department: profile.department || "",
                workplace_warehouse_id: profile.workplace_warehouse_id,
                status: profile.status,
                employment_status:
                    profile.employment_status ?? EmployeeEmploymentStatus.UNSPECIFIED,
                probation_start_date: profile.probation_start_date || "",
                probation_end_date: profile.probation_end_date || "",
                official_start_date: profile.official_start_date || "",
                resignation_date: profile.resignation_date || "",
                notes: profile.notes || "",
            });
        } else {
            setFormData(emptyProfileForm(warehouses[0]?.id || ""));
        }
        setCreateAccount(false);
        setAccountData(emptyAccountForm());
        setAssignments([createEmptyAssignment(warehouses[0]?.id || "")]);
        setInitialContract(emptyInitialContractForm());
        setContractError(null);
        setSubmissionId(crypto.randomUUID());
    }, [isOpen, profile, warehouses]);

    useEffect(() => {
        if (!createAccount) return;
        setAccountData((current) => ({
            ...current,
            email: current.email || formData.email,
        }));
    }, [createAccount, formData.email]);

    const linkedUser = users.find(
        (candidate) => candidate.id === (formData.user_id || profile?.user_id),
    );
    const previewAssignments = createAccount
        ? assignments
        : linkedUser?.assignments.map(toAssignmentDraft);

    if (!isOpen) return null;

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        const bundleResult = buildEmployeeProfileContractBundle({
            form: initialContract,
            canManageContract: canManageContracts,
            canManageDocument: canManageContractDocuments,
            submissionId,
        });
        if (!bundleResult.ok) {
            setContractError(
                bundleResult.error === "INVALID_DATE"
                    ? initialContractLabels.invalidDate
                    : bundleResult.error === "INVALID_PDF"
                        ? initialContractLabels.invalidPdf
                        : initialContractLabels.required,
            );
            return;
        }
        setContractError(null);
        setIsSubmitting(true);
        try {
            const payload = buildEmployeeProfileMutationPayload({
                form: formData,
                isEdit,
                canManageEmployment,
                createAccount,
                account: accountData,
                assignments,
            });
            await onSave(payload, isEdit ? undefined : bundleResult.value);
            onClose();
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/40 backdrop-blur-sm sm:p-4">
            <motion.div
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex max-h-[90vh] w-[94vw] max-w-5xl xl:max-w-6xl flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] shadow-2xl"
            >
                <header className="flex items-center justify-between border-b border-[var(--color-border-soft)] px-5 py-3.5 bg-white shrink-0">
                    <div className="flex items-center gap-2.5">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--color-brand-primary-muted)] text-[var(--color-brand-primary)] shadow-2xs">
                            {isEdit ? <UserCheck size={20} /> : <UserPlus size={20} />}
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-[var(--color-text-primary)]">
                                {isEdit ? labels.editProfile : labels.createProfileTitle}
                            </h2>
                            <p className="text-xxs text-[var(--color-text-muted)]">
                                {t.officeScope.inheritedHint}
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--color-text-muted)] transition-all hover:bg-[var(--color-surface-card)] hover:text-[var(--color-text-primary)] active:scale-95 cursor-pointer disabled:opacity-50"
                        aria-label={labels.actions.close}
                    >
                        <X size={18} />
                    </button>
                </header>
                <form
                    id="employeeProfileForm"
                    onSubmit={handleSubmit}
                    className="flex-1 overflow-y-auto p-5 bg-[#f8fafc]/50"
                >
                    <div className="grid gap-4">
                        <EmployeeProfileFields
                            value={formData}
                            users={users}
                            warehouses={warehouses}
                            disableUserLink={createAccount}
                            isEdit={isEdit}
                            canManageEmployment={canManageEmployment}
                            onChange={setFormData}
                        />
                        {!isEdit && (
                            <>
                                {canManageContracts ? (
                                    <EmployeeInitialContractSection
                                        key={submissionId}
                                        value={initialContract}
                                        canManageDocuments={canManageContractDocuments}
                                        error={contractError}
                                        onChange={(next) => {
                                            setContractError(null);
                                            setInitialContract(next);
                                        }}
                                    />
                                ) : null}
                                <EmployeeAccountSection
                                    enabled={createAccount}
                                    value={accountData}
                                    assignments={assignments}
                                    roles={roles}
                                    warehouses={warehouses}
                                    workplaceId={formData.workplace_warehouse_id}
                                    onEnabledChange={setCreateAccount}
                                    onChange={setAccountData}
                                    onAssignmentsChange={setAssignments}
                                />
                            </>
                        )}
                        <EffectiveAccessPreview
                            key={formData.workplace_warehouse_id}
                            userId={formData.user_id || profile?.user_id}
                            facilities={warehouses}
                            draft={
                                previewAssignments
                                    ? {
                                        workplaceFacilityId: formData.workplace_warehouse_id,
                                        assignments: previewAssignments,
                                        roles,
                                    }
                                    : undefined
                            }
                        />
                    </div>
                </form>
                <footer className="flex items-center justify-between border-t border-[var(--color-border-soft)] bg-white px-5 py-3 shrink-0">
                    <div className="text-xxs text-[var(--color-text-muted)] hidden sm:block">
                        * Các trường có dấu sao đỏ là thông tin bắt buộc.
                    </div>
                    <div className="flex items-center gap-2.5 ml-auto sm:ml-0">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isSubmitting}
                            className="h-8 rounded-full border border-[var(--color-border-subtle)] bg-white px-4 text-xs font-semibold text-[var(--color-text-secondary)] shadow-2xs hover:bg-[var(--color-surface-card)] active:scale-95 disabled:opacity-50 cursor-pointer"
                        >
                            {t.common.cancel}
                        </button>
                        <button
                            type="submit"
                            form="employeeProfileForm"
                            disabled={isSubmitting}
                            className="h-8 rounded-full bg-[var(--color-brand-primary)] px-5 text-xs font-semibold text-white shadow-2xs hover:bg-[var(--color-brand-primary-hover)] active:scale-95 disabled:opacity-50 cursor-pointer"
                        >
                            {t.common.save}
                        </button>
                    </div>
                </footer>
            </motion.div>
        </div>
    );
}
