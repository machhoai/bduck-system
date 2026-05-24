"use client";

import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { useCallback, useEffect, useState } from "react";
import type { Product } from "@bduck/shared-types";
import { auth, db } from "@/lib/firebase";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://api.wms.localhost";

interface ProductsApiResponse {
  data?: Product[] | { data?: Product[]; total?: number };
}

function normalizeProductsResponse(body: ProductsApiResponse): Product[] {
  if (Array.isArray(body.data)) return body.data;
  if (Array.isArray(body.data?.data)) return body.data.data;
  return [];
}

async function fetchProductsFromApi(categoryId?: string, signal?: AbortSignal) {
  const params = new URLSearchParams({ limit: "100" });
  if (categoryId) {
    params.set("category_id", categoryId);
  }

  const response = await fetch(`${API_BASE_URL}/api/products?${params}`, {
    method: "GET",
    credentials: "include",
    signal,
  });

  const body = await response.json().catch(() => null);

  if (!response.ok || !body?.success) {
    throw new Error(
      body?.messages?.vi || "Có lỗi xảy ra khi tải danh sách sản phẩm",
    );
  }

  return normalizeProductsResponse(body);
}

export function useProducts(categoryId?: string) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const abortController = new AbortController();
    let unsubscribeSnapshot: (() => void) | undefined;
    let isDisposed = false;

    setLoading(true);

    const loadApiFallback = async (reason: string) => {
      try {
        const data = await fetchProductsFromApi(
          categoryId,
          abortController.signal,
        );
        if (isDisposed) return;

        setProducts(data);
        setError(null);
      } catch (apiError) {
        if (isDisposed) return;

        const nextError =
          apiError instanceof Error
            ? apiError
            : new Error("Có lỗi xảy ra khi tải danh sách sản phẩm");
        console.error("[useProducts] API fallback error:", apiError);
        setProducts([]);
        setError(nextError);
      } finally {
        if (!isDisposed) {
          setLoading(false);
        }
      }
    };

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

      let productsQuery = query(
        collection(db, "products"),
        where("is_deleted", "==", false),
      );

      if (categoryId) {
        productsQuery = query(
          productsQuery,
          where("category_id", "==", categoryId),
        );
      }

      productsQuery = query(productsQuery, orderBy("created_at", "desc"));

      unsubscribeSnapshot = onSnapshot(
        productsQuery,
        (snapshot) => {
          if (isDisposed) return;

          const data = snapshot.docs.map((doc) => ({
            ...doc.data(),
            id: doc.id,
          })) as Product[];

          setProducts(data);
          setLoading(false);
          setError(null);
        },
        (snapshotError) => {
          console.warn(
            "[useProducts] Lỗi khi subscribe snapshot:",
            snapshotError,
          );
          void loadApiFallback(snapshotError.message);
        },
      );
    });

    return () => {
      isDisposed = true;
      abortController.abort();
      unsubscribeAuth();
      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
      }
    };
  }, [categoryId]);

  const callProductApi = useCallback(
    async (
      method: "POST" | "PUT" | "DELETE",
      id?: string,
      payload?: unknown,
    ) => {
      const url = id
        ? `${API_BASE_URL}/api/products/${id}`
        : `${API_BASE_URL}/api/products`;

      const response = await fetch(url, {
        method,
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: payload ? JSON.stringify(payload) : undefined,
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.success) {
        const errorMsg = data?.messages?.vi || "Có lỗi xảy ra khi gọi API";
        throw new Error(errorMsg);
      }

      return data;
    },
    [],
  );

  const createProduct = useCallback(
    (payload: unknown) => callProductApi("POST", undefined, payload),
    [callProductApi],
  );
  const updateProduct = useCallback(
    (id: string, payload: unknown) => callProductApi("PUT", id, payload),
    [callProductApi],
  );
  const deleteProduct = useCallback(
    (id: string) => callProductApi("DELETE", id),
    [callProductApi],
  );

  return {
    products,
    loading,
    error,
    createProduct,
    updateProduct,
    deleteProduct,
  };
}
