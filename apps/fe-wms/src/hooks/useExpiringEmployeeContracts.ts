"use client";

import {
  EMPLOYEE_CONTRACT_EXPIRY_WARNING_DAYS,
  EmployeeContractStatus,
  EmployeeContractType,
  addContractLocalDays,
  differenceInContractLocalDays,
  type EmployeeContractExpiryView,
} from "@bduck/shared-types";
import { onAuthStateChanged } from "firebase/auth";
import {
  orderBy,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { fetchExpiringEmployeeContracts } from "@/api/employeeContractApi";
import { subscribeDataMutation } from "@/lib/dataInvalidation";
import { auth, db } from "@/lib/firebase";
import {
  buildFacilityScopedQueries,
  subscribeToMergedQueries,
} from "@/lib/scopedFirestore";
import { useUserStore } from "@/stores/useUserStore";
import { getFacilityPermissionScope } from "@/utils/facilityPermissionScope";

const getVietnamDate = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

const mapContract = (
  document: QueryDocumentSnapshot<DocumentData>,
  asOfDate: string,
): EmployeeContractExpiryView => {
  const data = document.data();
  const endDate = String(data.end_date);
  return {
    ...data,
    id: document.id,
    days_until_expiry:
      differenceInContractLocalDays(endDate, asOfDate) ?? 0,
    employee_code: "",
    employee_name: "",
  } as EmployeeContractExpiryView;
};

export const useExpiringEmployeeContracts = (
  fallbackMessage: string,
  featureEnabled = true,
) => {
  const permissions = useUserStore((state) => state.permissions);
  const scope = useMemo(
    () =>
      getFacilityPermissionScope(permissions, ["employees.contracts.read"]),
    [permissions],
  );
  const enabled =
    featureEnabled && (scope.isSystemAdmin || scope.facilityIds.length > 0);
  const [contracts, setContracts] = useState<EmployeeContractExpiryView[]>([]);
  const [isLoading, setIsLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<"realtime" | "api">("realtime");

  useEffect(() => {
    if (!enabled) {
      setContracts([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    const abortController = new AbortController();
    let disposed = false;
    let unsubscribeSnapshot: (() => void) | undefined;
    const asOfDate = getVietnamDate();
    const deadline = addContractLocalDays(
      asOfDate,
      EMPLOYEE_CONTRACT_EXPIRY_WARNING_DAYS,
    );
    const loadFallback = async () => {
      try {
        const records = await fetchExpiringEmployeeContracts(
          fallbackMessage,
          abortController.signal,
        );
        if (!disposed) {
          setContracts(records);
          setSource("api");
          setError(null);
        }
      } catch (fallbackError) {
        if (!disposed) {
          console.error(
            "[useExpiringEmployeeContracts] API fallback error:",
            fallbackError,
          );
          setError(
            fallbackError instanceof Error
              ? fallbackError.message
              : fallbackMessage,
          );
        }
      } finally {
        if (!disposed) setIsLoading(false);
      }
    };
    const unsubscribeMutation = subscribeDataMutation(
      ["employee_contracts"],
      () => void loadFallback(),
    );
    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      unsubscribeSnapshot?.();
      if (!firebaseUser || !deadline) {
        void loadFallback();
        return;
      }
      const statuses = [
        EmployeeContractStatus.UPCOMING,
        EmployeeContractStatus.ACTIVE,
      ];
      unsubscribeSnapshot = subscribeToMergedQueries({
        queries: statuses.flatMap((status) =>
          buildFacilityScopedQueries({
            db,
            collectionName: "employee_contracts",
            facilityField: "workplace_warehouse_id",
            scope,
            constraints: [
              where("status", "==", status),
              where("is_deleted", "==", false),
              where("end_date", ">=", asOfDate),
              where("end_date", "<=", deadline),
              orderBy("end_date", "asc"),
            ],
          }),
        ),
        mapDocument: (document) => mapContract(document, asOfDate),
        onData: (records) => {
          if (disposed) return;
          setContracts(
            records
              .filter(
                (contract) =>
                  contract.contract_type !== EmployeeContractType.SEASONAL,
              )
              .sort((left, right) =>
                (left.end_date ?? "").localeCompare(right.end_date ?? ""),
              ),
          );
          setSource("realtime");
          setIsLoading(false);
          setError(null);
        },
        onError: () => void loadFallback(),
      });
    });
    return () => {
      disposed = true;
      abortController.abort();
      unsubscribeAuth();
      unsubscribeMutation();
      unsubscribeSnapshot?.();
    };
  }, [enabled, fallbackMessage, scope]);

  return { contracts, isLoading, error, source };
};
