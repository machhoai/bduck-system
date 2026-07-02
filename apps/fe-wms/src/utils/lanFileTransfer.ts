import type {
  LanPresence,
  LanTransferFileMeta,
  LanTransferRequest,
} from "@/types/lanFileTransfer";

const DEVICE_KEY = "wms-lan-transfer-device-id";

function hasToDate(value: unknown): value is { toDate: () => Date } {
  return (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as { toDate?: unknown }).toDate === "function"
  );
}

export function toLanDate(value: unknown): Date {
  if (value instanceof Date) return value;
  if (hasToDate(value)) return value.toDate();
  if (
    typeof value === "object" &&
    value !== null &&
    "seconds" in value &&
    typeof (value as { seconds?: unknown }).seconds === "number"
  ) {
    return new Date((value as { seconds: number }).seconds * 1000);
  }
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date(0);
}

export function getLanDeviceId() {
  if (typeof window === "undefined") return "server";
  const existing = window.localStorage.getItem(DEVICE_KEY);
  if (existing) return existing;
  const next =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  window.localStorage.setItem(DEVICE_KEY, next);
  return next;
}

export function buildPresence(id: string, data: Record<string, unknown>) {
  return {
    id,
    user_id: String(data.user_id || ""),
    device_id: String(data.device_id || ""),
    display_name: String(data.display_name || ""),
    email: typeof data.email === "string" ? data.email : null,
    last_seen_at: toLanDate(data.last_seen_at),
    expires_at: toLanDate(data.expires_at),
  } satisfies LanPresence;
}

export function buildRequest(id: string, data: Record<string, unknown>) {
  return {
    id,
    from_user_id: String(data.from_user_id || ""),
    from_device_id: String(data.from_device_id || ""),
    from_display_name: String(data.from_display_name || ""),
    to_user_id: String(data.to_user_id || ""),
    to_device_id: String(data.to_device_id || ""),
    to_display_name: String(data.to_display_name || ""),
    files: Array.isArray(data.files) ? (data.files as LanTransferFileMeta[]) : [],
    status: (data.status || "pending") as LanTransferRequest["status"],
    created_at: toLanDate(data.created_at),
    expires_at: toLanDate(data.expires_at),
    accepted_at: data.accepted_at ? toLanDate(data.accepted_at) : null,
    completed_at: data.completed_at ? toLanDate(data.completed_at) : null,
  } satisfies LanTransferRequest;
}

export function filesToMeta(files: File[]): LanTransferFileMeta[] {
  return files.map((file, index) => ({
    id: `${Date.now()}-${index}-${file.name}`,
    name: file.name,
    size: file.size,
    type: file.type || "application/octet-stream",
  }));
}

export function formatLanFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export function isRequestActive(request: LanTransferRequest, now = new Date()) {
  return request.status === "pending" && request.expires_at.getTime() > now.getTime();
}
