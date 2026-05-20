/**
 * Firebase Admin SDK — Server-Side Initialization
 *
 * Cấu hình Firebase Admin SDK cho WMS Backend.
 * Sử dụng Service Account JSON được mã hóa Base64 từ biến môi trường
 * `FIREBASE_SERVICE_ACCOUNT_BASE64` để tránh commit file JSON nhạy cảm.
 *
 * ► LÝ DO dùng Base64:
 *   - Service Account JSON chứa private key dài nhiều dòng, dễ bị lỗi
 *     khi truyền qua biến môi trường (đặc biệt trên Docker và CI/CD).
 *   - Base64 encoding gói toàn bộ JSON thành 1 chuỗi liên tục, an toàn
 *     trên mọi nền tảng (GitHub Secrets, Docker ENV, .env file).
 *
 * @see wms-core-rules.md §7 — Bảo mật Biến môi trường
 */

import * as admin from 'firebase-admin';
import type { ServiceAccount } from 'firebase-admin';

// ---------------------------------------------------------------------------
// 1. Parse Service Account từ Base64 Environment Variable
//    Chuỗi Base64 được decode → JSON string → Object.
//    Nếu biến không tồn tại hoặc JSON không hợp lệ, server PHẢI dừng lại
//    ngay lập tức (fail-fast) để tránh chạy mà không có xác thực DB.
// ---------------------------------------------------------------------------
function parseServiceAccount(): ServiceAccount {
  const base64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;

  if (!base64) {
    throw new Error(
      '[be-wms] FATAL: Missing FIREBASE_SERVICE_ACCOUNT_BASE64 environment variable. ' +
        'Server cannot start without Firebase credentials.'
    );
  }

  try {
    const jsonString = Buffer.from(base64, 'base64').toString('utf-8');
    const parsed = JSON.parse(jsonString) as ServiceAccount;

    // Kiểm tra tối thiểu: JSON phải chứa project_id
    if (!parsed.projectId && !(parsed as Record<string, unknown>)['project_id']) {
      throw new Error('Service Account JSON is missing "project_id" field.');
    }

    return parsed;
  } catch (error) {
    throw new Error(
      '[be-wms] FATAL: Failed to parse FIREBASE_SERVICE_ACCOUNT_BASE64. ' +
        'Ensure the value is a valid Base64-encoded JSON string. ' +
        `Detail: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// ---------------------------------------------------------------------------
// 2. Initialize Firebase Admin App (Singleton pattern)
//    Kiểm tra admin.apps để tránh khởi tạo trùng khi hot-reload (nodemon/tsx).
// ---------------------------------------------------------------------------
if (!admin.apps.length) {
  const serviceAccount = parseServiceAccount();

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  // Log xác nhận kết nối thành công — hiển thị Project ID để dễ debug
  const projectId =
    serviceAccount.projectId ||
    (serviceAccount as Record<string, unknown>)['project_id'];
  console.log(`[be-wms] ✅ Firebase Admin initialized for Project: ${projectId}`);
}

// ---------------------------------------------------------------------------
// 3. Export các instance để sử dụng trong toàn bộ Backend App
//    - `admin`: Truy cập đầy đủ Firebase Admin namespace.
//    - `db`: Firestore Admin instance (dùng cho mọi CRUD + Transaction).
//    - `auth`: Firebase Auth Admin (dùng để verify JWT, quản lý user).
// ---------------------------------------------------------------------------
const db = admin.firestore();
const auth = admin.auth();

export { admin, db, auth };
