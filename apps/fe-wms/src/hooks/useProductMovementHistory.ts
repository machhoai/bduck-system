"use client";

import { collection, getDocs, query, where } from "firebase/firestore";
import { useEffect, useState } from "react";
import type {
  ExportVoucher,
  ExportVoucherItem,
  ImportVoucher,
  ImportVoucherItem,
} from "@bduck/shared-types";
import { ExportVoucherStatus, ImportVoucherStatus } from "@bduck/shared-types";
import { db } from "@/lib/firebase";

export type ProductMovementType = "import" | "export";

export interface ProductMovementRecord {
  id: string;
  type: ProductMovementType;
  voucherId: string;
  voucherNumber: string;
  warehouseId: string;
  locationId: string | null;
  quantity: number;
  status: string;
  date: Date | null;
  counterparty: string;
}

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "object") {
    const candidate = value as { toDate?: () => Date; seconds?: number };
    if (typeof candidate.toDate === "function") return candidate.toDate();
    if (typeof candidate.seconds === "number") {
      return new Date(candidate.seconds * 1000);
    }
  }
  const parsed = new Date(value as string);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getVoucherDate(voucher: ImportVoucher | ExportVoucher) {
  return (
    toDate(voucher.updated_at) ||
    toDate(voucher.action_time) ||
    toDate(voucher.created_at)
  );
}

function isEffectiveImport(voucher: ImportVoucher) {
  return voucher.status === ImportVoucherStatus.COMPLETED;
}

function isEffectiveExport(voucher: ExportVoucher) {
  return (
    voucher.status === ExportVoucherStatus.SHIPPED ||
    voucher.status === ExportVoucherStatus.COMPLETED
  );
}

type ImportVoucherItemWithId = ImportVoucherItem & { id: string };
type ExportVoucherItemWithId = ExportVoucherItem & { id: string };

async function getImportItems(voucherId: string, productId: string) {
  const snapshot = await getDocs(
    query(
      collection(db, "import_vouchers", voucherId, "items"),
      where("product_id", "==", productId),
    ),
  );
  return snapshot.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }) as ImportVoucherItemWithId)
    .filter((item) => item.is_deleted !== true);
}

async function getExportItems(voucherId: string, productId: string) {
  const snapshot = await getDocs(
    query(
      collection(db, "export_vouchers", voucherId, "items"),
      where("product_id", "==", productId),
    ),
  );
  return snapshot.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }) as ExportVoucherItemWithId)
    .filter((item) => item.is_deleted !== true);
}

export function useProductMovementHistory({
  productId,
  warehouseId,
  importVouchers,
  exportVouchers,
  enabled,
}: {
  productId?: string;
  warehouseId?: string;
  importVouchers: ImportVoucher[];
  exportVouchers: ExportVoucher[];
  enabled: boolean;
}) {
  const [records, setRecords] = useState<ProductMovementRecord[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled || !productId) {
      setRecords([]);
      setLoading(false);
      return;
    }

    let disposed = false;
    const selectedProductId = productId;

    async function loadHistory() {
      setLoading(true);
      try {
        const importCandidates = importVouchers.filter(
          (voucher) =>
            isEffectiveImport(voucher) &&
            (!warehouseId || voucher.warehouse_id === warehouseId),
        );
        const exportCandidates = exportVouchers.filter(
          (voucher) =>
            isEffectiveExport(voucher) &&
            (!warehouseId || voucher.warehouse_id === warehouseId),
        );

        const [importRecords, exportRecords] = await Promise.all([
          Promise.all(
            importCandidates.map(async (voucher) => {
              const items = await getImportItems(voucher.id, selectedProductId);
              return items.map<ProductMovementRecord>((item) => ({
                id: `import:${voucher.id}:${item.id}`,
                type: "import",
                voucherId: voucher.id,
                voucherNumber: voucher.voucher_number,
                warehouseId: voucher.warehouse_id,
                locationId: item.warehouse_location_id,
                quantity: Number(item.actual_quantity || item.expected_quantity || 0),
                status: voucher.status,
                date: getVoucherDate(voucher),
                counterparty: voucher.supplier_name,
              }));
            }),
          ),
          Promise.all(
            exportCandidates.map(async (voucher) => {
              const items = await getExportItems(voucher.id, selectedProductId);
              return items.map<ProductMovementRecord>((item) => ({
                id: `export:${voucher.id}:${item.id}`,
                type: "export",
                voucherId: voucher.id,
                voucherNumber: voucher.voucher_number,
                warehouseId: voucher.warehouse_id,
                locationId: item.warehouse_location_id,
                quantity: Number(item.picked_quantity || item.quantity || 0),
                status: voucher.status,
                date: getVoucherDate(voucher),
                counterparty:
                  voucher.recipient_name ||
                  voucher.recipient_department ||
                  voucher.export_type,
              }));
            }),
          ),
        ]);

        if (disposed) return;
        setRecords(
          [...importRecords.flat(), ...exportRecords.flat()]
            .filter((record) => record.quantity > 0)
            .sort((a, b) => {
              const aTime = a.date?.getTime() ?? 0;
              const bTime = b.date?.getTime() ?? 0;
              return bTime - aTime;
            }),
        );
      } catch (error) {
        if (disposed) return;
        console.error("[useProductMovementHistory] load error:", error);
        setRecords([]);
      } finally {
        if (!disposed) setLoading(false);
      }
    }

    void loadHistory();

    return () => {
      disposed = true;
    };
  }, [enabled, exportVouchers, importVouchers, productId, warehouseId]);

  return { records, loading };
}
