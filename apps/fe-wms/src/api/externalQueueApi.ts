const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "";

async function apiFetch<T = unknown>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}/api/external-queue${path}`;
  
  const response = await fetch(url, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `API Error: ${response.status}`);
  }

  return response.json();
}

export const externalQueueApi = {
    getPendingBatches: () => apiFetch<any>("/pending"),
    
    getHistory: (params?: { warehouse_id?: string; status?: string }) => {
        const urlParams = new URLSearchParams(params as Record<string, string>).toString();
        return apiFetch<any>(`/history${urlParams ? `?${urlParams}` : ""}`);
    },
    
    approveBatch: (data: { batch_id: string; approved_items: { scan_id: string; quantity: number }[]; notes?: string | null }) =>
        apiFetch<any>("/approve", { method: "POST", body: JSON.stringify(data) }),
        
    rejectBatch: (data: { batch_id: string; reason: string }) =>
        apiFetch<any>("/reject", { method: "POST", body: JSON.stringify(data) }),
};
