"use client";

import { useMemo } from "react";
import { useExportVouchers } from "@/hooks/useExportVouchers";
import { useImportVouchers } from "@/hooks/useImportVouchers";
import { useTransferOrders } from "@/hooks/useTransferOrders";
import { useUsers } from "@/hooks/useUsers";
import { buildFileLibraryItems } from "@/utils/fileLibrary";

export function useFileLibrary() {
  const {
    allVouchers: importVouchers,
    loading: importsLoading,
  } = useImportVouchers();
  const {
    activeVouchers: activeExports,
    completedVouchers: completedExports,
    loading: exportsLoading,
  } = useExportVouchers();
  const {
    activeOrders,
    completedOrders,
    loading: transfersLoading,
  } = useTransferOrders();
  const { users, isLoading: usersLoading } = useUsers();

  const exportVouchers = useMemo(
    () => [...activeExports, ...completedExports],
    [activeExports, completedExports],
  );

  const transferOrders = useMemo(
    () => [...activeOrders, ...completedOrders],
    [activeOrders, completedOrders],
  );

  const files = useMemo(
    () =>
      buildFileLibraryItems({
        imports: importVouchers,
        exports: exportVouchers,
        transfers: transferOrders,
        users,
      }),
    [exportVouchers, importVouchers, transferOrders, users],
  );

  return {
    files,
    loading:
      importsLoading || exportsLoading || transfersLoading || usersLoading,
  };
}
