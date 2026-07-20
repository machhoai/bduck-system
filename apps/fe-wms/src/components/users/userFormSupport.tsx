import type { UserWarehouseRole } from "@bduck/shared-types";
import type { AssignmentDraft } from "./UserAssignmentEditor";

export const userFormInputClassName =
  "h-8 w-full rounded-full border border-[var(--color-border-subtle)] bg-white px-4 text-sm outline-none focus:border-[var(--color-border-focus)]";

export function dedupeAssignments(assignments: AssignmentDraft[]) {
  const byScopeAndRole = new Map<string, AssignmentDraft>();
  assignments.forEach((assignment) => {
    if (!assignment.role_id) return;
    const key = `${assignment.warehouse_id || "global"}:${assignment.role_id}`;
    byScopeAndRole.set(key, assignment);
  });
  return Array.from(byScopeAndRole.values());
}

export function toAssignmentDraft(
  assignment: UserWarehouseRole,
): AssignmentDraft {
  return {
    client_id: assignment.id,
    warehouse_id: assignment.warehouse_id || "",
    role_id: assignment.role_id,
    valid_from: assignment.valid_from,
    valid_until: assignment.valid_until || "",
    is_active: assignment.is_active,
    scope_origin: assignment.scope_origin ?? "LEGACY_DIRECT",
  };
}

export function UserFormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm text-[var(--color-text-secondary)]">
        {label}
      </span>
      {children}
    </label>
  );
}
