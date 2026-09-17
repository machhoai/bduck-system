"use client";

import { useMemo } from "react";
import { useApprovalTasks } from "./useApprovalTasks";
import { useExportVouchers } from "./useExportVouchers";
import { useImportVouchers } from "./useImportVouchers";
import {
  countActionableNonconformities,
  useNonconformities,
} from "./useNonconformities";
import { useTransferOrders } from "./useTransferOrders";
import { useLeaveApprovals } from "./useLeaveApprovals";
import { isLeaveFeatureEnabled } from "@/lib/leaveFeatureFlag";
import { useUserStore } from "@/stores/useUserStore";

const leaveApprovalBadgeLabels = {
  approvalLoadError: "Không thể tải danh sách duyệt nghỉ phép.",
  approvalSaveError: "Không thể cập nhật duyệt nghỉ phép.",
};

const includesStatus = (
  value: string,
  statuses: readonly string[],
) => statuses.includes(value);

export function useMenuBadges() {
  const hasPermission = useUserStore((state) => state.hasPermission);
  const canApproveLeave =
    isLeaveFeatureEnabled && hasPermission("leave.approve");
  const canReassignLeaveApprover =
    isLeaveFeatureEnabled && hasPermission("leave.approver.reassign");
  const leaveApprovals = useLeaveApprovals(
    {
      canApprove: canApproveLeave,
      canManage: false,
      canReassign: canReassignLeaveApprover,
    },
    leaveApprovalBadgeLabels,
  );
  const approvals = useApprovalTasks();
  const imports = useImportVouchers();
  const exports = useExportVouchers();
  const transfers = useTransferOrders();
  const nonconformities = useNonconformities();

  return useMemo(() => {
    const importTasks = imports.activeVouchers.filter((voucher) =>
      includesStatus(voucher.status, ["APPROVED", "RECEIVING"]),
    ).length;
    const exportTasks = exports.activeVouchers.filter((voucher) =>
      includesStatus(voucher.status, ["APPROVED", "PICKING", "SHIPPED"]),
    ).length;
    const transferTasks = transfers.activeOrders.filter((order) =>
      includesStatus(order.status, ["PENDING_RECEIVE", "RECEIVING"]),
    ).length;
    const nonconformityCount = countActionableNonconformities(
      nonconformities.reports,
    );
    const importCount = imports.activeVouchers.length;
    const exportCount = exports.activeVouchers.length;
    const transferCount = transfers.activeOrders.length;
    return {
      tasks:
        approvals.taskCount +
        importTasks +
        exportTasks +
        transferTasks +
        nonconformityCount,
      vouchers: importCount + exportCount + transferCount,
      employeeAdmin:
        leaveApprovals.tasks.length + leaveApprovals.unavailable.length,
      importVouchers: importCount,
      exportVouchers: exportCount,
      transfers: transferCount,
      nonconformities: nonconformityCount,
    };
  }, [
    approvals.taskCount,
    exports.activeVouchers,
    imports.activeVouchers,
    leaveApprovals.tasks.length,
    leaveApprovals.unavailable.length,
    nonconformities.reports,
    transfers.activeOrders,
  ]);
}
