"use client";

/**
 * useApprovalTasks — Realtime Firebase listener for pending approvals
 *
 * REPLACES: useWorkflowTasks (collectionGroup on "tasks" subcollection)
 *
 * NEW DESIGN:
 * - Queries flat `pending_approvals` collection (no collectionGroup index)
 * - Filters by role_id matching current user's roles
 * - Status = PENDING only (approved/rejected auto-disappear from inbox)
 *
 * LUẬT THÉP: No reload buttons. Tasks update via onSnapshot.
 */

import { useEffect, useState, useMemo } from "react";
import {
  collection,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useUserStore } from "@/stores/useUserStore";
import type { ApprovalRecord } from "@bduck/shared-types";

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

    // Firestore "in" supports up to 30 values — safe for role IDs
    const roleSlice = userRoleIds.slice(0, 30);

    console.log(
      `[useApprovalTasks] Querying pending_approvals with roleIds:`,
      roleSlice,
    );

    const q = query(
      collection(db, "pending_approvals"),
      where("role_id", "in", roleSlice),
      where("status", "==", "PENDING"),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const records: ApprovalRecord[] = [];
        snapshot.forEach((doc) => {
          records.push({ id: doc.id, ...doc.data() } as ApprovalRecord);
        });

        // Sort by created_at DESC (newest first)
        records.sort((a, b) => {
          return toTime(b.created_at) - toTime(a.created_at);
        });

        setAllRecords(
          records.filter((record) =>
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
      },
      (error) => {
        console.error("[useApprovalTasks] onSnapshot error:", error);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [hasScopedRole, user?.id, userRoleIds]);

  // Self-Approval Block: identify tasks where current user is the creator
  // These tasks are still VISIBLE but approval actions are DISABLED
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
