# Walkthrough: Phase 0 - Backend Foundation

Tôi đã hoàn thành Phase 0 theo đúng lộ trình thiết kế. Các nền tảng cho Backend (`apps/be-wms`) đã được thiết lập sẵn sàng để phục vụ cho các module thực tế ở Phase 1.

## Những gì đã làm:

### 1. ISO 9001 Audit Trail (IMMUTABLE Log)
- Tạo [auditService.ts](file:///d:/Github/bduck-system/apps/be-wms/src/services/auditService.ts) hỗ trợ duy nhất thao tác INSERT (không update, không delete).
- Tạo [auditMiddleware.ts](file:///d:/Github/bduck-system/apps/be-wms/src/api/middlewares/auditMiddleware.ts) để tự động bắt các response API thành công (`res.statusCode < 300`) và đẩy dữ liệu vào `auditService` một cách bất đồng bộ để không làm chậm response. Ghi nhận đầy đủ `action_time` (khi user bấm) và `sync_time` (khi server nhận).

### 2. Base CRUD Repository
- Xây dựng [baseRepository.ts](file:///d:/Github/bduck-system/apps/be-wms/src/repositories/baseRepository.ts) cho thao tác với Firestore.
- Bắt buộc dùng Soft Delete (đúng theo LUẬT THÉP), các hàm `create`/`update` tự động quản lý `created_at` và `updated_at`. Hàm `softDelete` chỉ update `is_deleted: true`.

### 3. Data Validation (Zod)
- Đã cài đặt `zod` vào `apps/be-wms`.
- Tạo [zodSchemas.ts](file:///d:/Github/bduck-system/apps/be-wms/src/utils/zodSchemas.ts) định nghĩa sẵn các validation cho Phase 1 sắp tới (Products, Categories, Warehouses, Locations, Pagination, IDs).

### 4. Voucher Number Generator
- Tạo [voucherNumberGenerator.ts](file:///d:/Github/bduck-system/apps/be-wms/src/utils/voucherNumberGenerator.ts) tạo mã như `IMP-20260522-0001` an toàn kể cả trong môi trường đồng thời cao nhờ dùng `db.runTransaction` và `FieldValue.increment`.

### 5. Standardized Response Format
- Tạo [responseHelper.ts](file:///d:/Github/bduck-system/apps/be-wms/src/utils/responseHelper.ts) bọc chuẩn response đa ngôn ngữ `{ success, data, messages: { vi, zh } }`.

> [!TIP]
> Tất cả các cấu trúc này sẽ giúp Phase 1 (CRUD API) được viết cực kỳ ngắn gọn và DRY (Don't Repeat Yourself) theo đúng quy tắc đã đề ra trong rules.md.
