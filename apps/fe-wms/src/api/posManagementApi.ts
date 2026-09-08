import type {
  PosDevice,
  PosDeviceEnrollmentGrant,
  PosDeviceStatus,
  PosLuckyDrawSettings,
  PosLuckyDrawSettingsInput,
  PosLuckyDrawSettingsView,
  PosPaymentSettings,
  PosPaymentSettingsInput,
  PosProductCatalogSyncInput,
  PosProductCatalogSyncResult,
  PosProductVisibilitySettings,
  PosProductVisibilitySettingsInput,
  PosProductVisibilitySettingsView,
  PosReceiptSettings,
  PosStoreOverview,
  PosTicketSettings,
} from "@bduck/shared-types";

import { authenticatedFetch } from "@/utils/authenticatedFetch";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://api.wms.localhost";

interface ApiEnvelope<T> {
  success: boolean;
  data: T | null;
  messages?: { vi?: string };
}

export type SafePosDevice = Omit<PosDevice, "credential_hash">;
export type PosReceiptSettingsPayload = Omit<
  PosReceiptSettings,
  | "id"
  | "warehouse_id"
  | "version"
  | "updated_by"
  | "is_deleted"
  | "created_at"
  | "updated_at"
  | "logo_storage_path"
  | "logo_checksum_sha256"
  | "logo_content_type"
  | "logo_file_size_bytes"
  | "logo_content_url"
>;
export type PosTicketSettingsPayload = Omit<
  PosTicketSettings,
  | "id"
  | "warehouse_id"
  | "version"
  | "updated_by"
  | "is_deleted"
  | "created_at"
  | "updated_at"
  | "logo_storage_path"
  | "logo_checksum_sha256"
  | "logo_content_type"
  | "logo_file_size_bytes"
  | "logo_content_url"
>;
export type PosLuckyDrawSettingsPayload = PosLuckyDrawSettingsInput;
export type PosProductVisibilitySettingsPayload =
  PosProductVisibilitySettingsInput;

async function callPosApi<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await authenticatedFetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const envelope = (await response.json()) as ApiEnvelope<T>;
  if (!response.ok || envelope.data === null) {
    if (response.status === 429) {
      const retryAfter = Number(response.headers.get("Retry-After"));
      const waitSeconds =
        Number.isFinite(retryAfter) && retryAfter > 0
          ? Math.ceil(retryAfter)
          : 60;
      throw new Error(
        `Thao tác quá nhanh. Vui lòng thử lại sau ${waitSeconds} giây.`,
      );
    }
    throw new Error(
      envelope.messages?.vi || "Không thể xử lý yêu cầu quản lý POS.",
    );
  }
  return envelope.data;
}

const productVisibilitySaves = new Map<
  string,
  Promise<PosProductVisibilitySettings>
>();

const saveProductVisibilitySettings = (
  warehouseId: string,
  value: PosProductVisibilitySettingsPayload,
): Promise<PosProductVisibilitySettings> => {
  const current = productVisibilitySaves.get(warehouseId);
  if (current) return current;
  const pending = callPosApi<PosProductVisibilitySettings>(
    `/api/pos/stores/${warehouseId}/product-visibility-settings`,
    { method: "PUT", body: JSON.stringify(value) },
  ).finally(() => {
    productVisibilitySaves.delete(warehouseId);
  });
  productVisibilitySaves.set(warehouseId, pending);
  return pending;
};

export const posManagementApi = {
  getOverview: (warehouseId: string) =>
    callPosApi<PosStoreOverview>(`/api/pos/stores/${warehouseId}/overview`),
  listDevices: (warehouseId: string) =>
    callPosApi<SafePosDevice[]>(`/api/pos/stores/${warehouseId}/devices`),
  createEnrollment: (warehouseId: string, otp: string) =>
    callPosApi<PosDeviceEnrollmentGrant>(
      `/api/pos/stores/${warehouseId}/enrollments`,
      {
        method: "POST",
        body: JSON.stringify({ otp }),
      },
    ),
  changeDeviceStatus: (deviceId: string, status: PosDeviceStatus) =>
    callPosApi<SafePosDevice>(`/api/pos/devices/${deviceId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
  transferDevice: (deviceId: string, warehouseId: string) =>
    callPosApi<SafePosDevice>(`/api/pos/devices/${deviceId}/warehouse`, {
      method: "PATCH",
      body: JSON.stringify({ warehouse_id: warehouseId }),
    }),
  getReceiptSettings: async (warehouseId: string) => {
    const response = await authenticatedFetch(
      `${API_BASE_URL}/api/pos/stores/${warehouseId}/receipt-settings`,
    );
    const envelope = (await response.json()) as ApiEnvelope<PosReceiptSettings>;
    if (!response.ok)
      throw new Error(envelope.messages?.vi || "Không thể tải cấu hình POS.");
    return envelope.data;
  },
  saveReceiptSettings: (
    warehouseId: string,
    value: PosReceiptSettingsPayload,
  ) =>
    callPosApi<PosReceiptSettings>(
      `/api/pos/stores/${warehouseId}/receipt-settings`,
      {
        method: "PUT",
        body: JSON.stringify(value),
      },
    ),
  getTicketSettings: async (warehouseId: string) => {
    const response = await authenticatedFetch(
      `${API_BASE_URL}/api/pos/stores/${warehouseId}/ticket-settings`,
    );
    const envelope = (await response.json()) as ApiEnvelope<PosTicketSettings>;
    if (!response.ok)
      throw new Error(
        envelope.messages?.vi || "Không thể tải cấu hình vé POS.",
      );
    return envelope.data;
  },
  saveTicketSettings: (warehouseId: string, value: PosTicketSettingsPayload) =>
    callPosApi<PosTicketSettings>(
      `/api/pos/stores/${warehouseId}/ticket-settings`,
      {
        method: "PUT",
        body: JSON.stringify(value),
      },
    ),
  getLuckyDrawSettings: (warehouseId: string) =>
    callPosApi<PosLuckyDrawSettingsView>(
      `/api/pos/stores/${warehouseId}/lucky-draw-settings`,
    ),
  saveLuckyDrawSettings: (
    warehouseId: string,
    value: PosLuckyDrawSettingsPayload,
  ) =>
    callPosApi<PosLuckyDrawSettings>(
      `/api/pos/stores/${warehouseId}/lucky-draw-settings`,
      {
        method: "PUT",
        body: JSON.stringify(value),
      },
    ),
  getProductVisibilitySettings: (warehouseId: string) =>
    callPosApi<PosProductVisibilitySettingsView>(
      `/api/pos/stores/${warehouseId}/product-visibility-settings`,
    ),
  saveProductVisibilitySettings: (
    warehouseId: string,
    value: PosProductVisibilitySettingsPayload,
  ) => saveProductVisibilitySettings(warehouseId, value),
  syncProducts: (warehouseId: string, value: PosProductCatalogSyncInput) =>
    callPosApi<PosProductCatalogSyncResult>(
      `/api/pos/stores/${warehouseId}/products/sync`,
      { method: "POST", body: JSON.stringify(value) },
    ),
  getPaymentSettings: async (deviceId: string) => {
    const response = await authenticatedFetch(
      `${API_BASE_URL}/api/pos/devices/${deviceId}/payment-settings`,
    );
    const envelope = (await response.json()) as ApiEnvelope<PosPaymentSettings>;
    if (!response.ok)
      throw new Error(
        envelope.messages?.vi || "Không thể tải cấu hình thanh toán POS.",
      );
    return envelope.data;
  },
  savePaymentSettings: (deviceId: string, value: PosPaymentSettingsInput) =>
    callPosApi<PosPaymentSettings>(
      `/api/pos/devices/${deviceId}/payment-settings`,
      {
        method: "PUT",
        body: JSON.stringify(value),
      },
    ),
};
