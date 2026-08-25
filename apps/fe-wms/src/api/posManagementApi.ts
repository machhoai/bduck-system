import type {
  PosDevice,
  PosDeviceEnrollmentGrant,
  PosDeviceStatus,
  PosLuckyDrawSettings,
  PosLuckyDrawSettingsInput,
  PosLuckyDrawSettingsView,
  PosPaymentSettings,
  PosPaymentSettingsInput,
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
>;
export type PosLuckyDrawSettingsPayload = PosLuckyDrawSettingsInput;

async function callPosApi<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await authenticatedFetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const envelope = (await response.json()) as ApiEnvelope<T>;
  if (!response.ok || envelope.data === null) {
    throw new Error(
      envelope.messages?.vi || "Không thể xử lý yêu cầu quản lý POS.",
    );
  }
  return envelope.data;
}

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
