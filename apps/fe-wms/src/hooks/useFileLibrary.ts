"use client";

import { useMemo } from "react";
import { useUserStore } from "@/stores/useUserStore";
import { buildFileLibraryItems } from "@/utils/fileLibrary";
import { useExportVouchers } from "./useExportVouchers";
import { useImportVouchers } from "./useImportVouchers";
import { useTransferOrders } from "./useTransferOrders";
import { useUsers } from "./useUsers";

export function useFileLibrary() {
  const hasPermission = useUserStore((state) => state.hasPermission);
  const imports = useImportVouchers();
  const exports = useExportVouchers();
  const transfers = useTransferOrders();
  const { users, isLoading: usersLoading } = useUsers();
  const canViewAll = hasPermission("file_library.uploaded_files.view_all");
  const files = useMemo(
    () =>
      buildFileLibraryItems({
        imports: imports.allVouchers,
        exports: [
          ...exports.activeVouchers,
          ...exports.completedVouchers,
        ],
        transfers: [
          ...transfers.activeOrders,
          ...transfers.completedOrders,
        ],
        users,
      }),
    [exports, imports.allVouchers, transfers, users],
  );

  return {
    files,
    canViewAll,
    loading:
      usersLoading || imports.loading || exports.loading || transfers.loading,
  };
}
