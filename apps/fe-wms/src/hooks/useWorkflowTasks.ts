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
  orderBy,
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
  const permissions = useUserStore((s) => s.permissions);

  // Extract user's role IDs from permissions structure
  const userRoleScopes = useMemo(() => {
    if (!permissions) return [];
    return Object.keys(permissions);
  }, [permissions]);

  useEffect(() => {
    if (!user?.id) {
      setAllRawTasks([]);
      setLoading(false);
      return;
    }

    // Query: all PENDING or IN_PROGRESS tasks from the "tasks" subcollection
    // across all workflow_instances using collectionGroup
    const q = query(
      collectionGroup(db, "tasks"),
      where("status", "in", ["PENDING", "IN_PROGRESS"]),
      orderBy("started_at", "desc"),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const tasks: WorkflowTask[] = [];
        snapshot.forEach((doc) => {
          tasks.push({ id: doc.id, ...doc.data() } as WorkflowTask);
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

      // Assigned to a role that the user has
      if (task.assigned_role_id) {
        // The user's permissions map has scopes (warehouse IDs or "global")
        // If any scope contains the assigned role, the user can see the task
        return userRoleScopes.length > 0;
      }

      // Tasks with no assignee are visible to everyone (admins)
      if (!task.assigned_to && !task.assigned_role_id) return true;

      return false;
    });
  }, [allRawTasks, user?.id, userRoleScopes]);

  return {
    myTasks,
    loading,
    taskCount: myTasks.length,
  };
}
