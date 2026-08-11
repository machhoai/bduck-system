import type {
  PosCustomerDisplaySettingsInput,
  PosCustomerDisplaySettingsView,
} from "@bduck/shared-types";

import { authenticatedFetch } from "@/utils/authenticatedFetch";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://api.wms.localhost";

interface ApiEnvelope<T> {
  success: boolean;
  data: T | null;
  messages?: { vi?: string };
}

const readEnvelope = async <T>(response: Response): Promise<T> => {
  const envelope = (await response.json()) as ApiEnvelope<T>;
  if (!response.ok || envelope.data === null) {
    throw new Error(envelope.messages?.vi || "Không thể xử lý cấu hình quảng cáo.");
  }
  return envelope.data;
};

const jsonRequest = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await authenticatedFetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  return readEnvelope<T>(response);
};

export const posCustomerDisplayApi = {
  get: (warehouseId: string) =>
    jsonRequest<PosCustomerDisplaySettingsView>(
      `/api/pos/stores/${warehouseId}/customer-display-settings`,
    ),

  save: (warehouseId: string, input: PosCustomerDisplaySettingsInput) =>
    jsonRequest<PosCustomerDisplaySettingsView>(
      `/api/pos/stores/${warehouseId}/customer-display-settings`,
      { method: "PUT", body: JSON.stringify(input) },
    ),

  upload: async (warehouseId: string, file: File, expectedVersion: number) => {
    const response = await authenticatedFetch(
      `${API_BASE_URL}/api/pos/stores/${warehouseId}/customer-display-media`,
      {
        method: "POST",
        body: file,
        headers: {
          "Content-Type": file.type || "application/octet-stream",
          "X-File-Name": encodeURIComponent(file.name),
          "X-Expected-Version": String(expectedVersion),
          "X-Action-Time": new Date().toISOString(),
        },
      },
    );
    return readEnvelope<PosCustomerDisplaySettingsView>(response);
  },

  remove: (warehouseId: string, mediaId: string, expectedVersion: number) =>
    jsonRequest<PosCustomerDisplaySettingsView>(
      `/api/pos/stores/${warehouseId}/customer-display-media/${mediaId}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          expected_version: expectedVersion,
          action_time: new Date().toISOString(),
        }),
      },
    ),
};
