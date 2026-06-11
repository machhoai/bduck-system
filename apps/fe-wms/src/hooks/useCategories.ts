"use client";

import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import type { ProductCategory } from "@bduck/shared-types";
import { subscribeDataMutation } from "@/lib/dataInvalidation";
import { createDetailedApiError } from "@/utils/apiError";
import { auth, db } from "../lib/firebase";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://api.wms.localhost";

async function fetchCategoriesFromApi(signal?: AbortSignal) {
  const response = await fetch(`${API_BASE_URL}/api/categories`, {
    method: "GET",
    credentials: "include",
    signal,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw createDetailedApiError(response, errorData, "Khong the tai danh sach danh muc.");
  }

  const body = await response.json();
  return (body.data || []) as ProductCategory[];
}

/**
 * Primary source: Firestore realtime listener.
 * Fallback source: REST API, used when client Firestore rules/auth block reads.
 */
export const useCategories = () => {
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const abortController = new AbortController();
    let unsubscribeSnapshot: (() => void) | undefined;
    let isDisposed = false;

    const loadApiFallback = async (reason: string) => {
      try {
        const data = await fetchCategoriesFromApi(abortController.signal);
        if (isDisposed) return;

        setCategories(data);
        setError(null);
      } catch (apiError) {
        if (isDisposed) return;

        const message =
          apiError instanceof Error
            ? apiError.message
            : "Không thể tải danh mục.";
        console.error("[useCategories] API fallback error:", apiError);
        setCategories([]);
        setError(message);
      } finally {
        if (!isDisposed) {
          setIsLoading(false);
        }
      }
    };

    const unsubscribeMutation = subscribeDataMutation(
      "product_categories",
      () => {
        void loadApiFallback("Categories changed locally.");
      },
    );

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

      const categoriesQuery = query(
        collection(db, "product_categories"),
        where("is_deleted", "==", false),
        orderBy("created_at", "desc"),
      );

      unsubscribeSnapshot = onSnapshot(
        categoriesQuery,
        (snapshot) => {
          if (isDisposed) return;

          const data = snapshot.docs.map((doc) => ({
            ...doc.data(),
            id: doc.id,
          })) as ProductCategory[];

          setCategories(data);
          setIsLoading(false);
          setError(null);
        },
        (snapshotError) => {
          console.warn("[useCategories] onSnapshot error:", snapshotError);
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
  }, []);

  return { categories, isLoading, error };
};
