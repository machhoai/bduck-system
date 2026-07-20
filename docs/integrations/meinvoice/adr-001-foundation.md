# ADR-001 — Nền tảng tích hợp MISA meInvoice

Trạng thái: đề xuất, đã triển khai phần nền tảng  
Ngày: 20/07/2026

## Bối cảnh

Hóa đơn phải chống trùng, xử lý tuần tự theo tài khoản + ký hiệu, hỗ trợ nhiều cửa hàng và không để frontend giữ credential. Repository đang chạy backend trên Cloud Run, dùng Firestore, facility-scoped authorization, audit log và đã có dependency Cloud Tasks.

## Quyết định

1. Tách `MeInvoiceClient` khỏi nguồn đơn hàng và orchestration.
2. Lưu account pháp nhân riêng với store binding.
3. Mã hóa ClientID, ClientSecret, username, password và token bằng AES-256-GCM với AAD theo account/field và key nội bộ riêng `MEINVOICE_CONFIG_ENCRYPTION_KEY`.
4. Chỉ chấp nhận gateway chính thức `https://developer.misa.vn/apis/itg/meinvoice` trong allowlist; ClientSecret không được dùng thay encryption key nội bộ.
5. Token được cache mã hóa trong Firestore, refresh sau 7 ngày và hết hạn nội bộ sau 14 ngày; `credential_revision` làm vô hiệu token khi credential thay đổi.
6. Account credential chỉ system admin quản lý; store binding cần `invoices.config` tại đúng cửa hàng.
7. Frontend chỉ đọc public projection; mọi write đi qua backend Admin SDK và audit.
8. Giai đoạn phát hành sẽ dùng Cloud Tasks + Firestore lane lease theo `account_id + inv_series`.
9. Mọi API nghiệp vụ gửi `ClientID` và Bearer token; chỉ `/invoice/token` gửi thêm `ClientSecret`.

## Hệ quả

- Không thể bật store config khi chưa xác nhận `price_includes_vat`.
- Không thể dùng URL MISA tùy chỉnh mà không sửa allowlist và review bảo mật.
- Account có thể test khi đang disabled, nhưng store config enabled chỉ được trỏ tới account enabled.
- Thay credential bắt buộc chạy lại test token/templates.
- Dùng `/invoice/paging` cho đối chiếu danh sách hóa đơn theo ngày và internal ledger cho idempotency.
