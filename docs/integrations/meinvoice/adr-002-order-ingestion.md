# ADR-002 — Lưu đầy đủ dữ liệu đơn hàng phục vụ hóa đơn

Trạng thái: chấp nhận và đã triển khai nền tảng  
Ngày: 20/07/2026

## Bối cảnh

Mỗi lần người dùng chuẩn bị phát hành hoặc đối chiếu hóa đơn theo ngày, hệ thống phải kéo toàn bộ dữ liệu đơn hàng HKAPI về Firestore để tra cứu lâu dài. Dữ liệu có PII và có thể thay đổi sau lần đồng bộ đầu tiên.

## Quyết định

1. Đồng bộ toàn bộ trang của ba nguồn: danh sách đơn, danh sách hàng và chi tiết từng đơn.
2. `invoice_source_orders` chỉ chứa projection cần cho tra cứu và đối chiếu.
3. `invoice_source_order_payloads` chứa raw payload đầy đủ và bị chặn toàn bộ truy cập client.
4. Mỗi payload có SHA-256 từ canonical JSON. Khi hash đổi, lưu thêm revision bất biến; chạy lại không đổi không tạo revision mới.
5. Tách `source_action_time` khỏi `source_sync_time` và lưu `business_date` theo ngày người dùng chọn ở múi giờ Việt Nam.
6. Thời điểm thanh toán là `payTime` cuối cùng có `payStatus = 2`; nếu nguồn không có dòng thành công thì giữ fallback để review, không tự phát hành.
7. Tính `amount_before_tax = realMoney - taxMoney` theo quyết định nghiệp vụ đã phê duyệt; nếu thiếu một trong hai trường thì giữ `null` để review.
8. Mỗi lần chạy có `invoice_order_sync_runs` và audit summary, không ghi raw payload/PII vào audit.

## Hệ quả

- Có thể tái dựng mapping và tính lại hóa đơn từ dữ liệu nguồn lịch sử mà không phải gọi lại HKAPI.
- Dữ liệu raw tốn thêm dung lượng nhưng không bị ghi đè mất lịch sử.
- Một ngày nhiều đơn hiện được xử lý đồng bộ trong request; khi đo được lưu lượng thực tế sẽ chuyển orchestration sang Cloud Tasks mà không đổi repository/schema.
