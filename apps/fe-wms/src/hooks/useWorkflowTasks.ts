"use client";

/**
 * useWorkflowTasks — Realtime Firebase listener for workflow tasks
 *
 * LUẬT THÉP: No reload buttons. Tasks update via onSnapshot.
 *
 * Returns:
 * - myTasks: Tasks assigned to the current user's roles (PENDING/IN_PROGRESS)
 * - allTasks: All non-completed tasks (for supervisors)
 * - loading: Skeleton loading state
 * - taskCount: Badge count for header notification
 */

import { useEffect, useState, useMemo } from "react";
import {
  collectionGroup,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useUserStore } from "@/stores/useUserStore";
import type { WorkflowTask } from "@bduck/shared-types";

interface UseWorkflowTasksReturn {
  myTasks: WorkflowTask[];
  loading: boolean;
  taskCount: number;
}

export function useWorkflowTasks(): UseWorkflowTasksReturn {
  const [allRawTasks, setAllRawTasks] = useState<WorkflowTask[]>([]);
  const [loading, setLoading] = useState(true);
  const user = useUserStore((s) => s.user);
  const userRoleIds = useUserStore((s) => s.roleIds);

  useEffect(() => {
    if (!user?.id) {
      setAllRawTasks([]);
      setLoading(false);
      return;
    }

    // Query: all PENDING or IN_PROGRESS tasks from the "tasks" subcollection
    // across all workflow_instances using collectionGroup
    // Note: collectionGroup + compound query needs COLLECTION_GROUP index.
    // Sort client-side to avoid index requirement.
    const q = query(
      collectionGroup(db, "tasks"),
      where("status", "in", ["PENDING", "IN_PROGRESS"]),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const tasks: WorkflowTask[] = [];
        snapshot.forEach((doc) => {
          tasks.push({ id: doc.id, ...doc.data() } as WorkflowTask);
        });
        // Sort client-side (newest first)
        tasks.sort((a, b) => {
          const aTime = a.started_at instanceof Date ? a.started_at.getTime() : new Date(a.started_at as any).getTime();
          const bTime = b.started_at instanceof Date ? b.started_at.getTime() : new Date(b.started_at as any).getTime();
          return bTime - aTime;
        });
        setAllRawTasks(tasks);
        setLoading(false);
      },
      (error) => {
        console.error("[useWorkflowTasks] onSnapshot error:", error);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [user?.id]);

  // Filter tasks relevant to the current user
  const myTasks = useMemo(() => {
    if (!user?.id) return [];

    return allRawTasks.filter((task) => {
      // Directly assigned to this user
      if (task.assigned_to === user.id) return true;

      // Assigned to a role that the user holds
      if (task.assigned_role_id) {
        return userRoleIds.includes(task.assigned_role_id);
      }

      // Tasks with no assignee are visible to everyone (admins)
      if (!task.assigned_to && !task.assigned_role_id) return true;

      return false;
    });
  }, [allRawTasks, user?.id, userRoleIds]);

  return {
    myTasks,
    loading,
    taskCount: myTasks.length,
  };
}
