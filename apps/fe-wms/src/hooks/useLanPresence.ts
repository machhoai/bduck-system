"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  query,
  setDoc,
  where,
} from "firebase/firestore";
import type { User } from "@bduck/shared-types";
import { db } from "@/lib/firebase";
import { useUserStore } from "@/stores/useUserStore";
import type { LanPresence } from "@/types/lanFileTransfer";
import {
  buildPresence,
  getDevLanMockPeers,
  getLanDeviceId,
} from "@/utils/lanFileTransfer";

const PRESENCE_TTL_MS = 35_000;
const HEARTBEAT_MS = 12_000;

export function getLanDisplayName(user: User) {
  return user.full_name || user.username || user.email || user.id;
}

export function useLanPresence() {
  const user = useUserStore((state) => state.user);
  const isAuthenticated = useUserStore((state) => state.isAuthenticated);
  const deviceId = useMemo(() => getLanDeviceId(), []);
  const [peers, setPeers] = useState<LanPresence[]>([]);
  const isDevMode = process.env.NODE_ENV === "development";
  const visiblePeers = useMemo(
    () => (isDevMode ? [...peers, ...getDevLanMockPeers()] : peers),
    [isDevMode, peers],
  );

  useEffect(() => {
    if (!isAuthenticated || !user?.id || !user.workplace_facility_id) return;
    const presenceRef = doc(
      db,
      "lan_transfer_presence",
      `${user.id}_${deviceId}`,
    );

    const writePresence = async () => {
      const now = new Date();
      await setDoc(
        presenceRef,
        {
          user_id: user.id,
          device_id: deviceId,
          display_name: getLanDisplayName(user),
          email: user.email || null,
          workplace_facility_id: user.workplace_facility_id,
          last_seen_at: now,
          expires_at: new Date(now.getTime() + PRESENCE_TTL_MS),
        },
        { merge: true },
      );
    };

    void writePresence();
    const heartbeat = window.setInterval(() => void writePresence(), HEARTBEAT_MS);
    const markOffline = () => {
      void setDoc(
        presenceRef,
        { expires_at: new Date(), last_seen_at: new Date() },
        { merge: true },
      );
    };
    window.addEventListener("beforeunload", markOffline);

    return () => {
      window.clearInterval(heartbeat);
      window.removeEventListener("beforeunload", markOffline);
      markOffline();
    };
  }, [deviceId, isAuthenticated, user]);

  useEffect(() => {
    if (!isAuthenticated || !user?.id || !user.workplace_facility_id) {
      setPeers([]);
      return;
    }

    const presenceQuery = query(
      collection(db, "lan_transfer_presence"),
      where("workplace_facility_id", "==", user.workplace_facility_id),
    );
    const unsubscribe = onSnapshot(presenceQuery, (snap) => {
      const now = Date.now();
      const rows = snap.docs
        .map((item) => buildPresence(item.id, item.data()))
        .filter(
          (presence) =>
            presence.user_id !== user.id &&
            presence.device_id !== deviceId &&
            presence.expires_at.getTime() > now,
        );
      setPeers(rows);
    });

    return unsubscribe;
  }, [deviceId, isAuthenticated, user?.id, user?.workplace_facility_id]);

  return { deviceId, peers: visiblePeers };
}
