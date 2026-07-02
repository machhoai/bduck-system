"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import type { FileTemplate, ManagedFileFormat } from "@bduck/shared-types";
import { db } from "@/lib/firebase";
import { emitDataMutation } from "@/lib/dataInvalidation";
import { useUserStore } from "@/stores/useUserStore";
import { createApiErrorFromResponse } from "@/utils/apiError";
import { toFileLibraryDate } from "@/utils/fileLibrary";
import { useUsers } from "./useUsers";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://api.wms.localhost";

export interface CreateFileTemplatePayload {
  title: string;
  description?: string | null;
  file_name: string;
  file_url: string;
  file_size: number;
  file_format: ManagedFileFormat;
}

async function createTemplateRequest(payload: CreateFileTemplatePayload) {
  const response = await fetch(`${API_BASE_URL}/api/file-templates`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw await createApiErrorFromResponse(
      response,
      "Khong the upload bieu mau.",
    );
  }

  return response.json();
}

export function useFileTemplates(canViewTemplates: boolean) {
  const [templates, setTemplates] = useState<FileTemplate[]>([]);
  const [loading, setLoading] = useState(canViewTemplates);
  const hasPermission = useUserStore((s) => s.hasPermission);
  const { users } = useUsers();

  const canUploadTemplates = hasPermission("file_templates.upload");

  useEffect(() => {
    if (!canViewTemplates) {
      setTemplates([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const templatesQuery = query(
      collection(db, "file_templates"),
      where("is_deleted", "==", false),
    );

    const unsubscribe = onSnapshot(
      templatesQuery,
      (snapshot) => {
        const rows = snapshot.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }) as FileTemplate)
          .sort((a, b) => {
            const aTime = toFileLibraryDate(a.created_at)?.getTime() ?? 0;
            const bTime = toFileLibraryDate(b.created_at)?.getTime() ?? 0;
            return bTime - aTime;
          });
        setTemplates(rows);
        setLoading(false);
      },
      (error) => {
        console.error("[useFileTemplates] listener error:", error);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [canViewTemplates]);

  const uploadersById = useMemo(
    () => new Map(users.map((user) => [user.id, user])),
    [users],
  );

  const getUploaderName = useCallback(
    (userId: string) => {
      const user = uploadersById.get(userId);
      return user?.full_name || user?.username || user?.email || userId || "-";
    },
    [uploadersById],
  );

  const createTemplate = useCallback(
    async (payload: CreateFileTemplatePayload) => {
      const result = await createTemplateRequest(payload);
      emitDataMutation(["file_templates", "audit_logs"]);
      return result;
    },
    [],
  );

  return {
    templates,
    loading,
    canUploadTemplates,
    getUploaderName,
    createTemplate,
  };
}
