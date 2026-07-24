# Phase 3: Đơn nghỉ phép, ngày lễ và giữ số dư

## Phạm vi

Phase 3 triển khai luồng tự phục vụ cho nhân viên:

- quản lý ngày lễ áp dụng toàn công ty;
- tạo đơn nháp hoặc gửi đơn nghỉ phép;
- chọn từng ngày và chọn cả ngày, buổi sáng hoặc buổi chiều;
- kiểm tra ngày cuối tuần, ngày lễ, ngày trùng và quy tắc khoảng ngắt;
- chỉ giữ số dư đối với `PAID_ANNUAL`;
- xem lịch sử đơn theo thời gian thực;
- hủy đơn nháp hoặc đơn đang chờ duyệt;
- hoàn trả số dư đang giữ khi hủy đơn.

Chứng từ đính kèm không thuộc luồng này theo yêu cầu nghiệp vụ hiện tại.

## Quy tắc giao dịch

Đơn nháp không tạo reservation và không giữ số dư. Khi gửi duyệt, một Firestore
transaction thực hiện đồng thời:

1. kiểm tra lại trạng thái đơn;
2. kiểm tra trùng buổi sáng/buổi chiều trong `leave_day_reservations`;
3. phân bổ số dư khả dụng theo năm cũ nhất còn hạn;
4. chuyển số dư từ `available_units` sang `held_units`;
5. ghi `REQUEST_HOLD` vào sổ cái;
6. tạo reservation cho từng ngày;
7. chuyển đơn sang `PENDING_APPROVAL`.

Khi hủy đơn đang chờ duyệt, transaction đảo các bước giữ số dư bằng
`REQUEST_RELEASED`, giải phóng reservation theo từng nửa ngày và chuyển đơn sang
`CANCELLED`. Không có document nghiệp vụ nào bị xóa cứng.

Phép của năm cũ chỉ được phân bổ cho ngày nghỉ không muộn hơn 31/03 năm kế tiếp.
Việc kiểm tra được thực hiện theo từng ngày trong đơn, do đó một đơn nằm hai phía
của ngày 31/03 vẫn phân bổ đúng từng bucket.

## API

```text
GET    /api/leave/holidays?year=2026
POST   /api/leave/holidays
DELETE /api/leave/holidays/:id

GET    /api/leave/me/requests
POST   /api/leave/me/requests
POST   /api/leave/me/requests/:id/submit
POST   /api/leave/me/requests/:id/cancel
```

Mọi payload ghi dữ liệu có `action_time`; backend ghi `sync_time`, audit cũ/mới
và kiểm tra permission theo nơi làm việc của hồ sơ nhân viên. Client không được
ghi trực tiếp các collection ngày phép.

## Ranh giới với Phase 4

Gửi duyệt chỉ thành công khi document `leave_approval_configs/company` có từ một
đến ba cấp đang bật. Nếu chưa có cấu hình hợp lệ, API trả `409` với thông báo
Việt/Trung và người dùng vẫn có thể lưu nháp.

Phase 4 sẽ cung cấp giao diện cấu hình, snapshot tuyến duyệt, tác vụ duyệt tuần
tự, phân công theo role có permission hoặc người cụ thể, xử lý
`APPROVER_UNAVAILABLE` và bút toán `REQUEST_APPROVED`/`REQUEST_RELEASED` khi cấp
duyệt cuối cùng hoàn tất hoặc từ chối.

## Triển khai

1. Deploy backend và frontend.
2. Deploy `firestore.rules`.
3. Deploy `firestore.indexes.json`.
4. Chạy `pnpm test:hr-phase3`.
5. Chạy `pnpm test:firestore-rules`.
