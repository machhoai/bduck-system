"use client";

import { useEffect, useState } from "react";
import type React from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import {
  EmployeeEmploymentStatus,
  type EmployeeProfile,
  type Role,
  type Warehouse,
} from "@bduck/shared-types";
import { EffectiveAccessPreview } from "@/components/users/EffectiveAccessPreview";
import {
  createEmptyAssignment,
  type AssignmentDraft,
} from "@/components/users/UserAssignmentEditor";
import { toAssignmentDraft } from "@/components/users/userFormSupport";
import type { UserWithAssignments } from "@/hooks/useUsers";
import { useTranslation } from "@/lib/i18n";
import { EmployeeAccountSection } from "./EmployeeAccountSection";
import { EmployeeProfileFields } from "./EmployeeProfileFields";
import { emptyAccountForm, emptyProfileForm } from "./employeeProfileFormTypes";
export { profileStatusLabel } from "./employeeProfileFormTypes";

interface EmployeeProfileFormModalProps {
  isOpen: boolean;
  profile: EmployeeProfile | null;
  users: UserWithAssignments[];
  roles: Role[];
  warehouses: Warehouse[];
  onClose: () => void;
  onSave: (payload: unknown) => Promise<unknown>;
  canManageEmploymentAt: (workplaceId: string) => boolean;
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
}: EmployeeProfileFormModalProps) {
  const { t } = useTranslation();
  const labels = t.employeeManagement;
  const isEdit = Boolean(profile);
  const [formData, setFormData] = useState(emptyProfileForm());
  const [createAccount, setCreateAccount] = useState(false);
  const [accountData, setAccountData] = useState(emptyAccountForm());
  const [assignments, setAssignments] = useState<AssignmentDraft[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const canManageEmployment = canManageEmploymentAt(
    formData.workplace_warehouse_id,
  );

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
    setIsSubmitting(true);
    try {
      const {
        employment_status,
        probation_start_date,
        probation_end_date,
        official_start_date,
        resignation_date,
        ...profileFields
      } = formData;
      const corePayload = {
        ...profileFields,
        ...(canManageEmployment
          ? {
              employment_status: isEdit ? undefined : employment_status,
              probation_start_date: probation_start_date || null,
              probation_end_date: probation_end_date || null,
              official_start_date: official_start_date || null,
              resignation_date: resignation_date || null,
            }
          : {}),
        user_id: createAccount ? null : formData.user_id || null,
        email: formData.email || null,
        phone: formData.phone || null,
        job_title: formData.job_title || null,
        department: formData.department || null,
        notes: formData.notes || null,
      };
      await onSave(
        isEdit
          ? corePayload
          : {
              ...corePayload,
              create_account: createAccount,
              account: createAccount
                ? {
                    email: accountData.email,
                    status: accountData.status,
                    assignments: assignments
                      .filter((assignment) => assignment.role_id)
                      .map((assignment) => ({
                        role_id: assignment.role_id,
                        warehouse_id: assignment.warehouse_id || null,
                        valid_from: assignment.valid_from,
                        valid_until: assignment.valid_until || null,
                        is_active: assignment.is_active,
                      })),
                  }
                : undefined,
            },
      );
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 backdrop-blur-sm sm:items-center sm:p-4">
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] shadow-2xl"
      >
        <header className="flex items-center justify-between border-b border-[var(--color-border-soft)] px-4 py-3">
          <div>
            <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
              {isEdit ? labels.editProfile : labels.createProfileTitle}
            </h2>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              {t.officeScope.inheritedHint}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--color-text-muted)] hover:bg-[var(--color-surface-card)]"
            aria-label={labels.actions.close}
          >
            <X size={18} />
          </button>
        </header>
        <form
          id="employeeProfileForm"
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto p-4"
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
            {!isEdit && (
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
            )}
          </div>
        </form>
        <footer className="flex justify-end gap-3 border-t border-[var(--color-border-soft)] bg-[var(--color-surface-card)] px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="h-9 rounded-full border border-[var(--color-border-subtle)] bg-white px-4 text-sm disabled:opacity-50"
          >
            {t.common.cancel}
          </button>
          <button
            type="submit"
            form="employeeProfileForm"
            disabled={isSubmitting}
            className="h-9 rounded-full bg-[var(--color-brand-primary)] px-5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {t.common.save}
          </button>
        </footer>
      </motion.div>
    </div>
  );
}
