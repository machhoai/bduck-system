"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, query, where } from "firebase/firestore";
import type { WorkflowTask } from "@bduck/shared-types";
import { db } from "@/lib/firebase";
import { useProducts } from "@/hooks/useProducts";
import { useWarehouseLocations } from "@/hooks/useWarehouses";
import type { ReceivingItem } from "@/stores/useReceivingStore";
import {
  resolveLocationDisplay,
  resolveProductDisplay,
} from "@/utils/taskSessionDisplay";

interface ReceivingVoucherDoc {
  voucher_number?: string;
  supplier_name?: string;
}

interface ReceivingItemDoc {
  id: string;
  product_id?: string;
  product_name?: string;
  product_sku?: string;
  product_code?: string;
  barcode?: string;
  product_image_url?: string[] | string | null;
  warehouse_location_id?: string;
  location_name?: string;
  expected_quantity?: number;
  actual_quantity?: number;
  notes?: string;
}

interface PickingVoucherDoc {
  voucher_number?: string;
}

interface PickingItem {
  id: string;
  product_id: string;
  product_name: string;
  product_code: string;
  product_barcode: string;
  product_image_url: string | null;
  warehouse_location_id: string;
  location_name: string;
  quantity: number;
  picked_quantity: number;
  notes: string;
}

function getFirstImageUrl(
  value: string[] | string | null | undefined,
  fallback?: string[] | null,
) {
  if (Array.isArray(value)) {
    return value.find((item) => typeof item === "string" && item.trim()) ?? null;
  }

  if (typeof value === "string" && value.trim()) {
    return value;
  }

  return (
    fallback?.find((item) => typeof item === "string" && item.trim()) ?? null
  );
}

function getTaskEntityId(task: WorkflowTask) {
  const resultEntityId =
    task.result && typeof task.result["entity_id"] === "string"
      ? task.result["entity_id"]
      : null;

  return resultEntityId || ((task as unknown as { entity_id?: string }).entity_id ?? "");
}

export function useReceivingSessionData(task: WorkflowTask) {
  const entityId = getTaskEntityId(task);
  const { products, loading: productsLoading } = useProducts();
  const { locations, loading: locationsLoading } = useWarehouseLocations();

  const [voucher, setVoucher] = useState<ReceivingVoucherDoc | null>(null);
  const [rawItems, setRawItems] = useState<ReceivingItemDoc[]>([]);
  const [loadingVoucher, setLoadingVoucher] = useState(Boolean(entityId));
  const [loadingItems, setLoadingItems] = useState(Boolean(entityId));

  const productsById = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products],
  );
  const locationsById = useMemo(
    () => new Map(locations.map((location) => [location.id, location])),
    [locations],
  );

  useEffect(() => {
    if (!entityId) {
      setVoucher(null);
      setRawItems([]);
      setLoadingVoucher(false);
      setLoadingItems(false);
      return;
    }

    setLoadingVoucher(true);
    setLoadingItems(true);

    const unsubVoucher = onSnapshot(
      doc(db, "import_vouchers", entityId),
      (snapshot) => {
        setVoucher(snapshot.exists() ? (snapshot.data() as ReceivingVoucherDoc) : null);
        setLoadingVoucher(false);
      },
      (error) => {
        console.error("[useReceivingSessionData] voucher error:", error);
        setVoucher(null);
        setLoadingVoucher(false);
      },
    );

    const unsubItems = onSnapshot(
      query(
        collection(db, "import_vouchers", entityId, "items"),
        where("is_deleted", "==", false),
      ),
      (snapshot) => {
        setRawItems(
          snapshot.docs.map((itemDoc) => ({
            id: itemDoc.id,
            ...(itemDoc.data() as Omit<ReceivingItemDoc, "id">),
          })),
        );
        setLoadingItems(false);
      },
      (error) => {
        console.error("[useReceivingSessionData] items error:", error);
        setRawItems([]);
        setLoadingItems(false);
      },
    );

    return () => {
      unsubVoucher();
      unsubItems();
    };
  }, [entityId]);

  const items = useMemo<ReceivingItem[]>(() => {
    return rawItems.map((item) => {
      const product = productsById.get(item.product_id ?? "");
      const location = locationsById.get(item.warehouse_location_id ?? "");
      const display = resolveProductDisplay(product, {
        productId: item.product_id,
        productName: item.product_name,
        productSku: item.product_code ?? item.product_sku,
        barcode: item.barcode,
      });

      return {
        id: item.id,
        product_id: item.product_id ?? "",
        product_name: display.name,
        product_sku: display.sku,
        product_barcode: display.barcode,
        product_image_url: getFirstImageUrl(
          item.product_image_url,
          product?.product_image_url,
        ),
        warehouse_location_id: item.warehouse_location_id ?? "",
        location_name: resolveLocationDisplay(
          location,
          item.location_name,
          item.warehouse_location_id,
        ),
        expected_quantity: item.expected_quantity ?? 0,
        actual_quantity: item.actual_quantity ?? item.expected_quantity ?? 0,
        notes: item.notes ?? "",
      };
    });
  }, [locationsById, productsById, rawItems]);

  return {
    voucherId: entityId,
    voucherNumber: voucher?.voucher_number ?? "",
    supplierName: voucher?.supplier_name ?? "",
    items,
    isLoading: loadingVoucher || loadingItems || productsLoading || locationsLoading,
  };
}

export function usePickingSessionData(voucherId: string) {
  const { products, loading: productsLoading } = useProducts();
  const { locations, loading: locationsLoading } = useWarehouseLocations();

  const [voucher, setVoucher] = useState<PickingVoucherDoc | null>(null);
  const [rawItems, setRawItems] = useState<Array<Record<string, unknown>>>([]);
  const [loadingVoucher, setLoadingVoucher] = useState(Boolean(voucherId));
  const [loadingItems, setLoadingItems] = useState(Boolean(voucherId));

  const productsById = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products],
  );
  const locationsById = useMemo(
    () => new Map(locations.map((location) => [location.id, location])),
    [locations],
  );

  useEffect(() => {
    if (!voucherId) {
      setVoucher(null);
      setRawItems([]);
      setLoadingVoucher(false);
      setLoadingItems(false);
      return;
    }

    setLoadingVoucher(true);
    setLoadingItems(true);

    const unsubVoucher = onSnapshot(
      doc(db, "export_vouchers", voucherId),
      (snapshot) => {
        setVoucher(snapshot.exists() ? (snapshot.data() as PickingVoucherDoc) : null);
        setLoadingVoucher(false);
      },
      (error) => {
        console.error("[usePickingSessionData] voucher error:", error);
        setVoucher(null);
        setLoadingVoucher(false);
      },
    );

    const unsubItems = onSnapshot(
      query(
        collection(db, "export_vouchers", voucherId, "items"),
        where("is_deleted", "==", false),
      ),
      (snapshot) => {
        setRawItems(
          snapshot.docs.map((itemDoc) => ({
            id: itemDoc.id,
            ...itemDoc.data(),
          })),
        );
        setLoadingItems(false);
      },
      (error) => {
        console.error("[usePickingSessionData] items error:", error);
        setRawItems([]);
        setLoadingItems(false);
      },
    );

    return () => {
      unsubVoucher();
      unsubItems();
    };
  }, [voucherId]);

  const items = useMemo<PickingItem[]>(() => {
    return rawItems.map((item) => {
      const productId = typeof item.product_id === "string" ? item.product_id : "";
      const locationId =
        typeof item.warehouse_location_id === "string" ? item.warehouse_location_id : "";
      const product = productsById.get(productId);
      const location = locationsById.get(locationId);
      const display = resolveProductDisplay(product, {
        productId,
        productName: typeof item.product_name === "string" ? item.product_name : null,
        productSku:
          typeof item.product_code === "string"
            ? item.product_code
            : typeof item.product_sku === "string"
              ? item.product_sku
              : null,
        barcode: typeof item.barcode === "string" ? item.barcode : null,
      });

      return {
        id: typeof item.id === "string" ? item.id : "",
        product_id: productId,
        product_name: display.name,
        product_code: display.sku,
        product_barcode: display.barcode,
        product_image_url: getFirstImageUrl(
          item.product_image_url as string[] | string | null | undefined,
          product?.product_image_url,
        ),
        warehouse_location_id: locationId,
        location_name: resolveLocationDisplay(
          location,
          typeof item.location_name === "string" ? item.location_name : null,
          locationId,
        ),
        quantity: typeof item.quantity === "number" ? item.quantity : 0,
        picked_quantity:
          typeof item.picked_quantity === "number" ? item.picked_quantity : 0,
        notes: typeof item.notes === "string" ? item.notes : "",
      };
    });
  }, [locationsById, productsById, rawItems]);

  return {
    voucherNumber: voucher?.voucher_number ?? "",
    items,
    isLoading: loadingVoucher || loadingItems || productsLoading || locationsLoading,
    exists: Boolean(voucher),
  };
}
