"use client";

import { useCallback, useEffect, useState } from "react";
import type { ProcessDocument } from "@bduck/shared-types";
import { authenticatedFetch } from "@/utils/authenticatedFetch";
import { createApiErrorFromResponse } from "@/utils/apiError";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://api.wms.localhost";

export type CreateProcessDocumentPayload = Pick<
  ProcessDocument,
  | "title"
  | "description"
  | "file_name"
  | "file_url"
  | "file_size"
  | "file_format"
>;

async function request(path = "", init?: RequestInit) {
  const response = await authenticatedFetch(
    `${API_BASE_URL}/api/process-documents${path}`,
    init,
  );
  if (!response.ok) {
    throw await createApiErrorFromResponse(
      response,
      "Không thể xử lý tài liệu quy trình.",
    );
  }
  return response.json();
}

export function useProcessDocuments(enabled: boolean) {
  const [documents, setDocuments] = useState<ProcessDocument[]>([]);
  const [loading, setLoading] = useState(enabled);

  useEffect(() => {
    const controller = new AbortController();
    if (!enabled) {
      setDocuments([]);
      setLoading(false);
      return () => controller.abort();
    }
    setLoading(true);
    request("", { signal: controller.signal })
      .then((body) => setDocuments((body.data || []) as ProcessDocument[]))
      .catch((error) => {
        if (!controller.signal.aborted) {
          console.error("[useProcessDocuments] load error:", error);
          setDocuments([]);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [enabled]);

  const createDocument = useCallback(
    async (payload: CreateProcessDocumentPayload) => {
      const body = await request("", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setDocuments((current) => [body.data, ...current]);
      return body;
    },
    [],
  );

  const deleteDocument = useCallback(async (id: string) => {
    const body = await request(`/${id}`, { method: "DELETE" });
    setDocuments((current) => current.filter((item) => item.id !== id));
    return body;
  }, []);

  return { documents, loading, createDocument, deleteDocument };
}
