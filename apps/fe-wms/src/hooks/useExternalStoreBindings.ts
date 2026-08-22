"use client";

import type { ExternalStoreBinding } from "@bduck/shared-types";
import { onAuthStateChanged } from "firebase/auth";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { useEffect, useState } from "react";

import { auth, db } from "@/lib/firebase";

export function useExternalStoreBindings() {
  const [bindings, setBindings] = useState<ExternalStoreBinding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let unsubscribeSnapshot: (() => void) | undefined;
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      unsubscribeSnapshot?.();
      unsubscribeSnapshot = undefined;
      if (!user) {
        setBindings([]);
        setLoading(false);
        return;
      }
      unsubscribeSnapshot = onSnapshot(
        query(
          collection(db, "external_store_bindings"),
          where("enabled", "==", true),
        ),
        (snapshot) => {
          setBindings(
            snapshot.docs.map(
              (document) =>
                ({ id: document.id, ...document.data() }) as ExternalStoreBinding,
            ),
          );
          setLoading(false);
          setError(null);
        },
        (snapshotError) => {
          setBindings([]);
          setLoading(false);
          setError(snapshotError.message);
        },
      );
    });
    return () => {
      unsubscribeAuth();
      unsubscribeSnapshot?.();
    };
  }, []);

  return { bindings, loading, error };
}
