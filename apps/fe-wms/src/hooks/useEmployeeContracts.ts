"use client";

import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
  type DocumentData,
  type QueryConstraint,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  EmployeeContract,
  EmployeeContractDocument,
} from "@bduck/shared-types";
import {
  fetchEmployeeContractDocuments,
  fetchEmployeeContracts,
} from "@/api/employeeContractApi";
import {
  subscribeDataMutation,
  type DataInvalidationKey,
} from "@/lib/dataInvalidation";
import { auth, db } from "@/lib/firebase";

const toDate = (value: unknown): Date => {
  if (value instanceof Date) return value;
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof (value as { toDate: unknown }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate();
  }
  return new Date(value as string | number);
};

const CONTRACT_INVALIDATION_KEYS: DataInvalidationKey[] = [
  "employee_contracts",
];
const DOCUMENT_INVALIDATION_KEYS: DataInvalidationKey[] = [
  "employee_contract_documents",
];

const mapDates = <T>(
  document: QueryDocumentSnapshot<DocumentData>,
  nullableDateFields: string[] = [],
): T => {
  const data = { ...document.data(), id: document.id } as Record<
    string,
    unknown
  >;
  for (const field of [
    "created_at",
    "updated_at",
    "action_time",
    "sync_time",
  ]) {
    data[field] = toDate(data[field]);
  }
  for (const field of nullableDateFields) {
    data[field] = data[field] == null ? null : toDate(data[field]);
  }
  return data as T;
};

const mapContract = (document: QueryDocumentSnapshot<DocumentData>) =>
  mapDates<EmployeeContract>(document, ["terminated_at", "cancelled_at"]);

const mapContractDocument = (document: QueryDocumentSnapshot<DocumentData>) =>
  mapDates<EmployeeContractDocument>(document);

interface RealtimeCollectionOptions<T> {
  enabled: boolean;
  collectionName: string;
  constraints: QueryConstraint[];
  invalidationKeys: DataInvalidationKey[];
  fallback: (signal: AbortSignal) => Promise<T[]>;
  mapDocument: (document: QueryDocumentSnapshot<DocumentData>) => T;
  fallbackMessage: string;
}

const useRealtimeCollection = <T>({
  enabled,
  collectionName,
  constraints,
  invalidationKeys,
  fallback,
  mapDocument,
  fallbackMessage,
}: RealtimeCollectionOptions<T>) => {
  const [records, setRecords] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<"realtime" | "api">("realtime");

  useEffect(() => {
    if (!enabled) {
      setRecords([]);
      setIsLoading(false);
      setError(null);
      return;
    }
    setRecords([]);
    setIsLoading(true);
    setError(null);
    const abortController = new AbortController();
    let unsubscribeSnapshot: (() => void) | undefined;
    let disposed = false;
    const loadFallback = async () => {
      try {
        const data = await fallback(abortController.signal);
        if (disposed) return;
        setRecords(data);
        setSource("api");
        setError(null);
      } catch (fallbackError) {
        if (disposed) return;
        console.error(`[${collectionName}] API fallback error:`, fallbackError);
        setError(
          fallbackError instanceof Error
            ? fallbackError.message
            : fallbackMessage,
        );
      } finally {
        if (!disposed) setIsLoading(false);
      }
    };
    const unsubscribeMutation = subscribeDataMutation(
      invalidationKeys,
      () => void loadFallback(),
    );
    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      unsubscribeSnapshot?.();
      if (!firebaseUser) {
        void loadFallback();
        return;
      }
      unsubscribeSnapshot = onSnapshot(
        query(collection(db, collectionName), ...constraints),
        (snapshot) => {
          if (disposed) return;
          setRecords(snapshot.docs.map(mapDocument));
          setSource("realtime");
          setIsLoading(false);
          setError(null);
        },
        () => void loadFallback(),
      );
    });
    return () => {
      disposed = true;
      abortController.abort();
      unsubscribeAuth();
      unsubscribeMutation();
      unsubscribeSnapshot?.();
    };
  }, [
    collectionName,
    constraints,
    enabled,
    fallback,
    fallbackMessage,
    invalidationKeys,
    mapDocument,
  ]);

  return { records, isLoading, error, source };
};

export const useEmployeeContracts = (
  profileId: string | null,
  employeeUserId: string | null,
  workplaceId: string | null,
  fallbackMessage: string,
) => {
  const constraints = useMemo(() => {
    const filters: QueryConstraint[] = profileId
      ? [where("employee_profile_id", "==", profileId)]
      : [];
    if (employeeUserId) {
      filters.push(where("employee_user_id", "==", employeeUserId));
    }
    if (workplaceId) {
      filters.push(where("workplace_warehouse_id", "==", workplaceId));
    }
    filters.push(
      where("is_deleted", "==", false),
      orderBy("start_date", "desc"),
    );
    return filters;
  }, [employeeUserId, profileId, workplaceId]);
  const fallback = useCallback(
    (signal: AbortSignal) =>
      fetchEmployeeContracts(profileId!, fallbackMessage, signal),
    [fallbackMessage, profileId],
  );
  const state = useRealtimeCollection<EmployeeContract>({
    enabled: Boolean(profileId && workplaceId),
    collectionName: "employee_contracts",
    constraints,
    invalidationKeys: CONTRACT_INVALIDATION_KEYS,
    fallback,
    mapDocument: mapContract,
    fallbackMessage,
  });
  return { ...state, contracts: state.records };
};

export const useEmployeeContractDocuments = (
  profileId: string | null,
  contractId: string | null,
  employeeUserId: string | null,
  workplaceId: string | null,
  fallbackMessage: string,
) => {
  const constraints = useMemo(() => {
    const filters: QueryConstraint[] = contractId
      ? [where("contract_id", "==", contractId)]
      : [];
    if (employeeUserId) {
      filters.push(where("employee_user_id", "==", employeeUserId));
    }
    if (workplaceId) {
      filters.push(where("workplace_warehouse_id", "==", workplaceId));
    }
    filters.push(where("is_deleted", "==", false), orderBy("version", "desc"));
    return filters;
  }, [contractId, employeeUserId, workplaceId]);
  const fallback = useCallback(
    (signal: AbortSignal) =>
      fetchEmployeeContractDocuments(
        profileId!,
        contractId!,
        fallbackMessage,
        signal,
      ),
    [contractId, fallbackMessage, profileId],
  );
  const state = useRealtimeCollection<EmployeeContractDocument>({
    enabled: Boolean(profileId && contractId && workplaceId),
    collectionName: "employee_contract_documents",
    constraints,
    invalidationKeys: DOCUMENT_INVALIDATION_KEYS,
    fallback,
    mapDocument: mapContractDocument,
    fallbackMessage,
  });
  return { ...state, documents: state.records };
};
