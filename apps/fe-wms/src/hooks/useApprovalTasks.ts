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
  loading: boolean;
  taskCount: number;
}

export function useApprovalTasks(): UseApprovalTasksReturn {
  const [allRecords, setAllRecords] = useState<ApprovalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const user = useUserStore((s) => s.user);
  const userRoleIds = useUserStore((s) => s.roleIds);

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
          const aTime = a.created_at instanceof Date
            ? a.created_at.getTime()
            : new Date(a.created_at as unknown as string).getTime();
          const bTime = b.created_at instanceof Date
            ? b.created_at.getTime()
            : new Date(b.created_at as unknown as string).getTime();
          return bTime - aTime;
        });

        setAllRecords(records);
        setLoading(false);
      },
      (error) => {
        console.error("[useApprovalTasks] onSnapshot error:", error);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [user?.id, userRoleIds]);

  // Self-Approval Block: filter out tasks where current user is the creator
  const myTasks = useMemo(() => {
    if (!user?.id) return [];
    return allRecords.filter((record) => record.creator_id !== user.id);
  }, [allRecords, user?.id]);

  return {
    myTasks,
    loading,
    taskCount: myTasks.length,
  };
}
