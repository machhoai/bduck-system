import type {
  PosDevice,
  PosDeviceEnrollmentGrant,
  PosDeviceStatus,
  PosPaymentSettings,
  PosPaymentSettingsInput,
  PosReceiptSettings,
  PosStoreOverview,
} from "@bduck/shared-types";

import { authenticatedFetch } from "@/utils/authenticatedFetch";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://api.wms.localhost";

interface ApiEnvelope<T> {
  success: boolean;
  data: T | null;
  messages?: { vi?: string };
}

export type SafePosDevice = Omit<PosDevice, "credential_hash">;
export type PosReceiptSettingsPayload = Omit<
  PosReceiptSettings,
  "id" | "warehouse_id" | "version" | "updated_by" | "is_deleted" | "created_at" | "updated_at"
>;

async function callPosApi<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await authenticatedFetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const envelope = (await response.json()) as ApiEnvelope<T>;
  if (!response.ok || envelope.data === null) {
    throw new Error(envelope.messages?.vi || "Không thể xử lý yêu cầu quản lý POS.");
  }
  return envelope.data;
}

export const posManagementApi = {
  getOverview: (warehouseId: string) =>
    callPosApi<PosStoreOverview>(`/api/pos/stores/${warehouseId}/overview`),
  listDevices: (warehouseId: string) =>
    callPosApi<SafePosDevice[]>(`/api/pos/stores/${warehouseId}/devices`),
  createEnrollment: (warehouseId: string, otp: string) =>
    callPosApi<PosDeviceEnrollmentGrant>(`/api/pos/stores/${warehouseId}/enrollments`, {
      method: "POST",
      body: JSON.stringify({ otp }),
    }),
  changeDeviceStatus: (deviceId: string, status: PosDeviceStatus) =>
    callPosApi<SafePosDevice>(`/api/pos/devices/${deviceId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
  getReceiptSettings: async (warehouseId: string) => {
    const response = await authenticatedFetch(
      `${API_BASE_URL}/api/pos/stores/${warehouseId}/receipt-settings`,
    );
    const envelope = (await response.json()) as ApiEnvelope<PosReceiptSettings>;
    if (!response.ok) throw new Error(envelope.messages?.vi || "Không thể tải cấu hình POS.");
    return envelope.data;
  },
  saveReceiptSettings: (warehouseId: string, value: PosReceiptSettingsPayload) =>
    callPosApi<PosReceiptSettings>(`/api/pos/stores/${warehouseId}/receipt-settings`, {
      method: "PUT",
      body: JSON.stringify(value),
    }),
  getPaymentSettings: async (warehouseId: string) => {
    const response = await authenticatedFetch(
      `${API_BASE_URL}/api/pos/stores/${warehouseId}/payment-settings`,
    );
    const envelope = (await response.json()) as ApiEnvelope<PosPaymentSettings>;
    if (!response.ok) throw new Error(envelope.messages?.vi || "Không thể tải cấu hình thanh toán POS.");
    return envelope.data;
  },
  savePaymentSettings: (warehouseId: string, value: PosPaymentSettingsInput) =>
    callPosApi<PosPaymentSettings>(`/api/pos/stores/${warehouseId}/payment-settings`, {
      method: "PUT",
      body: JSON.stringify(value),
    }),
};
