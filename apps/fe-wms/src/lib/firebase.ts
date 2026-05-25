/**
 * Firebase Client SDK — Local-First Initialization
 *
 * Cấu hình Firebase Client SDK v10+ (modular) cho WMS Frontend.
 * Sử dụng IndexedDB persistent cache để đảm bảo kiến trúc Local-First:
 * - Dữ liệu Firestore được lưu trữ offline trên trình duyệt.
 * - Hỗ trợ đồng bộ multi-tab (nhiều tab cùng truy cập một bộ cache).
 * - Khi mất mạng, app vẫn đọc được dữ liệu từ cache cục bộ.
 *
 * @see wms-core-rules.md §2 — Local-First Architecture
 */

import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from "firebase/firestore";
import { getAuth, type Auth } from "firebase/auth";
import { getStorage, type FirebaseStorage } from "firebase/storage";

// ---------------------------------------------------------------------------
// 1. Firebase Config — Đọc từ biến môi trường NEXT_PUBLIC_*
//    Các biến này an toàn khi expose ra client vì chúng chỉ là public keys
//    dùng để xác định Firebase project, không chứa bí mật.
// ---------------------------------------------------------------------------
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// ---------------------------------------------------------------------------
// 2. Initialize Firebase App (Singleton pattern)
//    Kiểm tra xem đã có instance nào chưa để tránh khởi tạo trùng lặp
//    khi Next.js hot-reload hoặc re-render.
// ---------------------------------------------------------------------------
const app: FirebaseApp =
  getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);

// ---------------------------------------------------------------------------
// 3. Initialize Firestore với IndexedDB Persistent Cache
//    ► LÝ DO: Đây là điểm mấu chốt của kiến trúc "Local-First".
//      - `persistentLocalCache`: Lưu toàn bộ dữ liệu Firestore xuống
//        IndexedDB trên trình duyệt, giúp app hoạt động offline.
//      - `persistentMultipleTabManager`: Cho phép nhiều tab chia sẻ
//        cùng một bộ cache mà không xung đột.
//    ► CHÚ Ý: Một số trình duyệt (private mode, cũ) không hỗ trợ
//      multi-tab persistence. Trong trường hợp đó, Firestore vẫn hoạt
//      động nhưng sẽ dùng in-memory cache thay vì IndexedDB.
// ---------------------------------------------------------------------------
let db: Firestore;

try {
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager(),
    }),
  });
} catch (error) {
  // Trường hợp thất bại: Trình duyệt không hỗ trợ hoặc đã có instance
  // Firestore được khởi tạo trước đó (do hot-reload).
  // Fallback: Sử dụng getFirestore() thay vì initializeFirestore().
  console.warn(
    "[fe-wms] Persistent cache initialization failed. " +
      "Falling back to default Firestore instance. " +
      "Offline support may be limited.",
    error,
  );

  // Import động getFirestore để dùng làm fallback
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { getFirestore } = require("firebase/firestore");
  db = getFirestore(app);
}

// ---------------------------------------------------------------------------
// 4. Initialize Firebase Auth
// ---------------------------------------------------------------------------
const auth: Auth = getAuth(app);

// ---------------------------------------------------------------------------
// 5. Initialize Firebase Storage
// ---------------------------------------------------------------------------
const storage: FirebaseStorage = getStorage(app);

// ---------------------------------------------------------------------------
// 6. Export các instance để sử dụng trong toàn bộ Frontend App
//    - `app`: Firebase App instance (ít dùng trực tiếp).
//    - `db`: Firestore instance (dùng cho mọi truy vấn dữ liệu).
//    - `auth`: Firebase Auth instance (dùng cho đăng nhập / phân quyền).
//    - `storage`: Firebase Storage instance (dùng cho upload file/hình ảnh).
// ---------------------------------------------------------------------------
export { app, db, auth, storage };
