import { addDoc, collection, type Firestore } from "firebase/firestore";
import type { LanSignalMessage } from "@/types/lanFileTransfer";
import { toLanDate } from "./lanFileTransfer";

export function createLanPeerConnection() {
  return new RTCPeerConnection({
    iceServers: [],
    iceCandidatePoolSize: 0,
  });
}

export function signalCollection(db: Firestore, requestId: string) {
  return collection(db, "lan_transfer_requests", requestId, "signals");
}

export async function writeSignal(
  db: Firestore,
  requestId: string,
  senderId: string,
  type: LanSignalMessage["type"],
  payload: unknown,
) {
  await addDoc(signalCollection(db, requestId), {
    type,
    sender_id: senderId,
    payload,
    created_at: new Date(),
    expires_at: new Date(Date.now() + 5 * 60 * 1000),
  });
}

export function mapSignal(id: string, data: Record<string, unknown>) {
  return {
    id,
    type: data.type as LanSignalMessage["type"],
    sender_id: String(data.sender_id || ""),
    payload: data.payload,
    created_at: toLanDate(data.created_at),
  } satisfies LanSignalMessage;
}
