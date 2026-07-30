export type EmployeeDetailTabKey =
  | "profile"
  | "contracts"
  | "leave"
  | "attendance";

export type EmployeeDetailTabAccess = {
  canReadContracts: boolean;
  canReadLeaveBalance: boolean;
  canReadLeaveRequests: boolean;
  canViewAttendance: boolean;
};

export const getVisibleEmployeeDetailTabs = ({
  canReadContracts,
  canReadLeaveBalance,
  canReadLeaveRequests,
  canViewAttendance,
}: EmployeeDetailTabAccess): EmployeeDetailTabKey[] => {
  const tabs: EmployeeDetailTabKey[] = ["profile"];

  if (canReadContracts) {
    tabs.push("contracts");
  }

  if (canReadLeaveBalance || canReadLeaveRequests) {
    tabs.push("leave");
  }

  if (canViewAttendance) {
    tabs.push("attendance");
  }

  return tabs;
};
