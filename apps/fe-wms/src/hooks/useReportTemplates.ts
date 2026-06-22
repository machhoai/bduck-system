"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  ReportExcelMapping,
  ReportTemplate,
  ReportTemplateVersion,
  ReportTemplateVisibility,
} from "@bduck/shared-types";
import { createDetailedApiError } from "@/utils/apiError";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://api.wms.localhost";

interface TemplateDetail {
  template: ReportTemplate;
  version: ReportTemplateVersion;
}

async function readApiJson<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.success) {
    throw createDetailedApiError(response, body, "Khong the xu ly bao cao.");
  }
  return body.data as T;
}

export function useReportTemplates() {
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/reports/templates`, {
        credentials: "include",
      });
      setTemplates(await readApiJson<ReportTemplate[]>(response));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchTemplates();
  }, [fetchTemplates]);

  const createExcelTemplate = useCallback(
    async (input: {
      name: string;
      original_file_name: string;
      file_base64: string;
      visibility: ReportTemplateVisibility;
      mapping: ReportExcelMapping;
    }) => {
      const response = await fetch(`${API_BASE_URL}/api/reports/templates/excel`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = await readApiJson<TemplateDetail>(response);
      await fetchTemplates();
      return data;
    },
    [fetchTemplates],
  );

  const updateExcelTemplate = useCallback(
    async (
      id: string,
      input: {
        name?: string;
        visibility?: ReportTemplateVisibility;
        mapping?: ReportExcelMapping;
      },
    ) => {
      const response = await fetch(
        `${API_BASE_URL}/api/reports/templates/${id}/excel`,
        {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        },
      );
      const data = await readApiJson<TemplateDetail>(response);
      await fetchTemplates();
      return data;
    },
    [fetchTemplates],
  );

  const previewExcelTemplate = useCallback(
    async (id: string, mapping: ReportExcelMapping) => {
      const response = await fetch(
        `${API_BASE_URL}/api/reports/templates/${id}/preview`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mapping }),
        },
      );
      return readApiJson<Array<{ cell: string; sheet_name: string; value: unknown }>>(
        response,
      );
    },
    [],
  );

  const fetchTemplateDetail = useCallback(async (id: string) => {
    const response = await fetch(`${API_BASE_URL}/api/reports/templates/${id}`, {
      credentials: "include",
    });
    return readApiJson<TemplateDetail>(response);
  }, []);

  const fetchTemplateFile = useCallback(async (id: string) => {
    const response = await fetch(`${API_BASE_URL}/api/reports/templates/${id}/file`, {
      credentials: "include",
    });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw createDetailedApiError(response, body, "Khong the tai file mau.");
    }
    return response.blob();
  }, []);

  const exportExcelTemplate = useCallback(
    async (id: string, mapping: ReportExcelMapping) => {
      const response = await fetch(
        `${API_BASE_URL}/api/reports/templates/${id}/export`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mapping }),
        },
      );
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw createDetailedApiError(response, body, "Khong the xuat bao cao.");
      }
      return response.blob();
    },
    [],
  );

  return {
    templates,
    loading,
    fetchTemplates,
    createExcelTemplate,
    updateExcelTemplate,
    previewExcelTemplate,
    exportExcelTemplate,
    fetchTemplateDetail,
    fetchTemplateFile,
  };
}
