import {
  doc,
  onSnapshot,
  updateDoc,
  type Firestore,
} from "firebase/firestore";
import type {
  LanTransferFileMeta,
  LanTransferProgress,
  LanTransferRequest,
} from "@/types/lanFileTransfer";
import {
  createLanPeerConnection,
  mapSignal,
  signalCollection,
  writeSignal,
} from "./lanWebRtcSignals";

const CHUNK_SIZE = 64 * 1024;
const BUFFER_LIMIT = 1024 * 1024;

type FileSystemDirectoryHandleLike = {
  getFileHandle: (
    name: string,
    options: { create: boolean },
  ) => Promise<{ createWritable: () => Promise<FileSystemWritableFileStream> }>;
};

type FileEnvelope =
  | { kind: "file-start"; meta: LanTransferFileMeta }
  | { kind: "file-end"; fileId: string }
  | { kind: "all-complete" };

interface TransferCallbacks {
  onProgress: (progress: LanTransferProgress) => void;
  onComplete: () => void;
  onError: (error: unknown) => void;
}

async function waitForDrain(channel: RTCDataChannel) {
  if (channel.bufferedAmount < BUFFER_LIMIT) return;
  await new Promise<void>((resolve) => {
    const done = () => {
      channel.removeEventListener("bufferedamountlow", done);
      resolve();
    };
    channel.bufferedAmountLowThreshold = BUFFER_LIMIT / 2;
    channel.addEventListener("bufferedamountlow", done);
  });
}

async function sendJson(channel: RTCDataChannel, envelope: FileEnvelope) {
  channel.send(JSON.stringify(envelope));
  await waitForDrain(channel);
}

async function sendFiles(
  channel: RTCDataChannel,
  request: LanTransferRequest,
  files: File[],
  callbacks: TransferCallbacks,
) {
  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
  let sentBytes = 0;

  for (const file of files) {
    const meta = request.files.find((item) => item.name === file.name) || {
      id: file.name,
      name: file.name,
      size: file.size,
      type: file.type || "application/octet-stream",
    };
    await sendJson(channel, { kind: "file-start", meta });

    for (let offset = 0; offset < file.size; offset += CHUNK_SIZE) {
      const chunk = await file.slice(offset, offset + CHUNK_SIZE).arrayBuffer();
      channel.send(chunk);
      sentBytes += chunk.byteLength;
      callbacks.onProgress({
        requestId: request.id,
        fileName: file.name,
        sentBytes,
        totalBytes,
        status: "transferring",
      });
      await waitForDrain(channel);
    }

    await sendJson(channel, { kind: "file-end", fileId: meta.id });
  }

  await sendJson(channel, { kind: "all-complete" });
}

export async function startLanSenderTransfer({
  db,
  request,
  files,
  senderId,
  callbacks,
}: {
  db: Firestore;
  request: LanTransferRequest;
  files: File[];
  senderId: string;
  callbacks: TransferCallbacks;
}) {
  const pc = createLanPeerConnection();
  const channel = pc.createDataChannel("lan-files", { ordered: true });
  const processedSignals = new Set<string>();

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      void writeSignal(db, request.id, senderId, "ice", event.candidate.toJSON());
    }
  };

  channel.binaryType = "arraybuffer";
  channel.onopen = () => {
    callbacks.onProgress({
      requestId: request.id,
      fileName: request.files[0]?.name || "",
      sentBytes: 0,
      totalBytes: request.files.reduce((sum, file) => sum + file.size, 0),
      status: "transferring",
    });
    void updateDoc(doc(db, "lan_transfer_requests", request.id), {
      status: "transferring",
      started_at: new Date(),
    });
    void sendFiles(channel, request, files, callbacks).catch(callbacks.onError);
  };

  channel.onerror = callbacks.onError;

  const unsubscribe = onSnapshot(signalCollection(db, request.id), (snapshot) => {
    snapshot.docs.forEach((signalDoc) => {
      if (processedSignals.has(signalDoc.id)) return;
      const signal = mapSignal(signalDoc.id, signalDoc.data());
      if (signal.sender_id === senderId) return;
      processedSignals.add(signalDoc.id);

      if (signal.type === "answer") {
        void pc.setRemoteDescription(signal.payload as RTCSessionDescriptionInit);
      }
      if (signal.type === "ice") {
        void pc.addIceCandidate(signal.payload as RTCIceCandidateInit);
      }
    });
  });

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  await writeSignal(db, request.id, senderId, "offer", offer);

  channel.onclose = () => {
    unsubscribe();
    pc.close();
  };

  channel.onmessage = async (event) => {
    if (typeof event.data !== "string") return;
    const message = JSON.parse(event.data) as { kind?: string };
    if (message.kind === "receiver-complete") {
      await updateDoc(doc(db, "lan_transfer_requests", request.id), {
        status: "completed",
        completed_at: new Date(),
      });
      callbacks.onComplete();
      channel.close();
    }
  };

  return () => {
    unsubscribe();
    pc.close();
  };
}

export async function startLanReceiverTransfer({
  db,
  request,
  receiverId,
  directoryHandle,
  callbacks,
}: {
  db: Firestore;
  request: LanTransferRequest;
  receiverId: string;
  directoryHandle: FileSystemDirectoryHandleLike | null;
  callbacks: TransferCallbacks;
}) {
  const pc = createLanPeerConnection();
  const processedSignals = new Set<string>();
  const bufferedFallback = new Map<string, BlobPart[]>();
  let currentMeta: LanTransferFileMeta | null = null;
  let currentWritable: FileSystemWritableFileStream | null = null;
  let receivedBytes = 0;
  const totalBytes = request.files.reduce((sum, file) => sum + file.size, 0);

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      void writeSignal(db, request.id, receiverId, "ice", event.candidate.toJSON());
    }
  };

  pc.ondatachannel = (event) => {
    const channel = event.channel;
    channel.binaryType = "arraybuffer";

    channel.onmessage = async (messageEvent) => {
      try {
        if (typeof messageEvent.data === "string") {
          const envelope = JSON.parse(messageEvent.data) as FileEnvelope;
          if (envelope.kind === "file-start") {
            currentMeta = envelope.meta;
            if (directoryHandle) {
              const handle = await directoryHandle.getFileHandle(currentMeta.name, {
                create: true,
              });
              currentWritable = await handle.createWritable();
            } else {
              bufferedFallback.set(currentMeta.id, []);
            }
            return;
          }

          if (envelope.kind === "file-end") {
            if (currentWritable) await currentWritable.close();
            currentWritable = null;
            currentMeta = null;
            return;
          }

          if (envelope.kind === "all-complete") {
            for (const meta of request.files) {
              const parts = bufferedFallback.get(meta.id);
              if (!parts) continue;
              const url = URL.createObjectURL(new Blob(parts, { type: meta.type }));
              const link = document.createElement("a");
              link.href = url;
              link.download = meta.name;
              link.click();
              URL.revokeObjectURL(url);
            }
            channel.send(JSON.stringify({ kind: "receiver-complete" }));
            callbacks.onComplete();
            channel.close();
          }
          return;
        }

        const chunk = messageEvent.data as ArrayBuffer;
        receivedBytes += chunk.byteLength;
        if (currentWritable) {
          await currentWritable.write(chunk);
        } else if (currentMeta) {
          bufferedFallback.get(currentMeta.id)?.push(chunk);
        }
        callbacks.onProgress({
          requestId: request.id,
          fileName: currentMeta?.name || "",
          sentBytes: receivedBytes,
          totalBytes,
          status: "transferring",
        });
      } catch (error) {
        callbacks.onError(error);
      }
    };
  };

  const unsubscribe = onSnapshot(signalCollection(db, request.id), (snapshot) => {
    snapshot.docs.forEach((signalDoc) => {
      if (processedSignals.has(signalDoc.id)) return;
      const signal = mapSignal(signalDoc.id, signalDoc.data());
      if (signal.sender_id === receiverId) return;
      processedSignals.add(signalDoc.id);

      if (signal.type === "offer") {
        void (async () => {
          await pc.setRemoteDescription(signal.payload as RTCSessionDescriptionInit);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          await writeSignal(db, request.id, receiverId, "answer", answer);
        })();
      }
      if (signal.type === "ice") {
        void pc.addIceCandidate(signal.payload as RTCIceCandidateInit);
      }
    });
  });

  return () => {
    unsubscribe();
    pc.close();
  };
}
