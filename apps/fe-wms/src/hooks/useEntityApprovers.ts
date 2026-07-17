"use client";

import { doc, getDoc, where } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";
import {
  buildFacilityScopedQueries,
  subscribeToMergedQueries,
} from "@/lib/scopedFirestore";
import { useUserStore } from "@/stores/useUserStore";
import { getAnyFacilityScope } from "@/utils/facilityPermissionScope";

interface ApproverRecord {
  id: string;
  name: string;
  approved_at: Date | null;
  level: number;
}

function toDate(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (value && typeof value === "object" && "toDate" in value) {
    const converter = (value as { toDate?: () => Date }).toDate;
    return typeof converter === "function" ? converter.call(value) : null;
  }
  return null;
}

export function useEntityApprovers(entityId: string) {
  const permissions = useUserStore((state) => state.permissions);
  const facilityScope = useMemo(
    () => getAnyFacilityScope(permissions),
    [permissions],
  );
  const [approvers, setApprovers] = useState<ApproverRecord[]>([]);

  useEffect(() => {
    if (!entityId) {
      setApprovers([]);
      return;
    }
    return subscribeToMergedQueries<ApproverRecord>({
      queries: buildFacilityScopedQueries({
        db,
        collectionName: "pending_approvals",
        facilityField: "approval_warehouse_id",
        scope: facilityScope,
        constraints: [
          where("entity_id", "==", entityId),
          where("status", "==", "APPROVED"),
        ],
      }),
      mapDocument: (document) => ({
        id: String(document.data().approver_id || document.id),
        name: String(document.data().approver_id || document.id),
        approved_at: toDate(document.data().approved_at),
        level: Number(document.data().level || 0),
      }),
      onData: async (records) => {
        records.sort((left, right) => left.level - right.level);
        const resolved = await Promise.all(
          records.map(async (record) => {
            try {
              const snapshot = await getDoc(doc(db, "users", record.id));
              const user = snapshot.data();
              return {
                ...record,
                name: String(user?.full_name || user?.email || record.id),
              };
            } catch {
              return record;
            }
          }),
        );
        setApprovers(resolved);
      },
      onError: (error) => {
        console.error("[useEntityApprovers] snapshot error:", error);
        setApprovers([]);
      },
    });
  }, [entityId, facilityScope]);

  return approvers;
}
