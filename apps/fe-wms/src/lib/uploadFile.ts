"use client";

/**
 * uploadFile — Upload chứng từ lên Firebase Storage
 *
 * Hỗ trợ: PDF, DOCX, XLSX, CSV (max 20MB mỗi file).
 * Khác với uploadImageAsWebp: KHÔNG compress, giữ nguyên file gốc.
 *
 * @see rules.md §9 — Bảo mật File Tải lên
 */

import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { storage } from "./firebase";

// ─────────────────────────────────────────────
// ALLOWED FILE TYPES (LUẬT THÉP §9)
// ─────────────────────────────────────────────

const ALLOWED_MIME_TYPES: Record<string, string> = {
  "application/pdf": ".pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    ".docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
  "text/csv": ".csv",
};

/** Max 20MB per file (LUẬT THÉP §9) */
const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;

// ─────────────────────────────────────────────
// VALIDATION
// ─────────────────────────────────────────────

export interface FileValidationError {
  type: "INVALID_TYPE" | "FILE_TOO_LARGE";
  message: { vi: string; zh: string };
}

export function validateFile(file: File): FileValidationError | null {
  if (!ALLOWED_MIME_TYPES[file.type]) {
    return {
      type: "INVALID_TYPE",
      message: {
        vi: `Định dạng không hỗ trợ. Chỉ chấp nhận: PDF, DOCX, XLSX, CSV.`,
        zh: `不支持的格式。仅接受：PDF、DOCX、XLSX、CSV。`,
      },
    };
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      type: "FILE_TOO_LARGE",
      message: {
        vi: `Tệp vượt quá 20MB. Vui lòng chọn tệp nhỏ hơn.`,
        zh: `文件超过20MB。请选择较小的文件。`,
      },
    };
  }

  return null;
}

// ─────────────────────────────────────────────
// UPLOAD
// ─────────────────────────────────────────────

/**
 * Upload file lên Firebase Storage.
 *
 * @param file        File object từ input[type=file]
 * @param storagePath Thư mục đích trên Storage (VD: 'temp-uploads/user123')
 * @param onProgress  Optional callback cho upload progress (0-100)
 * @returns           Download URL của file đã upload
 * @throws            Error nếu validate fail hoặc upload fail
 */
export async function uploadFile(
  file: File,
  storagePath: string,
  onProgress?: (percent: number) => void,
): Promise<string> {
  // 1. Validate
  const validationError = validateFile(file);
  if (validationError) {
    throw new Error(validationError.message.vi);
  }

  // 2. Generate unique filename preserving extension
  const ext = ALLOWED_MIME_TYPES[file.type] || ".bin";
  const uniqueFileName = `${crypto.randomUUID()}${ext}`;
  const fullPath = `${storagePath}/${uniqueFileName}`;
  const storageRef = ref(storage, fullPath);

  // 3. Upload with progress tracking
  return new Promise((resolve, reject) => {
    const uploadTask = uploadBytesResumable(storageRef, file, {
      contentType: file.type,
      customMetadata: {
        originalName: file.name,
        uploadedAt: new Date().toISOString(),
      },
    });

    uploadTask.on(
      "state_changed",
      (snapshot) => {
        if (onProgress) {
          const percent = Math.round(
            (snapshot.bytesTransferred / snapshot.totalBytes) * 100,
          );
          onProgress(percent);
        }
      },
      (error) => {
        console.error("[uploadFile] Upload failed:", error);
        reject(new Error("Không thể tải tệp lên. Vui lòng thử lại."));
      },
      async () => {
        try {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          resolve(downloadURL);
        } catch (error) {
          console.error("[uploadFile] getDownloadURL failed:", error);
          reject(new Error("Không thể lấy URL tệp. Vui lòng thử lại."));
        }
      },
    );
  });
}

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

/** Get file extension icon type for UI display */
export function getFileTypeLabel(mimeType: string): string {
  const map: Record<string, string> = {
    "application/pdf": "PDF",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      "DOCX",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "XLSX",
    "text/csv": "CSV",
  };
  return map[mimeType] || "FILE";
}

/** Format file size in human-readable form */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
