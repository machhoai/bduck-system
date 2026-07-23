"use client";

import type { Dispatch, SetStateAction } from "react";
import { UserStatus, type Role, type Warehouse } from "@bduck/shared-types";
import {
    UserAssignmentEditor,
    type AssignmentDraft,
} from "@/components/users/UserAssignmentEditor";
import { useTranslation } from "@/lib/i18n";
import type { EmployeeAccountFormState } from "./employeeProfileFormTypes";

interface EmployeeAccountSectionProps {
    enabled: boolean;
    value: EmployeeAccountFormState;
    assignments: AssignmentDraft[];
    roles: Role[];
    warehouses: Warehouse[];
    workplaceId: string;
    onEnabledChange: (enabled: boolean) => void;
    onChange: Dispatch<SetStateAction<EmployeeAccountFormState>>;
    onAssignmentsChange: (assignments: AssignmentDraft[]) => void;
}

const inputClassName =
    "h-9 w-full rounded-full border border-[var(--color-border-subtle)] bg-white px-4 text-sm outline-none focus:border-[var(--color-border-focus)]";

export function EmployeeAccountSection({
    enabled,
    value,
    assignments,
    roles,
    warehouses,
    workplaceId,
    onEnabledChange,
    onChange,
    onAssignmentsChange,
}: EmployeeAccountSectionProps) {
    const { t } = useTranslation();
    const labels = t.employeeManagement.fields;

    return (
        <section className="grid gap-4 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-white p-4">
            <label className="flex items-center gap-3 text-sm font-semibold text-[var(--color-text-primary)]">
                <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(event) => onEnabledChange(event.target.checked)}
                    className="h-4 w-4"
                />
                {labels.createAccountWithProfile}
            </label>
            {enabled && (
                <>
                    <div className="grid gap-3 md:grid-cols-2">
                        <label className="grid gap-1.5 text-sm text-[var(--color-text-secondary)]">
                            {labels.accountEmail}
                            <input
                                required
                                type="email"
                                value={value.email}
                                onChange={(event) =>
                                    onChange((current) => ({
                                        ...current,
                                        email: event.target.value,
                                    }))
                                }
                                className={inputClassName}
                            />
                        </label>
                        <label className="grid gap-1.5 text-sm text-[var(--color-text-secondary)]">
                            {labels.accountStatus}
                            <select
                                value={value.status}
                                onChange={(event) =>
                                    onChange((current) => ({
                                        ...current,
                                        status: event.target.value as UserStatus,
                                    }))
                                }
                                className={inputClassName}
                            >
                                {Object.values(UserStatus).map((status) => (
                                    <option key={status} value={status}>
                                        {status}
                                    </option>
                                ))}
                            </select>
                        </label>
                    </div>
                    <details className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-3">
                        <summary className="cursor-pointer text-sm font-semibold text-[var(--color-text-primary)]">
                            {t.officeScope.directAssignments}
                        </summary>
                        <p className="mb-3 mt-2 text-xs text-[var(--color-text-muted)]">
                            {t.officeScope.directAssignmentsHint}
                        </p>
                        <UserAssignmentEditor
                            assignments={assignments}
                            roles={roles}
                            warehouses={warehouses}
                            defaultFacilityId={workplaceId}
                            onChange={onAssignmentsChange}
                        />
                    </details>
                </>
            )}
        </section>
    );
}
