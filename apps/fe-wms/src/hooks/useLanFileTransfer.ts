"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useUserStore } from "@/stores/useUserStore";
import type {
  LanPresence,
  LanTransferPayload,
  LanTransferProgress,
  LanTransferRequest,
} from "@/types/lanFileTransfer";
import {
  buildRequest,
  filesToMeta,
  isRequestActive,
} from "@/utils/lanFileTransfer";
import {
  startLanReceiverTransfer,
  startLanSenderTransfer,
} from "@/utils/lanWebRtcTransfer";
import { getLanDisplayName, useLanPresence } from "./useLanPresence";

const REQUEST_TTL_MS = 60_000;

type SaveFileHandle = {
  createWritable: () => Promise<FileSystemWritableFileStream>;
};

type SaveFilePickerOptions = {
  suggestedName?: string;
};

declare global {
  interface Window {
    showSaveFilePicker?: (
      options?: SaveFilePickerOptions,
    ) => Promise<SaveFileHandle>;
  }
}

async function selectSaveFileHandles(request: LanTransferRequest) {
  if (request.files.length === 0) return new Map<string, SaveFileHandle>();
  if (!window.showSaveFilePicker) {
    throw new Error("File save picker is not supported by this browser.");
  }

  const handles = new Map<string, SaveFileHandle>();
  for (const file of request.files) {
    const handle = await window.showSaveFilePicker({
      suggestedName: file.name,
    });
    handles.set(file.id, handle);
  }
  return handles;
}

function normalizeMessage(value: string) {
  const message = value.trim();
  return message.length > 0 ? message : null;
}

export function useLanFileTransfer() {
  const user = useUserStore((state) => state.user);
  const isAuthenticated = useUserStore((state) => state.isAuthenticated);
  const { deviceId, peers } = useLanPresence();
  const [requests, setRequests] = useState<LanTransferRequest[]>([]);
  const [progress, setProgress] = useState<LanTransferProgress | null>(null);
  const outgoingFiles = useRef(new Map<string, File[]>());
  const activeTransfers = useRef(new Set<string>());
  const cleanupTransfers = useRef(new Map<string, () => void>());

  useEffect(() => {
    if (!isAuthenticated || !user?.id) {
      setRequests([]);
      return;
    }

    const rowsById = new Map<string, LanTransferRequest>();
    const publish = () => setRequests(Array.from(rowsById.values()));
    const fromQuery = query(
      collection(db, "lan_transfer_requests"),
      where("from_user_id", "==", user.id),
    );
    const toQuery = query(
      collection(db, "lan_transfer_requests"),
      where("to_user_id", "==", user.id),
    );

    const unsubscribeFrom = onSnapshot(fromQuery, (snap) => {
      snap.docs.forEach((item) =>
        rowsById.set(item.id, buildRequest(item.id, item.data())),
      );
      publish();
    });
    const unsubscribeTo = onSnapshot(toQuery, (snap) => {
      snap.docs.forEach((item) =>
        rowsById.set(item.id, buildRequest(item.id, item.data())),
      );
      publish();
    });

    return () => {
      unsubscribeFrom();
      unsubscribeTo();
    };
  }, [isAuthenticated, user?.id]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = new Date();
      requests.forEach((request) => {
        if (request.status !== "pending") return;
        if (request.expires_at.getTime() > now.getTime()) return;
        if (request.to_user_id !== user?.id && request.from_user_id !== user?.id) return;
        void updateDoc(doc(db, "lan_transfer_requests", request.id), {
          status: "expired",
        });
      });
    }, 5_000);

    return () => window.clearInterval(timer);
  }, [requests, user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    requests.forEach((request) => {
      const files = outgoingFiles.current.get(request.id);
      if (!files || request.status !== "accepted") return;
      if (activeTransfers.current.has(request.id)) return;
      activeTransfers.current.add(request.id);

      void startLanSenderTransfer({
        db,
        request,
        files,
        senderId: user.id,
        callbacks: {
          onProgress: setProgress,
          onComplete: () => {
            setProgress((current) =>
              current?.requestId === request.id
                ? { ...current, status: "completed" }
                : current,
            );
            outgoingFiles.current.delete(request.id);
          },
          onError: (error) => {
            console.error("[useLanFileTransfer] sender error:", error);
            setProgress((current) =>
              current?.requestId === request.id ? { ...current, status: "failed" } : current,
            );
            void updateDoc(doc(db, "lan_transfer_requests", request.id), {
              status: "failed",
            });
          },
        },
      }).then((cleanup) => cleanupTransfers.current.set(request.id, cleanup));
    });
  }, [requests, user?.id]);

  useEffect(
    () => () => {
      cleanupTransfers.current.forEach((cleanup) => cleanup());
    },
    [],
  );

  const incomingRequests = useMemo(() => {
    const now = new Date();
    return requests.filter(
      (request) => request.to_user_id === user?.id && isRequestActive(request, now),
    );
  }, [requests, user?.id]);

  const pendingCount = incomingRequests.length;
  const isAvailable = peers.length > 0 || pendingCount > 0;

  const sendRequest = useCallback(
    async ({ recipients, files, message }: LanTransferPayload) => {
      if (!user?.id || recipients.length === 0) return;
      if (files.length === 0 && message.trim().length === 0) return;
      const now = new Date();
      const fileMeta = filesToMeta(files);
      const textMessage = normalizeMessage(message);
      const realRecipients = recipients.filter((peer) => !peer.is_mock);

      if (recipients.some((peer) => peer.is_mock)) {
        setProgress({
          requestId: "dev-mock-request",
          fileName: textMessage || files[0]?.name || "",
          sentBytes: files.reduce((sum, file) => sum + file.size, 0),
          totalBytes: files.reduce((sum, file) => sum + file.size, 0),
          status: "completed",
        });
      }

      await Promise.all(
        realRecipients.map(async (peer) => {
          const requestRef = await addDoc(collection(db, "lan_transfer_requests"), {
            from_user_id: user.id,
            from_device_id: deviceId,
            from_display_name: getLanDisplayName(user),
            to_user_id: peer.user_id,
            to_device_id: peer.device_id,
            to_display_name: peer.display_name,
            files: fileMeta,
            message: textMessage,
            status: "pending",
            created_at: now,
            expires_at: new Date(now.getTime() + REQUEST_TTL_MS),
          });
          if (files.length > 0) outgoingFiles.current.set(requestRef.id, files);
        }),
      );
    },
    [deviceId, user],
  );

  const rejectRequest = useCallback(async (request: LanTransferRequest) => {
    await updateDoc(doc(db, "lan_transfer_requests", request.id), {
      status: "rejected",
      rejected_at: new Date(),
    });
  }, []);

  const acceptRequest = useCallback(
    async (request: LanTransferRequest) => {
      if (!user?.id) return;
      const fileHandles = await selectSaveFileHandles(request);

      if (request.files.length === 0) {
        await updateDoc(doc(db, "lan_transfer_requests", request.id), {
          status: "completed",
          accepted_at: new Date(),
          completed_at: new Date(),
        });
        return;
      }

      await updateDoc(doc(db, "lan_transfer_requests", request.id), {
        status: "accepted",
        accepted_at: new Date(),
      });

      activeTransfers.current.add(request.id);
      const cleanup = await startLanReceiverTransfer({
        db,
        request,
        receiverId: user.id,
        fileHandles,
        callbacks: {
          onProgress: setProgress,
          onComplete: () => {
            setProgress((current) =>
              current?.requestId === request.id
                ? { ...current, status: "completed" }
                : current,
            );
          },
          onError: (error) => {
            console.error("[useLanFileTransfer] receiver error:", error);
            setProgress((current) =>
              current?.requestId === request.id ? { ...current, status: "failed" } : current,
            );
            void updateDoc(doc(db, "lan_transfer_requests", request.id), {
              status: "failed",
            });
          },
        },
      });
      cleanupTransfers.current.set(request.id, cleanup);
    },
    [user?.id],
  );

  return {
    deviceId,
    peers,
    incomingRequests,
    pendingCount,
    isAvailable,
    progress,
    sendRequest,
    acceptRequest,
    rejectRequest,
  };
}
