"use client";

import { onAuthStateChanged } from "firebase/auth";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { useCallback, useEffect, useState } from "react";
import type { ProductBOM } from "@bduck/shared-types";
import { emitDataMutation, subscribeDataMutation } from "@/lib/dataInvalidation";
import { auth, db } from "@/lib/firebase";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://api.wms.localhost";

async function fetchBomFromApi(productId: string, signal?: AbortSignal) {
  const response = await fetch(
    `${API_BASE_URL}/api/products/${productId}/bom`,
    {
      method: "GET",
      credentials: "include",
      signal,
    },
  );

  const body = await response.json().catch(() => null);

  if (!response.ok || !body?.success) {
    throw new Error(
      body?.messages?.vi || "Có lỗi xảy ra khi tải định mức sản phẩm",
    );
  }

  return (body.data || []) as ProductBOM[];
}

export function useProductBOM(productId?: string) {
  const [boms, setBoms] = useState<ProductBOM[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const abortController = new AbortController();
    let unsubscribeSnapshot: (() => void) | undefined;
    let isDisposed = false;

    setLoading(true);

    if (!productId) {
      setBoms([]);
      setLoading(false);
      return () => {
        abortController.abort();
      };
    }

    const loadApiFallback = async (reason: string) => {
      try {
        const data = await fetchBomFromApi(productId, abortController.signal);
        if (isDisposed) return;

        setBoms(data);
        setError(reason ? new Error(reason) : null);
      } catch (apiError) {
        if (isDisposed) return;

        const nextError =
          apiError instanceof Error
            ? apiError
            : new Error("Có lỗi xảy ra khi tải định mức sản phẩm");
        console.error("[useProductBOM] API fallback error:", apiError);
        setBoms([]);
        setError(nextError);
      } finally {
        if (!isDisposed) {
          setLoading(false);
        }
      }
    };

    const unsubscribeMutation = subscribeDataMutation("product_bom", () => {
      void loadApiFallback("Product BOM changed locally.");
    });

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
        unsubscribeSnapshot = undefined;
      }

      if (!user) {
        void loadApiFallback(
          "Firebase Auth chưa sẵn sàng cho realtime listener.",
        );
        return;
      }

      const bomQuery = query(
        collection(db, "product_bom"),
        where("parent_product_id", "==", productId),
        where("is_deleted", "==", false),
      );

      unsubscribeSnapshot = onSnapshot(
        bomQuery,
        (snapshot) => {
          if (isDisposed) return;

          const data = snapshot.docs.map((doc) => ({
            ...doc.data(),
            id: doc.id,
          })) as ProductBOM[];
          setBoms(data);
          setLoading(false);
          setError(null);
        },
        (snapshotError) => {
          console.error(
            "[useProductBOM] Lỗi khi subscribe snapshot:",
            snapshotError,
          );
          void loadApiFallback(snapshotError.message);
        },
      );
    });

    return () => {
      isDisposed = true;
      abortController.abort();
      unsubscribeMutation();
      unsubscribeAuth();
      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
      }
    };
  }, [productId]);

  const updateBOM = useCallback(
    async (
      parentId: string,
      payload: {
        bom_items: Array<{
          child_product_id: string;
          quantity: number;
          note: string | null;
        }>;
      },
    ) => {
      const response = await fetch(
        `${API_BASE_URL}/api/products/${parentId}/bom`,
        {
          method: "PUT",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      );

      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.success) {
        const errorMsg =
          data?.messages?.vi || "Có lỗi xảy ra khi cập nhật định mức";
        throw new Error(errorMsg);
      }

      emitDataMutation(["product_bom", "products", "audit_logs"]);
      return data;
    },
    [],
  );

  return {
    boms,
    loading,
    error,
    updateBOM,
  };
}
