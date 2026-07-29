"use client";

import type { EmployeeProfile } from "@bduck/shared-types";
import { useEmployeeContractLabels } from "@/hooks/useEmployeeContractLabels";
import { useUserStore } from "@/stores/useUserStore";
import { EmployeeContractPanel } from "./EmployeeContractPanel";

export function EmployeeSelfContractPanel({
  profile,
}: {
  profile: EmployeeProfile;
}) {
  const labels = useEmployeeContractLabels();
  const hasPermission = useUserStore((state) => state.hasPermission);
  const facilityId = profile.workplace_warehouse_id;
  const canRead = hasPermission("employees.contracts.self.read", facilityId);

  return (
    <EmployeeContractPanel
      profile={profile}
      labels={labels}
      canRead={canRead}
      canManage={false}
      canTerminate={false}
      canReadDocuments={canRead}
      canManageDocuments={false}
    />
  );
}
