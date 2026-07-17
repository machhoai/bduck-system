import type { FileTemplate } from "@bduck/shared-types";
import { createApiErrorFromResponse } from "@/utils/apiError";
import { authenticatedFetch } from "@/utils/authenticatedFetch";
import type {
  CreateFileTemplatePayload,
  UpdateFileTemplatePayload,
  UploadNewTemplateVersionPayload,
} from "./useFileTemplates";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://api.wms.localhost";

async function parseResponse(response: Response, fallback: string) {
  if (!response.ok) {
    throw await createApiErrorFromResponse(response, fallback);
  }
  return response.json();
}

export async function createTemplateRequest(
  payload: CreateFileTemplatePayload,
) {
  const response = await authenticatedFetch(
    `${API_BASE_URL}/api/file-templates`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
  return parseResponse(response, "Khong the upload bieu mau.");
}

export async function updateTemplateRequest(
  id: string,
  payload: UpdateFileTemplatePayload,
) {
  const response = await authenticatedFetch(
    `${API_BASE_URL}/api/file-templates/${id}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
  return parseResponse(response, "Khong the cap nhat bieu mau.");
}

export async function deleteTemplateRequest(id: string) {
  const response = await authenticatedFetch(
    `${API_BASE_URL}/api/file-templates/${id}`,
    { method: "DELETE" },
  );
  return parseResponse(response, "Khong the xoa bieu mau.");
}

export async function uploadNewVersionRequest(
  id: string,
  payload: UploadNewTemplateVersionPayload,
) {
  const response = await authenticatedFetch(
    `${API_BASE_URL}/api/file-templates/${id}/version`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
  return parseResponse(response, "Khong the cap nhat phien ban bieu mau.");
}

export async function fetchTemplatesFromApi(signal?: AbortSignal) {
  const response = await authenticatedFetch(
    `${API_BASE_URL}/api/file-templates`,
    { method: "GET", signal },
  );
  const body = await parseResponse(
    response,
    "Khong the tai danh sach bieu mau.",
  );
  return (body.data || []) as FileTemplate[];
}
