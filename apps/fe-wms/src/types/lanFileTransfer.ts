export type LanTransferStatus =
  | "pending"
  | "accepted"
  | "rejected"
  | "expired"
  | "transferring"
  | "completed"
  | "failed"
  | "cancelled";

export type LanSignalType = "offer" | "answer" | "ice";

export interface LanPresence {
  id: string;
  user_id: string;
  device_id: string;
  display_name: string;
  email: string | null;
  last_seen_at: Date;
  expires_at: Date;
}

export interface LanTransferFileMeta {
  id: string;
  name: string;
  size: number;
  type: string;
}

export interface LanTransferRequest {
  id: string;
  from_user_id: string;
  from_device_id: string;
  from_display_name: string;
  to_user_id: string;
  to_device_id: string;
  to_display_name: string;
  files: LanTransferFileMeta[];
  status: LanTransferStatus;
  created_at: Date;
  expires_at: Date;
  accepted_at?: Date | null;
  completed_at?: Date | null;
}

export interface LanSignalMessage {
  id: string;
  type: LanSignalType;
  sender_id: string;
  payload: unknown;
  created_at: Date;
}

export interface LanTransferProgress {
  requestId: string;
  fileName: string;
  sentBytes: number;
  totalBytes: number;
  status: "idle" | "connecting" | "transferring" | "completed" | "failed";
}
