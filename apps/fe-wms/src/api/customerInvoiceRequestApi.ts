import type {
  CustomerInvoiceRequestCompany,
  CustomerInvoiceRequestPublicView,
  InvoiceDraftBuyer,
} from "@bduck/shared-types";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://api.wms.localhost";

interface ApiEnvelope<T> {
  success: boolean;
  data: T | null;
  messages?: { vi?: string; zh?: string };
}

export class CustomerInvoiceRequestApiError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
    readonly code: string | null,
  ) {
    super(message);
    this.name = "CustomerInvoiceRequestApiError";
  }
}

const request = async <T>(
  path: string,
  options?: RequestInit,
): Promise<T> => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  const payload = (await response.json().catch(() => null)) as
    | ApiEnvelope<T>
    | null;
  if (!response.ok || !payload?.success || payload.data === null) {
    const errorData = payload?.data as { code?: string } | null;
    throw new CustomerInvoiceRequestApiError(
      payload?.messages?.vi || "Không thể xử lý yêu cầu hóa đơn.",
      response.status,
      errorData?.code ?? null,
    );
  }
  return payload.data;
};

export interface CustomerInvoiceRequestSubmissionPayload {
  idempotency_key: string;
  action_time: string;
  buyer: InvoiceDraftBuyer;
}

export const customerInvoiceRequestApi = {
  get: (token: string, signal?: AbortSignal) =>
    request<CustomerInvoiceRequestPublicView>(
      `/api/public/invoice-requests/${encodeURIComponent(token)}`,
      { signal },
    ),

  lookupTaxCode: (token: string, taxCode: string, signal?: AbortSignal) =>
    request<CustomerInvoiceRequestCompany[]>(
      `/api/public/invoice-requests/${encodeURIComponent(token)}/tax-id/${encodeURIComponent(taxCode)}`,
      { signal },
    ),

  submit: (
    token: string,
    payload: CustomerInvoiceRequestSubmissionPayload,
    deviceId: string,
  ) =>
    request<CustomerInvoiceRequestPublicView & { duplicate: boolean }>(
      `/api/public/invoice-requests/${encodeURIComponent(token)}/submissions`,
      {
        method: "POST",
        headers: { "x-device-id": deviceId },
        body: JSON.stringify(payload),
      },
    ),
};
