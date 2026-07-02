"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import type {
  ExportVoucher,
  ImportVoucher,
  TransferOrder,
} from "@bduck/shared-types";
import { db } from "@/lib/firebase";
import { useUserStore } from "@/stores/useUserStore";
import { buildFileLibraryItems, toFileLibraryDate } from "@/utils/fileLibrary";
import { useUsers } from "./useUsers";

function sortByCreatedAt<T extends { created_at?: unknown }>(items: T[]) {
  return [...items].sort((a, b) => {
    const aTime = toFileLibraryDate(a.created_at)?.getTime() ?? 0;
    const bTime = toFileLibraryDate(b.created_at)?.getTime() ?? 0;
    return bTime - aTime;
  });
}

export function useFileLibrary() {
  const [imports, setImports] = useState<ImportVoucher[]>([]);
  const [exports, setExports] = useState<ExportVoucher[]>([]);
  const [transfers, setTransfers] = useState<TransferOrder[]>([]);
  const [loadingSources, setLoadingSources] = useState({
    imports: true,
    exports: true,
    transfers: true,
  });

  const user = useUserStore((s) => s.user);
  const hasPermission = useUserStore((s) => s.hasPermission);
  const { users, isLoading: usersLoading } = useUsers();

  const canViewAll = hasPermission("file_library.uploaded_files.view_all");

  useEffect(() => {
    if (!user?.id) {
      setImports([]);
      setExports([]);
      setTransfers([]);
      setLoadingSources({ imports: false, exports: false, transfers: false });
      return;
    }

    setLoadingSources({ imports: true, exports: true, transfers: true });

    const importQuery = query(
      collection(db, "import_vouchers"),
      where("is_deleted", "==", false),
    );
    const exportQuery = query(
      collection(db, "export_vouchers"),
      where("is_deleted", "==", false),
    );
    const transferQuery = query(
      collection(db, "transfer_orders"),
      where("is_deleted", "==", false),
    );

    const keepVisible = <T extends { creator_id: string }>(item: T) =>
      canViewAll || item.creator_id === user.id;

    const unsubscribeImports = onSnapshot(
      importQuery,
      (snapshot) => {
        const rows = snapshot.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }) as ImportVoucher)
          .filter(keepVisible);
        setImports(sortByCreatedAt(rows));
        setLoadingSources((current) => ({ ...current, imports: false }));
      },
      (error) => {
        console.error("[useFileLibrary] import listener error:", error);
        setLoadingSources((current) => ({ ...current, imports: false }));
      },
    );

    const unsubscribeExports = onSnapshot(
      exportQuery,
      (snapshot) => {
        const rows = snapshot.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }) as ExportVoucher)
          .filter(keepVisible);
        setExports(sortByCreatedAt(rows));
        setLoadingSources((current) => ({ ...current, exports: false }));
      },
      (error) => {
        console.error("[useFileLibrary] export listener error:", error);
        setLoadingSources((current) => ({ ...current, exports: false }));
      },
    );

    const unsubscribeTransfers = onSnapshot(
      transferQuery,
      (snapshot) => {
        const rows = snapshot.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }) as TransferOrder)
          .filter(keepVisible);
        setTransfers(sortByCreatedAt(rows));
        setLoadingSources((current) => ({ ...current, transfers: false }));
      },
      (error) => {
        console.error("[useFileLibrary] transfer listener error:", error);
        setLoadingSources((current) => ({ ...current, transfers: false }));
      },
    );

    return () => {
      unsubscribeImports();
      unsubscribeExports();
      unsubscribeTransfers();
    };
  }, [canViewAll, user?.id]);

  const files = useMemo(
    () =>
      buildFileLibraryItems({
        imports,
        exports,
        transfers,
        users,
      }),
    [exports, imports, transfers, users],
  );

  return {
    files,
    canViewAll,
    loading:
      usersLoading ||
      loadingSources.imports ||
      loadingSources.exports ||
      loadingSources.transfers,
  };
}
