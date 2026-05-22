'use client';

import { useEffect, useState } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { ProductCategory } from '@bduck/shared-types';

/**
 * Realtime Firestore listener cho danh mục sản phẩm (LUẬT THÉP: onSnapshot)
 * Tự động cập nhật khi có thay đổi trên server.
 */
export const useCategories = () => {
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query(
      collection(db, 'product_categories'),
      where('is_deleted', '==', false),
      orderBy('created_at', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map(doc => ({
          ...doc.data(),
          id: doc.id,
        })) as ProductCategory[];

        setCategories(data);
        setIsLoading(false);
        setError(null);
      },
      (err) => {
        console.error('[useCategories] onSnapshot error:', err);
        setError(err.message);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  return { categories, isLoading, error };
};
