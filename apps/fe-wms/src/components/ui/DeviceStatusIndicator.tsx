"use client";

import { useEffect, useMemo, useState } from "react";
import { Cloud, Loader2, Wifi, WifiOff } from "lucide-react";
import {
  collection,
  limit,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { classifyRemoteFailure } from "@/lib/connectivityPolicy";
import { useUserStore } from "@/stores/useUserStore";
import { onAuthStateChanged } from "firebase/auth";
import IonIcon from "./IonIcon";
import { cloud, cloudOffline } from "ionicons/icons";

type FirestoreSyncStatus = "syncing" | "online" | "offline" | "error";

const PUBLIC_ENV =
  process.env.NEXT_PUBLIC_APP_ENV ||
  process.env.NEXT_PUBLIC_ENV ||
  process.env.NEXT_PUBLIC_STAGE ||
  process.env.NEXT_PUBLIC_VERCEL_ENV ||
  process.env.NODE_ENV;

function getEnvironmentLabel() {
  const normalized = (PUBLIC_ENV || "").trim().toLowerCase();

  if (!normalized || normalized === "production" || normalized === "prod") {
    return null;
  }

  if (normalized === "development") return "DEV";

  return normalized.toUpperCase();
}

function useInternetStatus() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const updateStatus = () => setIsOnline(navigator.onLine);

    updateStatus();
    window.addEventListener("online", updateStatus);
    window.addEventListener("offline", updateStatus);

    return () => {
      window.removeEventListener("online", updateStatus);
      window.removeEventListener("offline", updateStatus);
    };
  }, []);

  return isOnline;
}

function useFirebaseUserId() {
  const [firebaseUserId, setFirebaseUserId] = useState<string | null>(null);

  useEffect(() => {
    return onAuthStateChanged(auth, (firebaseUser) => {
      setFirebaseUserId(firebaseUser?.uid ?? null);
    });
  }, []);

  return firebaseUserId;
}

function useFirestoreSyncStatus(isInternetOnline: boolean) {
  const appUserId = useUserStore((state) => state.user?.id);
  const firebaseUserId = useFirebaseUserId();
  const [status, setStatus] = useState<FirestoreSyncStatus>("syncing");

  useEffect(() => {
    if (!isInternetOnline) {
      setStatus("offline");
      return;
    }

    if (!appUserId || !firebaseUserId) {
      setStatus("syncing");
      return;
    }

    setStatus("syncing");

    const statusQuery = query(
      collection(db, "in_app_notifications"),
      where("target_user_id", "==", appUserId),
      limit(1),
    );

    const unsubscribe = onSnapshot(
      statusQuery,
      { includeMetadataChanges: true },
      (snapshot) => {
        if (!navigator.onLine) {
          setStatus("offline");
          return;
        }

        setStatus(
          snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites
            ? "syncing"
            : "online",
        );
      },
      (error) => {
        console.warn("[DeviceStatusIndicator] Firestore status error:", error);
        setStatus(classifyRemoteFailure(navigator.onLine));
      },
    );

    return () => unsubscribe();
  }, [appUserId, firebaseUserId, isInternetOnline]);

  return status;
}

export default function DeviceStatusIndicator({
  glass = false,
}: {
  glass?: boolean;
}) {
  const isInternetOnline = useInternetStatus();
  const firestoreStatus = useFirestoreSyncStatus(isInternetOnline);
  const environmentLabel = useMemo(() => getEnvironmentLabel(), []);

  const internetTitle = isInternetOnline ? "Online" : "Offline";
  const firestoreTitle =
    firestoreStatus === "online"
      ? "Database connected"
      : firestoreStatus === "syncing"
        ? "Database syncing"
        : firestoreStatus === "offline"
          ? "Database offline"
          : "Database unavailable";

  const circleClass = glass
    ? "relative flex h-full aspect-square items-center justify-center rounded-full bg-white/12 border border-white/20 text-white backdrop-blur-md shadow-none transition-all duration-300"
    : "relative flex h-full aspect-square items-center justify-center rounded-full bg-white border border-transparent text-[var(--color-text-muted)] shadow-sm transition-all duration-300";

  return (
    <div className="flex h-8 items-center gap-1.5">
      <div
        className={circleClass}
        title={internetTitle}
        aria-label={internetTitle}
      >
        {isInternetOnline ? (
          <Wifi className="h-4 w-4 text-[var(--color-success-icon)]" />
        ) : (
          <WifiOff className="h-4 w-4 text-[var(--color-error-icon)]" />
        )}
        {!isInternetOnline && (
          <span className="absolute right-0 top-0 flex h-2.5 w-2.5 items-center justify-center rounded-full bg-[var(--color-accent-error)] text-[8px] font-bold leading-none text-white/70">
            !
          </span>
        )}
      </div>

      <div
        className={circleClass}
        title={firestoreTitle}
        aria-label={firestoreTitle}
      >
        {firestoreStatus === "online" || firestoreStatus === "syncing" ? (
          <IonIcon icon={cloud} className="h-4 w-4 text-sky-600" />
        ) : firestoreStatus === "offline" ? (
          <IonIcon
            icon={cloudOffline}
            className="h-4 w-4 text-[var(--color-error-icon)]"
          />
        ) : (
          <Cloud className="h-4 w-4 text-amber-500" />
        )}
        {firestoreStatus === "syncing" && (
          <Loader2 className="absolute -right-0.5 -top-0.5 h-3 w-3 animate-spin text-sky-600" />
        )}
        {firestoreStatus === "online" && (
          <span className="absolute right-0 top-0 h-2.5 w-2.5 rounded-full border border-white bg-[var(--color-success-icon)]" />
        )}
        {firestoreStatus === "offline" && (
          <span className="absolute right-0 top-0 flex h-2.5 w-2.5 items-center justify-center rounded-full bg-[var(--color-accent-error)] text-[8px] font-bold leading-none text-white">
            !
          </span>
        )}
        {firestoreStatus === "error" && (
          <span className="absolute right-0 top-0 flex h-2.5 w-2.5 items-center justify-center rounded-full bg-amber-500 text-[8px] font-bold leading-none text-white">
            !
          </span>
        )}
      </div>
    </div>
  );
}
