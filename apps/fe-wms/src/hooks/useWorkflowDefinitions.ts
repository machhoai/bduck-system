"use client";

/**
 * useWorkflowDefinitions - Realtime Firestore listener with API fallback.
 *
 * The workflow editor writes through the backend API. This hook keeps the
 * direct Firestore listener when it is available, but falls back to the same
 * backend API when Firebase Auth/rules/indexes prevent client-side reads.
 */

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { subscribeDataMutation } from "@/lib/dataInvalidation";
import { auth, db } from "@/lib/firebase";
import type { WorkflowDefinition } from "@bduck/shared-types";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://api.wms.localhost";

export interface WorkflowDefinitionView
  extends Omit<WorkflowDefinition, "created_at" | "updated_at"> {
  created_at: Date;
  updated_at: Date;
}

type WorkflowDefinitionRecord = Omit<
  WorkflowDefinition,
  "created_at" | "updated_at"
> & {
  created_at?: Date | string | { toDate?: () => Date } | null;
  updated_at?: Date | string | { toDate?: () => Date } | null;
};

type WorkflowsApiResponse = {
  success?: boolean;
  data?: WorkflowDefinitionRecord[];
  messages?: { vi?: string; zh?: string };
};

function toDate(value: WorkflowDefinitionRecord["created_at"]) {
  if (value instanceof Date) return value;
  if (typeof value === "string") return new Date(value);
  if (value?.toDate) return value.toDate();
  return new Date();
}

function normalizeDefinition(
  definition: WorkflowDefinitionRecord,
  fallbackId?: string,
): WorkflowDefinitionView {
  return {
    ...definition,
    id: definition.id || fallbackId || "",
    created_at: toDate(definition.created_at),
    updated_at: toDate(definition.updated_at),
  } as WorkflowDefinitionView;
}

async function fetchWorkflowDefinitionsFromApi(signal?: AbortSignal) {
  const response = await fetch(`${API_BASE_URL}/api/workflows`, {
    method: "GET",
    credentials: "include",
    signal,
  });

  const body = (await response
    .json()
    .catch(() => null)) as WorkflowsApiResponse | null;

  if (!response.ok || !body?.success) {
    throw new Error(
      body?.messages?.vi || "Không thể tải danh sách quy trình.",
    );
  }

  return (body.data || []).map((definition) =>
    normalizeDefinition(definition),
  );
}

export function useWorkflowDefinitions() {
  const [definitions, setDefinitions] = useState<WorkflowDefinitionView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const abortController = new AbortController();
    let unsubscribeSnapshot: (() => void) | undefined;
    let isDisposed = false;

    const loadApiFallback = async (reason: string) => {
      try {
        const data = await fetchWorkflowDefinitionsFromApi(
          abortController.signal,
        );
        if (isDisposed) return;

        setDefinitions(data);
        setError(null);
      } catch (apiError) {
        if (isDisposed) return;

        console.error("[useWorkflowDefinitions] API fallback error:", {
          reason,
          error: apiError,
        });
        setDefinitions([]);
        setError(
          apiError instanceof Error
            ? apiError.message
            : "Không thể tải danh sách quy trình.",
        );
      } finally {
        if (!isDisposed) {
          setLoading(false);
        }
      }
    };

    const unsubscribeMutation = subscribeDataMutation(
      "workflow_definitions",
      () => {
        void loadApiFallback("Workflow definitions changed locally.");
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

      // Note: compound query (is_deleted + orderBy created_at) needs composite index.
      // Use single-field filter + client-side sort to work on fresh setups.
      const q = query(
        collection(db, "workflow_definitions"),
        where("is_deleted", "==", false),
      );

      unsubscribeSnapshot = onSnapshot(
        q,
        (snapshot) => {
          if (isDisposed) return;

          if (snapshot.empty) {
            void loadApiFallback("Realtime snapshot returned no workflows.");
            return;
          }

          const data = snapshot.docs
            .map((doc) =>
              normalizeDefinition(doc.data() as WorkflowDefinitionRecord, doc.id),
            )
            .sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
          setDefinitions(data);
          setLoading(false);
          setError(null);
        },
        (snapshotError) => {
          if (isDisposed) return;
          console.error(
            "[useWorkflowDefinitions] onSnapshot error:",
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
      unsubscribeSnapshot?.();
    };
  }, []);

  return { definitions, loading, error };
}
