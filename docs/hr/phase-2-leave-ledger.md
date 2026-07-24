# Phase 2: Sổ cái và số dư ngày phép

## Phạm vi

Phase 2 triển khai nguồn dữ liệu ngày phép trước khi kết nối đơn xin nghỉ:

- `leave_ledger_entries`: sổ cái bất biến, mỗi thay đổi là một bút toán mới;
- `leave_balance_buckets`: số dư chiếu theo nhân viên và năm phép;
- cộng phép vào ngày 15 hằng tháng;
- khóa phần tích lũy trong thời gian thử việc;
- mở khóa khi trạng thái chính thức có hiệu lực;
- hết hạn số dư năm cũ sau ngày 31/03 năm kế tiếp;
- trang Hành chính đọc số dư và lịch sử theo thời gian thực.

Các phép tính mặc định là 1 đơn vị/tháng và tối đa 12 đơn vị/năm. Nếu collection
`leave_policies` có document `company`, job sử dụng cấu hình trong document đó.

## Idempotency và audit

Document ID của ledger là SHA-256 của `idempotency_key`. Transaction đọc ledger
và balance trước khi ghi, vì vậy chạy lại cùng kỳ không tạo thêm số dư.

Mỗi bút toán ledger và thay đổi balance đều tạo `audit_logs` với dữ liệu cũ/mới.
Ledger không có luồng update hoặc delete; sai lệch về sau phải dùng bút toán điều
chỉnh/đảo ngược.

## Lịch vận hành

Cloud Scheduler gọi hằng ngày:

```text
POST /api/leave/cron/maintenance
x-cron-secret: <LEAVE_MAINTENANCE_CRON_SECRET>
```

Body mặc định là `{}`. Khi cần chạy lại một ngày xử lý bị bỏ lỡ, operator có thể
gửi:

```json
{
  "posting_date": "2026-07-15"
}
```

Job chỉ cộng phép nếu `posting_date` là ngày 15. Mở khóa thử việc và hết hạn được
đối soát trong mọi lần chạy.

Phase 2 không tự tạo dữ liệu cho các kỳ trước khi chức năng xuất hiện. Dữ liệu
lịch sử được đưa vào bằng luồng import có phiên bản và chống trùng ở giai đoạn
import riêng.

## Triển khai

1. Cấu hình `LEAVE_MAINTENANCE_CRON_SECRET`.
2. Deploy `firestore.rules` và `firestore.indexes.json`.
3. Deploy backend và frontend.
4. Tạo Cloud Scheduler chạy mỗi ngày theo timezone `Asia/Ho_Chi_Minh`.
5. Chạy `pnpm test:hr-phase2` và `pnpm test:firestore-rules`.
