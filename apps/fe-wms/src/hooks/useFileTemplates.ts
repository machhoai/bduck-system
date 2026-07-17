"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import type {
  FileTemplate,
  FileTemplateCategory,
  FileTemplateVersionEntry,
  ManagedFileFormat,
} from "@bduck/shared-types";
import { db } from "@/lib/firebase";
import { emitDataMutation } from "@/lib/dataInvalidation";
import { useUserStore } from "@/stores/useUserStore";
import { getAnyFacilityScope } from "@/utils/facilityPermissionScope";
import { FILE_TEMPLATE_CATEGORY_SET } from "@/utils/fileTemplateCategories";
import { toFileLibraryDate } from "@/utils/fileLibrary";
import { useUsers } from "./useUsers";
import {
  createTemplateRequest,
  deleteTemplateRequest,
  fetchTemplatesFromApi,
  updateTemplateRequest,
  uploadNewVersionRequest,
} from "./fileTemplateHookApi";

export interface CreateFileTemplatePayload {
  title: string;
  description?: string | null;
  category?: FileTemplateCategory;
  file_name: string;
  file_url: string;
  file_size: number;
  file_format: ManagedFileFormat;
}

export interface UpdateFileTemplatePayload {
  title?: string;
  description?: string | null;
  category?: FileTemplateCategory;
}

export type UploadNewTemplateVersionPayload = Pick<
  CreateFileTemplatePayload,
  "file_name" | "file_url" | "file_size" | "file_format"
>;

function normalizeVersionEntry(entry: FileTemplateVersionEntry) {
  return {
    ...entry,
    uploaded_at: toFileLibraryDate(entry.uploaded_at) || new Date(0),
  };
}

function normalizeTemplate(template: FileTemplate): FileTemplate {
  return {
    ...template,
    category: FILE_TEMPLATE_CATEGORY_SET.has(template.category)
      ? template.category
      : "general",
    version: template.version || 1,
    version_history: Array.isArray(template.version_history)
      ? template.version_history.map(normalizeVersionEntry)
      : [],
  };
}

function sortTemplates(rows: FileTemplate[]) {
  return [...rows].sort((a, b) => {
    const aTime = toFileLibraryDate(a.created_at)?.getTime() ?? 0;
    const bTime = toFileLibraryDate(b.created_at)?.getTime() ?? 0;
    return bTime - aTime;
  });
}

export function useFileTemplates(canViewTemplates: boolean) {
  const permissions = useUserStore((state) => state.permissions);
  const isSystemAdmin = useMemo(
    () => getAnyFacilityScope(permissions).isSystemAdmin,
    [permissions],
  );
  const [templates, setTemplates] = useState<FileTemplate[]>([]);
  const [loading, setLoading] = useState(canViewTemplates);
  const hasPermission = useUserStore((s) => s.hasPermission);
  const { users } = useUsers();

  const canUploadTemplates = hasPermission("file_templates.upload");
  const canEditTemplates = hasPermission("file_templates.edit");
  const canDeleteTemplates = hasPermission("file_templates.delete");

  useEffect(() => {
    const abortController = new AbortController();
    let disposed = false;

    const loadApiFallback = async () => {
      try {
        const rows = await fetchTemplatesFromApi(abortController.signal);
        if (disposed) return;
        setTemplates(sortTemplates(rows.map(normalizeTemplate)));
      } catch (error) {
        if (!disposed) {
          console.error("[useFileTemplates] API fallback error:", error);
          setTemplates([]);
        }
      } finally {
        if (!disposed) setLoading(false);
      }
    };

    if (!canViewTemplates) {
      setTemplates([]);
      setLoading(false);
      return () => {
        disposed = true;
        abortController.abort();
      };
    }
    if (!isSystemAdmin) {
      void loadApiFallback();
      return () => {
        disposed = true;
        abortController.abort();
      };
    }

    setLoading(true);
    const templatesQuery = query(
      collection(db, "file_templates"),
      where("is_deleted", "==", false),
    );

    const unsubscribe = onSnapshot(
      templatesQuery,
      (snapshot) => {
        const rows = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as FileTemplate[];
        setTemplates(sortTemplates(rows.map(normalizeTemplate)));
        setLoading(false);
      },
      (error) => {
        console.error("[useFileTemplates] listener error:", error);
        void loadApiFallback();
      },
    );

    return () => {
      disposed = true;
      abortController.abort();
      unsubscribe();
    };
  }, [canViewTemplates, isSystemAdmin]);

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
      const created = result?.data as FileTemplate | undefined;
      if (created && canViewTemplates) {
        setTemplates((current) =>
          sortTemplates([normalizeTemplate(created), ...current]),
        );
      }
      emitDataMutation(["file_templates", "audit_logs"]);
      return result;
    },
    [canViewTemplates],
  );

  const updateTemplate = useCallback(
    async (id: string, payload: UpdateFileTemplatePayload) => {
      const result = await updateTemplateRequest(id, payload);
      const updated = result?.data as FileTemplate | undefined;
      if (updated) {
        setTemplates((current) =>
          sortTemplates(
            current.map((template) =>
              template.id === id ? normalizeTemplate(updated) : template,
            ),
          ),
        );
      }
      emitDataMutation(["file_templates", "audit_logs"]);
      return result;
    },
    [],
  );

  const deleteTemplate = useCallback(async (id: string) => {
    const result = await deleteTemplateRequest(id);
    setTemplates((current) => current.filter((template) => template.id !== id));
    emitDataMutation(["file_templates", "audit_logs"]);
    return result;
  }, []);

  const uploadNewVersionForTemplate = useCallback(
    async (id: string, payload: UploadNewTemplateVersionPayload) => {
      const result = await uploadNewVersionRequest(id, payload);
      const updated = result?.data as FileTemplate | undefined;
      if (updated) {
        setTemplates((current) =>
          sortTemplates(
            current.map((template) =>
              template.id === id ? normalizeTemplate(updated) : template,
            ),
          ),
        );
      }
      emitDataMutation(["file_templates", "audit_logs"]);
      return result;
    },
    [],
  );

  return {
    templates,
    loading,
    canUploadTemplates,
    canEditTemplates,
    canDeleteTemplates,
    getUploaderName,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    uploadNewVersion: uploadNewVersionForTemplate,
  };
}
