# Giai đoạn 7 — Migration và rollout

## Phạm vi

- Chuẩn hóa schema hồ sơ cũ mà không tự suy đoán ngày lao động.
- Đối soát toàn bộ `leave_ledger_entries` với `leave_balance_buckets`.
- Ghi audit cho mọi sửa chữa read model và lưu báo cáo đối soát.
- Triển khai Firestore Rules/indexes trước khi mở tính năng.
- Cấu hình Cloud Scheduler chạy maintenance hằng ngày theo
  `Asia/Ho_Chi_Minh`.
- Dùng feature flag ở cả backend và frontend; backend là cổng kiểm soát cuối.

## Nguyên tắc an toàn

- Mọi script migration mặc định là dry-run.
- Chỉ `--apply` mới ghi dữ liệu.
- Không suy đoán nhân viên cũ là thử việc hay chính thức.
- Không sửa/xóa ledger. Reconciliation chỉ sửa read model bucket từ tổng delta
  bất biến trong ledger.
- Khi repair phải tắt feature flag và tạm dừng Scheduler để tránh thay đổi đồng
  thời. Transaction sẽ bỏ qua bucket đã thay đổi kể từ lúc quét.
- Không rollback bằng cách xóa dữ liệu; tắt feature flag và tạo bút toán điều
  chỉnh nếu cần sửa nghiệp vụ.

## Quy trình triển khai

### 1. Giữ tính năng đóng

```dotenv
LEAVE_FEATURE_ENABLED=false
NEXT_PUBLIC_LEAVE_FEATURE_ENABLED=false
```

Production mặc định đóng nếu biến chưa được cấu hình. Development mặc định mở
để không làm gián đoạn kiểm thử cục bộ.

Với image frontend, `NEXT_PUBLIC_LEAVE_FEATURE_ENABLED` là build argument. Đặt
GitHub Actions variable cùng tên rồi rebuild image; đổi biến runtime sau khi
image đã build sẽ không thay đổi giao diện.

### 2. Triển khai schema bảo mật

```powershell
firebase deploy --only firestore:indexes,firestore:rules
```

Chờ toàn bộ index về trạng thái `READY` trước bước tiếp theo.

### 3. Backfill hồ sơ

```powershell
pnpm migrate:employee-employment-status
pnpm migrate:employee-employment-status -- --apply
```

Script chỉ thêm `UNSPECIFIED` và các trường ngày còn thiếu dưới dạng `null`.
Sau đó HR phải chuẩn hóa trạng thái/ngày bằng luồng chuyển trạng thái có audit.

### 4. Nhập lịch sử

Người có `leave.history.import` tải template giai đoạn 6, preview và commit.
Không mở feature flag cho toàn công ty cho đến khi mọi đợt cần thiết đã hoàn
tất hoặc được đánh dấu hủy.

### 5. Đối soát số dư

```powershell
pnpm reconcile:leave-balances
pnpm reconcile:leave-balances:apply
pnpm reconcile:leave-balances
pnpm reconcile:leave-balances:record
```

- Lệnh đầu chỉ báo cáo.
- `:apply` sửa bucket sai/mất bằng tổng delta ledger và ghi audit nguyên tử.
- Lệnh thứ ba phải trả về không còn mismatch.
- `:record` lưu bằng chứng vào `leave_reconciliation_runs` và `audit_logs`.

`INVALID_LEDGER` không được tự sửa. Operator phải điều tra và tạo bút toán đảo
hoặc điều chỉnh có lý do.

### 6. Cấu hình Scheduler

Thiết lập các biến môi trường trong terminal vận hành:

```powershell
$env:GCP_PROJECT_ID="..."
$env:GCP_REGION="asia-southeast1"
$env:BE_WMS_BASE_URL="https://..."
$env:LEAVE_MAINTENANCE_CRON_SECRET="..."
$env:EMPLOYEE_EMPLOYMENT_CRON_SECRET="..."
./infra/gcp/deploy-hr-schedulers.ps1
```

Job chuyển trạng thái lao động chạy lúc `00:01`; job maintenance phép chạy lúc
`00:05` mỗi ngày. Các endpoint dùng transaction/idempotency key nên retry không
áp dụng chuyển trạng thái hoặc cộng/trừ phép hai lần.

### 7. Chốt readiness

```powershell
pnpm audit:leave-rollout
```

Chỉ mở chính thức khi kết quả là `READY`: không còn hồ sơ
`UNSPECIFIED`/ngày bắt buộc bị thiếu, có policy, có ít nhất một cấp duyệt, cron
secret của cả hai job hợp lệ và số dư khớp ledger.

### 8. Mở và rollback

Mở cả hai biến thành `true`, deploy backend trước rồi frontend. Sau deploy chạy
smoke test tạo đơn, giữ phép, duyệt và nhận notification bằng tài khoản thử.

Nếu phát hiện lỗi:

1. đặt cả hai flag về `false`;
2. không xóa request, ledger hoặc audit;
3. chạy reconciliation dry-run;
4. sửa bằng transaction/bút toán điều chỉnh rồi mới mở lại.

## Kiểm thử

```powershell
pnpm test:hr-phase7
pnpm test:firestore-rules
pnpm run typecheck
pnpm run security:audit
pnpm run test:access-matrix
```
