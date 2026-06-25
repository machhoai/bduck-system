"use client";

import { useEffect } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import type { UserWarehouseRole } from "@bduck/shared-types";
import { db } from "@/lib/firebase";
import { useUserStore } from "@/stores/useUserStore";

function isAssignmentActive(assignment: UserWarehouseRole, now = new Date()) {
  if (!assignment.is_active) return false;

  const validFrom = assignment.valid_from ? new Date(assignment.valid_from) : null;
  if (validFrom && validFrom.getTime() > now.getTime()) return false;

  const validUntil = assignment.valid_until ? new Date(assignment.valid_until) : null;
  if (validUntil && validUntil.getTime() < now.getTime()) return false;

  return true;
}

export function useCurrentUserRoleSync() {
  const userId = useUserStore((state) => state.user?.id);
  const setRoleAssignments = useUserStore((state) => state.setRoleAssignments);

  useEffect(() => {
    if (!userId) {
      setRoleAssignments([]);
      return;
    }

    const q = query(
      collection(db, "user_warehouse_roles"),
      where("user_id", "==", userId),
    );

    return onSnapshot(
      q,
      (snapshot) => {
        const assignments = snapshot.docs
          .map(
            (doc) =>
              ({
                id: doc.id,
                ...doc.data(),
              }) as UserWarehouseRole,
          )
          .filter((assignment) => isAssignmentActive(assignment));

        setRoleAssignments(assignments);
      },
      (error) => {
        console.error("[useCurrentUserRoleSync] onSnapshot error:", error);
      },
    );
  }, [setRoleAssignments, userId]);
}
