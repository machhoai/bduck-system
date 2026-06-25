"use client";

/**
 * useApprovalTasks - realtime Firebase listener for actionable approvals.
 *
 * Reads pending approvals, keeps only the current pending level per entity, then
 * applies the current user's role + warehouse/global scope locally.
 */

import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useUserStore } from "@/stores/useUserStore";
import type { ApprovalRecord } from "@bduck/shared-types";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://api.wms.localhost";

interface UseApprovalTasksReturn {
  myTasks: ApprovalRecord[];
  selfCreatedIds: Set<string>;
  loading: boolean;
  taskCount: number;
}

function toTime(value: unknown): number {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();

  if (typeof value === "object" && value !== null) {
    const timestamp = value as {
      toDate?: () => Date;
      toMillis?: () => number;
      seconds?: number;
      _seconds?: number;
    };

    if (typeof timestamp.toDate === "function") {
      try {
        const date = timestamp.toDate();
        return Number.isNaN(date.getTime()) ? 0 : date.getTime();
      } catch {
        // Firestore Timestamp methods rely on their original receiver.
      }
    }

    if (typeof timestamp.toMillis === "function") {
      try {
        return timestamp.toMillis();
      } catch {
        return 0;
      }
    }

    if (typeof timestamp.seconds === "number") return timestamp.seconds * 1000;
    if (typeof timestamp._seconds === "number") return timestamp._seconds * 1000;
  }

  const time = new Date(value as string | number).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function getEntityKey(record: ApprovalRecord): string {
  return `${record.entity_type}:${record.entity_id}`;
}

function filterCurrentPendingLevel(records: ApprovalRecord[]): ApprovalRecord[] {
  const currentLevelByEntity = new Map<string, number>();

  records.forEach((record) => {
    const key = getEntityKey(record);
    const current = currentLevelByEntity.get(key);
    if (current === undefined || record.level < current) {
      currentLevelByEntity.set(key, record.level);
    }
  });

  return records.filter(
    (record) => currentLevelByEntity.get(getEntityKey(record)) === record.level,
  );
}

async function fetchPendingApprovalsFromApi(): Promise<ApprovalRecord[]> {
  const response = await fetch(`${API_BASE_URL}/api/approvals/pending`, {
    method: "GET",
    credentials: "include",
  });
  const body = await response.json().catch(() => null);

  if (!response.ok || !body?.success) {
    throw new Error(body?.messages?.vi || "Khong the tai cong viec cho duyet.");
  }

  return (body.data || []) as ApprovalRecord[];
}

export function useApprovalTasks(): UseApprovalTasksReturn {
  const [allRecords, setAllRecords] = useState<ApprovalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const user = useUserStore((s) => s.user);
  const userRoleIds = useUserStore((s) => s.roleIds);
  const hasScopedRole = useUserStore((s) => s.hasScopedRole);

  useEffect(() => {
    if (!user?.id || userRoleIds.length === 0) {
      setAllRecords([]);
      setLoading(false);
      return;
    }

    const applyRecords = (records: ApprovalRecord[]) => {
      const currentLevelRecords = filterCurrentPendingLevel(records);

      currentLevelRecords.sort((a, b) => {
        return toTime(b.created_at) - toTime(a.created_at);
      });

      setAllRecords(
        currentLevelRecords.filter((record) =>
          hasScopedRole(
            record.role_id,
            record.approval_warehouse_id === undefined
              ? record.warehouse_id
              : record.approval_warehouse_id,
            {
              allowGlobalFallback: record.allow_global_fallback === true,
              requireGlobal: record.approval_scope === "GLOBAL",
            },
          ),
        ),
      );
      setLoading(false);
    };

    const q = query(
      collection(db, "pending_approvals"),
      where("status", "==", "PENDING"),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const records: ApprovalRecord[] = [];
        snapshot.forEach((doc) => {
          records.push({ id: doc.id, ...doc.data() } as ApprovalRecord);
        });

        applyRecords(records);
      },
      async (error) => {
        console.error("[useApprovalTasks] onSnapshot error:", error);
        try {
          applyRecords(await fetchPendingApprovalsFromApi());
        } catch (apiError) {
          console.error("[useApprovalTasks] API fallback error:", apiError);
          setLoading(false);
        }
      },
    );

    return () => unsubscribe();
  }, [hasScopedRole, user?.id, userRoleIds]);

  const selfCreatedIds = useMemo(() => {
    if (!user?.id) return new Set<string>();
    return new Set(
      allRecords
        .filter((record) => record.creator_id === user.id)
        .map((record) => record.id),
    );
  }, [allRecords, user?.id]);

  return {
    myTasks: allRecords,
    selfCreatedIds,
    loading,
    taskCount: allRecords.length,
  };
}
