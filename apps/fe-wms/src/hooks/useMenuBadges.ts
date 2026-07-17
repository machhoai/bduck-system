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

const includesStatus = (
  value: string,
  statuses: readonly string[],
) => statuses.includes(value);

export function useMenuBadges() {
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
      importVouchers: importCount,
      exportVouchers: exportCount,
      transfers: transferCount,
      nonconformities: nonconformityCount,
    };
  }, [approvals.taskCount, exports.activeVouchers, imports.activeVouchers, nonconformities.reports, transfers.activeOrders]);
}
