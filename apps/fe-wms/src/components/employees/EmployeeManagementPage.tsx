"use client";

import type { EmployeeProfile } from "@bduck/shared-types";
import { gooeyToast } from "goey-toast";
import { IdCard } from "lucide-react";
import { useMemo, useRef, useState } from "react";

import {
  createEmployeeContract,
  uploadEmployeeContractPdf,
} from "@/api/employeeContractApi";
import { useEmployeeContractLabels } from "@/hooks/useEmployeeContractLabels";
import { useEmployeeProfiles } from "@/hooks/useEmployeeProfiles";
import { useRoles } from "@/hooks/useRoles";
import { useUsers } from "@/hooks/useUsers";
import { useWarehouses } from "@/hooks/useWarehouses";
import { emitDataMutation } from "@/lib/dataInvalidation";
import { isEmployeeContractsFeatureEnabled } from "@/lib/employeeContractFeatureFlag";
import { useTranslation } from "@/lib/i18n";
import { employeeInitialContractTranslations } from "@/lib/i18n/employeeInitialContractTranslations";
import { useUserStore } from "@/stores/useUserStore";

import { EmployeeEmploymentModal } from "./EmployeeEmploymentModal";
import type { EmployeeProfileContractBundle } from "./employeeInitialContractDraft";
import {
  ensureWarehouseIncluded,
  filterWarehousesByScope,
  getPermissionScope,
} from "./employeeManagementScope";
import { EmployeeManagementView } from "./EmployeeManagementView";
import { EmployeeProfileFormModal } from "./EmployeeProfileFormModal";

export function EmployeeManagementPage() {
  const { t, lang } = useTranslation();
  const toasts = t.employeeManagement.toasts;
  const contractLabels = useEmployeeContractLabels();
  const initialContractLabels = employeeInitialContractTranslations[lang];
  const noAccess = t.employeeManagement.noAccess;
  const actions = t.employeeManagement.actions;

  const permissions = useUserStore((state) => state.permissions);
  const hasPermission = useUserStore((state) => state.hasPermission);
  const profileState = useEmployeeProfiles();
  const { users } = useUsers();
  const { roles } = useRoles();
  const { warehouses, loading: warehousesLoading } = useWarehouses();
  const [editingProfile, setEditingProfile] = useState<EmployeeProfile | null>(
    null,
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [employmentProfileId, setEmploymentProfileId] = useState<string | null>(
    null,
  );
  const bundleProgressRef = useRef(
    new Map<string, { profileId: string; contractId: string | null }>(),
  );
  const employmentProfile =
    profileState.profiles.find(
      (profile) => profile.id === employmentProfileId,
    ) ?? null;
  const readScope = useMemo(
    () => getPermissionScope(permissions, "employees.read"),
    [permissions],
  );
  const writeScope = useMemo(
    () => getPermissionScope(permissions, "employees.write"),
    [permissions],
  );
  const writableWarehouses = useMemo(
    () => filterWarehousesByScope(warehouses, writeScope),
    [warehouses, writeScope],
  );
  const warehouseById = useMemo(
    () => new Map(warehouses.map((item) => [item.id, item])),
    [warehouses],
  );

  const openCreate = () => {
    setEditingProfile(null);
    setIsModalOpen(true);
  };
  const openEdit = (profile: EmployeeProfile) => {
    setEditingProfile(profile);
    setIsModalOpen(true);
  };
  const handleSave = async (
    payload: unknown,
    contractBundle?: EmployeeProfileContractBundle,
  ) => {
    const saveBundle = async () => {
      if (editingProfile) {
        return profileState.updateProfile(editingProfile.id, payload);
      }

      let progress = contractBundle
        ? bundleProgressRef.current.get(contractBundle.submission_id)
        : undefined;
      try {
        if (!progress) {
          const response = (await profileState.createProfile(payload)) as {
            data?: { profile?: EmployeeProfile };
          };
          const profileId = response.data?.profile?.id;
          if (!profileId) throw new Error(toasts.savingError);
          progress = { profileId, contractId: null };
          if (contractBundle?.contract) {
            bundleProgressRef.current.set(
              contractBundle.submission_id,
              progress,
            );
          }
        }

        if (contractBundle?.contract && !progress.contractId) {
          const result = await createEmployeeContract(
            progress.profileId,
            {
              ...contractBundle.contract,
              idempotency_key: `initial-profile-contract-${contractBundle.submission_id}`,
              action_time: new Date(),
            },
            contractLabels.toasts.saveError,
          );
          progress.contractId = result.contract.id;
          bundleProgressRef.current.set(contractBundle.submission_id, progress);
        }

        if (contractBundle?.pdf_file && progress.contractId) {
          await uploadEmployeeContractPdf(
            progress.profileId,
            progress.contractId,
            contractBundle.pdf_file,
            contractLabels.toasts.uploadError,
            `initial-profile-pdf-${contractBundle.submission_id}`,
          );
        }

        if (contractBundle) {
          bundleProgressRef.current.delete(contractBundle.submission_id);
        }
        emitDataMutation([
          "employee_profiles",
          "employee_contracts",
          "employee_contract_documents",
        ]);
        return progress;
      } catch (error) {
        if (contractBundle && progress) {
          throw new Error(
            `${initialContractLabels.partialFailure} ${
              error instanceof Error ? error.message : ""
            }`.trim(),
          );
        }
        throw error;
      }
    };
    const action = saveBundle();
    await gooeyToast.promise(action, {
      loading: toasts.savingLoading,
      success: toasts.savingSuccess,
      error: (error: unknown) =>
        error instanceof Error ? error.message : toasts.savingError,
      action: {
        error: {
          label: toasts.retry,
          onClick: () => void handleSave(payload, contractBundle),
        },
      },
    });
  };
  const handleDelete = async (profile: EmployeeProfile) => {
    const confirmText = actions.confirmDelete.replace(
      "{name}",
      profile.full_name,
    );
    if (!confirm(confirmText)) return;
    await gooeyToast.promise(profileState.deleteProfile(profile.id), {
      loading: toasts.deletingLoading,
      success: toasts.deletingSuccess,
      error: (error: unknown) =>
        error instanceof Error ? error.message : toasts.deletingError,
      action: {
        error: {
          label: toasts.retry,
          onClick: () => void handleDelete(profile),
        },
      },
    });
  };

  if (!hasPermission("employees.read")) {
    return (
      <div className="grid min-h-72 place-items-center p-4 text-center">
        <div>
          <IdCard
            size={42}
            className="mx-auto text-[var(--color-text-muted)]"
          />
          <h1 className="mt-3 text-base font-semibold text-[var(--color-text-primary)]">
            {noAccess.title}
          </h1>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
            {noAccess.hint}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 pb-2">
      <EmployeeManagementView
        profiles={profileState.profiles}
        users={users}
        warehouses={warehouses}
        readScope={readScope}
        writeScope={writeScope}
        isLoading={profileState.isLoading || warehousesLoading}
        error={profileState.error}
        canCreate={
          hasPermission("employees.write") && writableWarehouses.length > 0
        }
        onCreate={openCreate}
        onEdit={openEdit}
        onDelete={handleDelete}
        canManageEmployment={(profile) =>
          hasPermission(
            "employees.employment.manage",
            profile.workplace_warehouse_id,
          )
        }
        onManageEmployment={(profile) => setEmploymentProfileId(profile.id)}
      />
      <EmployeeProfileFormModal
        isOpen={isModalOpen}
        profile={editingProfile}
        users={users}
        roles={roles}
        warehouses={
          editingProfile
            ? ensureWarehouseIncluded(
                writableWarehouses,
                warehouseById.get(editingProfile.workplace_warehouse_id),
              )
            : writableWarehouses
        }
        onClose={() => setIsModalOpen(false)}
        onSave={handleSave}
        canManageEmploymentAt={(workplaceId) =>
          Boolean(
            workplaceId &&
            hasPermission("employees.employment.manage", workplaceId),
          )
        }
        canManageContractsAt={(workplaceId) =>
          Boolean(
            isEmployeeContractsFeatureEnabled &&
            workplaceId &&
            hasPermission("employees.contracts.manage", workplaceId),
          )
        }
        canManageContractDocumentsAt={(workplaceId) =>
          Boolean(
            isEmployeeContractsFeatureEnabled &&
            workplaceId &&
            hasPermission("employees.contracts.documents.manage", workplaceId),
          )
        }
      />
      <EmployeeEmploymentModal
        isOpen={Boolean(employmentProfile)}
        profile={employmentProfile}
        onClose={() => setEmploymentProfileId(null)}
      />
    </div>
  );
}
