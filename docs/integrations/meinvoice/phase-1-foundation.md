# meInvoice — Giai đoạn 1: Domain và cấu hình

Trạng thái: hoàn thành phần code; contract sandbox token/templates PASS, chờ UAT cấu hình  
Ngày cập nhật: 20/07/2026

## Thành phần đã triển khai

- Domain enums, account/store types và state transition tại `packages/shared-types/src/invoices.ts`.
- Nhóm quyền `invoices` gồm read, prepare, review, issue, retry, download, reconcile và config.
- Invoice permission chỉ hợp lệ cho facility loại `STORE`.
- Account pháp nhân MISA tách khỏi store binding.
- AES-256-GCM với AAD và key nội bộ riêng cho ClientID, ClientSecret, username, password và token.
- Allowlist cứng cho gateway MISA Developer; `MEINVOICE_CONFIG_ENCRYPTION_KEY` tách biệt hoàn toàn với ClientSecret.
- Token cache mã hóa: refresh sau 7 ngày, expiry 14 ngày, tự vô hiệu khi `credential_revision` thay đổi.
- `MeInvoiceClient` cho `/invoice/token` và `/invoice/templates` theo contract MISA Developer.
- API quản trị account, test kết nối, store binding và validate series.
- Audit log cho tạo/sửa/test account và lưu/validate store config.
- Firestore rules/indexes cho collections hóa đơn và cấu hình.
- Unit test, authorization test, Firestore emulator test và sandbox contract test có điều kiện.
- Full-day HKAPI sync lấy toàn bộ trang danh sách, hàng hóa và chi tiết từng đơn.
- Raw payload tách khỏi projection, client không được đọc; revision bất biến theo SHA-256 chỉ tạo khi payload đổi.
- Thời điểm nghiệp vụ và thời điểm đồng bộ được lưu riêng; thành tiền trước thuế dùng công thức đã duyệt `realMoney - taxMoney`.

## API cấu hình

```text
GET  /api/meinvoice/accounts
POST /api/meinvoice/accounts
PUT  /api/meinvoice/accounts/:id
POST /api/meinvoice/accounts/:id/test

GET  /api/meinvoice/store-configs/:warehouseId
PUT  /api/meinvoice/store-configs/:warehouseId
POST /api/meinvoice/store-configs/:warehouseId/validate

POST /api/invoices/source-orders/sync
GET  /api/invoices/source-orders?warehouse_id=:id&business_date=YYYY-MM-DD
GET  /api/invoices/source-orders/:id?warehouse_id=:id
```

Account endpoints chỉ dành cho system admin. Store config endpoints yêu cầu `invoices.config` tại đúng `warehouseId`; service kiểm tra lại cùng permission trên tài nguyên cụ thể.

## Trình tự cấu hình an toàn

1. System admin tạo account với `enabled = false` và nhập credential.
2. Gọi `/accounts/:id/test`; backend lấy token và tải template có mã/không mã.
3. Chỉ sau khi test thành công mới cập nhật account thành `enabled = true` mà không gửi lại credential.
4. Người có `invoices.config` lưu store config với `enabled = false`.
5. Gọi `/store-configs/:warehouseId/validate` để kiểm tra account và `InvSeries` đang hoạt động.
6. Gửi lại đúng store config với `enabled = true`.

Thay credential, MST, environment hoặc trường ảnh hưởng validation sẽ tự xóa trạng thái kiểm tra cũ và buộc test/validate lại.

## Biến môi trường

```dotenv
MEINVOICE_CONFIG_ENCRYPTION_KEY=
MEINVOICE_SANDBOX_CLIENT_ID=
MEINVOICE_SANDBOX_CLIENT_SECRET=
MEINVOICE_SANDBOX_TAX_CODE=
MEINVOICE_SANDBOX_USERNAME=
MEINVOICE_SANDBOX_PASSWORD=
```

Năm biến sandbox chỉ dùng cho contract test. Credential cấu hình qua API được mã hóa trước khi lưu Firestore. Không commit giá trị thật.

## Collections

- `meinvoice_accounts`: server write, system-admin read projection.
- `meinvoice_store_configs`: server write, đọc theo `invoices.config` tại store.
- `meinvoice_tokens`: server-only, client bị từ chối kể cả system admin.
- `invoice_source_orders`: projection đơn hàng đã chuẩn hóa, đọc theo `invoices.read`.
- `invoice_source_order_payloads/{id}/revisions`: toàn bộ raw HKAPI và lịch sử payload, server-only.
- `invoice_order_sync_runs`: lịch sử mỗi lần đồng bộ theo ngày và mục đích issue/reconciliation.
- `invoice_documents`: rules/index baseline cho giai đoạn phát hành.
- `invoice_issue_jobs/{jobId}/items`: item realtime có scope riêng; parent job chỉ system admin đọc trực tiếp.
- `invoice_queue_lanes`, `invoice_sync_cursors`: server-only.

## Kiểm tra đã chạy

```text
@bduck/shared-types typecheck                  PASS
@bduck/be-wms typecheck                        PASS
@bduck/be-wms build                            PASS
test:meinvoice-foundation                      15/15 PASS
test:authorization                             81/81 PASS
test:firestore-rules                           PASS
test:meinvoice-contract                        1/1 PASS (token + template có mã/không mã)
```

ESLint chưa chạy được vì workspace hiện không có executable/config ESLint khả dụng cho command package; typecheck, build và các test mục tiêu đã chạy thành công.

## Phần còn chờ để đóng giai đoạn

- Thực hiện UAT quy trình tạo account, test kết nối, gắn store config và validate series trên dữ liệu cấu hình thật.
- Đặt timestamp go-live khi chức năng hoàn thành và chuẩn bị kích hoạt phát hành.
- Thu thập fixture HKAPI đã ẩn PII và ký duyệt mapping với kế toán.
- Deploy Firestore rules/indexes vào môi trường thử nghiệm sau khi review.
