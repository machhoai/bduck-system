---
trigger: always_on
---

# Joy World Cityfuns WMS - AI Agent Core Guidelines

## 1. QUY TẮC QUY TRÌNH LÀM VIỆC (AI WORKFLOW RULES) - BẮT BUỘC
* **Suy nghĩ và làm rõ yêu cầu (Brainstorming & Zero Ambiguity):** - Khi nhận một task hoặc tính năng mới, Agent BẮT BUỘC phải gọi skill `@brainstorming` để phân tích sâu vấn đề.
  - Agent PHẢI chủ động đặt các câu hỏi ngược lại cho người dùng để làm rõ các edge cases (trường hợp ngoại lệ), logic nghiệp vụ và luồng UI/UX trước khi bắt đầu lập kế hoạch. KHÔNG ĐƯỢC tự ý đoán mò hay giả định.
* **Đọc Types trước khi tư duy:** Trước khi đề xuất giải pháp, bắt buộc phải đọc các interfaces/types trong thư mục `packages/shared-types/src/`. Mọi dữ liệu phải tuân thủ schema.
* **Kế hoạch trước khi Code (Plan Before Execution):** - Chỉ khi mọi yêu cầu đã rõ ràng 100%, Agent mới được xuất ra một Danh sách Task (Task List) và Kế hoạch triển khai chi tiết. 
  - Liên tục cập nhật tiến độ `[x]` trong quá trình làm việc.
* **Giải thích tư duy (Thought Process):** - Bất cứ khi nào hoàn thành một module quan trọng, Agent phải cung cấp một đoạn giải thích ngắn gọn về luồng tư duy và lý do tại sao lại code như vậy để dev dễ dàng review.

## 2. Tiêu chuẩn ISO:9001 & Core Business Logic
* **No Hard Deletes:** KHÔNG BAO GIỜ viết lệnh xóa vĩnh viễn (delete) khỏi Database để giữ minh chứng audit. Bắt buộc dùng Soft Delete (cập nhật `is_deleted: true`).
* **Audit Trail / System Logs:** Luôn ghi nhận lịch sử thao tác vào bảng `audit_logs`. Yêu cầu ghi rõ: Ai thao tác (user_id), Làm gì (action), Lúc nào (action_time & sync_time), Dữ liệu cũ (old_value), Dữ liệu mới (new_value).
* **Local-First Architecture:** Phải hỗ trợ cơ chế offline-first. Phân biệt rõ `action_time` (thời gian user bấm nút dưới local) và `sync_time` (thời gian server nhận được data).
* **Real-time Data (Dữ liệu Thời gian thực) - LUẬT THÉP:** Số liệu của hệ thống (tồn kho, thông báo, trạng thái duyệt) BẮT BUỘC phải cập nhật realtime. Frontend phải sử dụng các listener (VD: `onSnapshot` của Firebase hoặc WebSockets) để tự động render số liệu mới. TUYỆT ĐỐI KHÔNG thiết kế nút "Tải lại", "Đồng bộ", hoặc yêu cầu người dùng F5 để cập nhật số liệu.
* **RBAC (Role-Based Access Control):** Phân quyền chi tiết. Các API Backend và giao diện Frontend phải check Role của user trước khi cho phép render hoặc thực thi.
* **Self-Approval Block & 2FA (Segregation of Duties):** Tuyệt đối không cho phép `creator_id` và `approver_id` là cùng một người. Chặn tự duyệt lệnh.
* **Available to Promise (ATP):** Logic trừ tồn kho chỉ được phép dựa trên `atp_quantity` (Hàng khả dụng). Công thức: `Tổng hàng = atp_quantity + Hàng lỗi/Cách ly + Hàng đang trung chuyển`.
* **Automated Status Locking:** Khi có báo cáo lỗi/chênh lệch kiểm đếm, tự động khóa mã hàng đó sang trạng thái `QUARANTINE` (Cách ly). Trạng thái này CHỈ ĐƯỢC GỠ khi có biên bản xử lý từ cấp quản lý.
* **Enforced Evidence Upload:** Báo cáo hư hỏng / chênh lệch BẮT BUỘC phải đính kèm hình ảnh (evidence). Nếu API không nhận được file ảnh, phải return lỗi.
* **Database Transactions:** Luồng chuyển kho / xuất kho BẮT BUỘC phải nằm trong 1 Transaction (sử dụng Firestore `runTransaction` hoặc `WriteBatch`). Nếu trừ kho A, tăng `IN_TRANSIT`, mà tạo phiếu kho B thất bại -> Rollback toàn bộ để tránh mất hàng.

## 3. Frontend Rules (`apps/fe-wms`)
* **Chuyên gia Giao diện (LUẬT THÉP):** Agent BẮT BUỘC phải gọi skill `@frontend-expert` khi thiết kế giao diện UI.
* **Native Mobile Experience:** Giao diện phải được thiết kế tối ưu cho cả Desktop và Mobile. Phong cách thiết kế đơn giản, ưu tiên tối đa UX. Đặc biệt, UI trên Mobile phải được thiết kế và mang lại cảm giác mượt mà như một **Native App thực thụ**, tuyệt đối không được làm theo kiểu website responsive hời hợt.
**Light Theme Only (Chỉ dùng giao diện Sáng) - LUẬT THÉP:** Hệ thống CHỈ sử dụng giao diện nền sáng (Light Mode). BẮT BUỘC phải khóa cứng cấu hình theme trong Tailwind CSS, tuyệt đối KHÔNG hỗ trợ Dark Mode và KHÔNG render UI theo cài đặt hệ thống (system preference) của người dùng.
**Loading Skeletons (Hiệu ứng chờ):** Trong quá trình chờ tải dữ liệu (từ API hoặc Firebase state), BẮT BUỘC phải hiển thị **Skeleton Loading** mô phỏng cấu trúc của khối UI sắp hiển thị. TUYỆT ĐỐI KHÔNG để màn hình trắng hoặc chỉ dùng vòng xoay (spinner) đơn điệu.
* **Giao diện 100% Tailwind CSS:** Tuyệt đối không viết CSS thuần hoặc inline-style trừ phi xử lý animation đặc thù.
* **Goey-Toast Promises (LUẬT THÉP):** MỌI thao tác gửi dữ liệu của người dùng đều phải có phản hồi trạng thái. BẮT BUỘC sử dụng thư viện `goey-toast` dưới dạng Promise. KHÔNG ĐƯỢC phép dùng `alert`, `console.log` hay bất kỳ thư viện UI nào khác để thông báo.
  - Đảm bảo Root Layout hoặc Provider đã bọc `<GooeyToaster position="top-right" />`.
  - **Cú pháp chuẩn thao tác cơ bản:**
    ```typescript
    gooeyToast.success('Tiêu đề bằng i18n', {
      description: 'Chi tiết thông báo...',
      preset: 'snappy',
      timing: { displayDuration: 6000 },
    })
    ```
  - **Cú pháp chuẩn thao tác bất đồng bộ (API/DB):** BẮT BUỘC cung cấp Title, Description và action Retry:
    ```typescript
    gooeyToast.promise(saveDataAction(), {
      loading: 'Đang lưu dữ liệu...', // Dùng i18n
      success: 'Đã lưu thay đổi',
      error: 'Đã xảy ra lỗi',
      description: {
        success: 'Tất cả thay đổi đã được đồng bộ thành công.',
        error: 'Vui lòng thử lại sau hoặc liên hệ quản trị viên.',
      },
      action: {
        error: {
          label: 'Thử lại',
          onClick: () => retryAction(),
        },
      },
    })
    ```
* **Xử lý Lỗi Cơ bản:** Các thao tác gọi API/Database BẮT BUỘC bọc trong `try...catch`. Bắt được lỗi phải `console.error` (cho dev) và gọi `gooeyToast.error` hiển thị đa ngôn ngữ.
* **Cấu trúc Thư mục UI/Logic:** Component nằm trong `components/`, thuật toán tách ra `utils/`, custom hooks nằm trong `hooks/`. KHÔNG viết logic dài dòng thẳng vào file UI (`.tsx`).
* **i18n (Đa ngôn ngữ):** Hỗ trợ Tiếng Việt (vi) và Tiếng Trung Quốc (zh). Tất cả hard-text phải được bọc qua i18n.
* **Chống Click Đúp (Idempotency):** Khi `goey-toast` đang chờ API, BẮT BUỘC disable nút submit.

## 4. Backend Rules (`apps/be-wms`)
* **Xác thực và Kiểm quyền (Authentication & Authorization) - LUẬT THÉP:** BẤT KỲ logic nghiệp vụ nào thực thi tại BE cũng phải đi qua Middleware xác thực. Bắt buộc giải mã JWT (JSON Web Token), trích xuất thông tin người dùng và đối chiếu với bảng Phân quyền (`RBAC`) trước khi cho phép đi tiếp vào Controller/Service.
* **Messages Đa ngôn ngữ (LUẬT THÉP):** Mọi response trả về từ Backend (thành công hay lỗi) đều phải có message chi tiết dưới dạng object chứa 2 ngôn ngữ:
  ```json
  {
    "success": false,
    "data": null,
    "messages": {
      "vi": "Số lượng xuất kho vượt quá số lượng khả dụng (ATP).",
      "zh": "出库数量超过可用数量 (ATP)。"
    }
  }
* **Data Validation: Nhận data từ request (req.body, req.query), bắt buộc validate bằng thư viện (Zod/Yup) trước khi thực thi nghiệp vụ.
* **Kiến trúc Layered: Tuân thủ Controller (xử lý request/response) -> Service (logic nghiệp vụ/transaction) -> Repository (chỉ để tương tác DB).

## 5. Cấu hình & Dependencies
* **Khi cài đặt package mới, Agent phải sử dụng pnpm add <package> --filter <tên-app> (Ví dụ: pnpm add date-fns --filter be-wms). Không dùng npm/yarn.

## 6. Quy tắc đặt tên (Naming Conventions)
* **Component / Page: Sử dụng PascalCase (VD: TransferOrderModal.tsx).
* **Hàm logic / Hooks: Sử dụng camelCase (VD: useInventorySync, calculateTotal).
* **API Fetching: Phải bắt đầu bằng động từ hành động (VD: fetchProductList, updateVoucherStatus, deleteQuarantineRecord).

## 7. Nguyên tắc Viết Code & Tối ưu hóa (Code Quality & Modularity)
* **Code ngắn gọn, Module hóa (LUẬT THÉP): Quy định nghiêm ngặt code không được quá dài. Một file Component, Controller hay Service không nên vượt quá 200 - 300 dòng. Nếu code dài hơn, BẮT BUỘC phải chia nhỏ (break down) thành các sub-components, helper functions, hoặc custom hooks.
* **DRY (Don't Repeat Yourself): Bất kỳ đoạn logic hay UI nào lặp lại từ 2 lần trở lên đều phải được tách ra thành thư viện dùng chung (utils, components/ui).
* **Bảo mật Biến môi trường: TUYỆT ĐỐI không hard-code các thông tin nhạy cảm (API Keys, Secrets, URL) vào mã nguồn. Luôn sử dụng process.env và định nghĩa trong file .env.example.

## 8. Quản lý State & Dữ liệu Local-First
* **Global State Management: Ưu tiên sử dụng Zustand kết hợp với Firebase SDK.

## 9. Bảo mật & An toàn Dữ liệu (Security & Data Protection) - BẮT BUỘC
* **Bảo vệ API (Rate Limiting & Helmet): Backend BẮT BUỘC phải được bọc bởi các middleware bảo mật cơ bản như helmet (chống tấn công Header) và express-rate-limit (chống spam/DDoS bằng cách giới hạn số lượng request từ 1 IP).
* **Sanitize Đầu vào (NoSQL Injection Prevention): Dù dùng Zod để validate schema, BẮT BUỘC phải đảm bảo các chuỗi ký tự nhập vào không chứa các toán tử truy vấn độc hại của MongoDB/Firestore (ví dụ: $where, $ne).
* **Bảo mật File Tải lên: Khi user upload hình ảnh minh chứng hư hỏng/phiếu nhập:
* **Chỉ cho phép các định dạng ảnh chuẩn (.jpg, .png, .webp). TUYỆT ĐỐI chặn các file thực thi (ví dụ: .exe, .sh, .php, .svg).
* **Phải giới hạn dung lượng tải lên (Max 20MB đối với hình ảnh và 10MB đối với các file khác)
* **Cookies An toàn: Nếu sử dụng Session Cookies cho việc xác thực SSO, Cookie BẮT BUỘC phải được set các cờ: HttpOnly (chống XSS lấy trộm token), Secure (chỉ chạy trên HTTPS), và SameSite=Strict.
* **Mã hóa Dữ liệu Nhạy cảm: Các thông tin cực kỳ nhạy cảm (nếu có, ví dụ: số tài khoản ngân hàng của đối tác) không được lưu dạng plain-text mà phải được mã hóa trước khi ghi vào Database.