"use client";

import { useCallback, useEffect, useState } from "react";
import type { FileTemplateBundle } from "@bduck/shared-types";
import { authenticatedFetch } from "@/utils/authenticatedFetch";
import { createApiErrorFromResponse } from "@/utils/apiError";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://api.wms.localhost";

export interface SaveFileTemplateBundlePayload {
  name: string;
  description?: string | null;
  template_ids: string[];
  process_document_ids: string[];
}

async function request(path = "", init?: RequestInit) {
  const response = await authenticatedFetch(
    `${API_BASE_URL}/api/file-template-bundles${path}`,
    init,
  );
  if (!response.ok) {
    throw await createApiErrorFromResponse(
      response,
      "Không thể xử lý bộ biểu mẫu.",
    );
  }
  return response.json();
}

export function useFileTemplateBundles(enabled: boolean) {
  const [bundles, setBundles] = useState<FileTemplateBundle[]>([]);
  const [loading, setLoading] = useState(enabled);

  useEffect(() => {
    const controller = new AbortController();
    if (!enabled) {
      setBundles([]);
      setLoading(false);
      return () => controller.abort();
    }
    setLoading(true);
    request("", { signal: controller.signal })
      .then((body) => setBundles((body.data || []) as FileTemplateBundle[]))
      .catch((error) => {
        if (!controller.signal.aborted) {
          console.error("[useFileTemplateBundles] load error:", error);
          setBundles([]);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [enabled]);

  const createBundle = useCallback(
    async (payload: SaveFileTemplateBundlePayload) => {
      const body = await request("", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setBundles((current) => [...current, body.data].sort(byName));
      return body;
    },
    [],
  );

  const updateBundle = useCallback(
    async (id: string, payload: SaveFileTemplateBundlePayload) => {
      const body = await request(`/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setBundles((current) =>
        current.map((item) => (item.id === id ? body.data : item)).sort(byName),
      );
      return body;
    },
    [],
  );

  const deleteBundle = useCallback(async (id: string) => {
    const body = await request(`/${id}`, { method: "DELETE" });
    setBundles((current) => current.filter((item) => item.id !== id));
    return body;
  }, []);

  return { bundles, loading, createBundle, updateBundle, deleteBundle };
}

function byName(a: FileTemplateBundle, b: FileTemplateBundle) {
  return a.name.localeCompare(b.name, "vi", { sensitivity: "base" });
}
