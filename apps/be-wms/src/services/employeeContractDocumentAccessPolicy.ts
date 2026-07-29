import type { EmployeeContract } from "@bduck/shared-types";

export interface EmployeeContractDocumentPermissionReader {
  can(action: string, facilityId: string): boolean;
}

export const canReadEmployeeContractDocument = (
  contract: EmployeeContract,
  actorId: string,
  permissions: EmployeeContractDocumentPermissionReader,
): boolean => {
  const facilityId = contract.workplace_warehouse_id;
  return (
    permissions.can("employees.contracts.documents.read", facilityId) ||
    (contract.employee_user_id === actorId &&
      permissions.can("employees.contracts.self.read", facilityId))
  );
};
