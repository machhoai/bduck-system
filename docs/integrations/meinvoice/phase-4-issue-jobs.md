# meInvoice — Giai đoạn 4: Issue job và phát hành

Trạng thái: code hoàn thành, phát hành production vẫn bị khóa để chờ UAT/go-live  
Ngày cập nhật: 20/07/2026

## Phạm vi đã triển khai

- `POST /api/invoices/issues`: tạo job tối đa 30 draft bằng idempotency key.
- `GET /api/invoices/issues/:jobId`: trả tiến độ và kết quả từng hóa đơn.
- Worker nội bộ cho Cloud Tasks và endpoint sweep cho Cloud Scheduler.
- Firestore transaction giữ chỗ `RefID`, khóa draft và tạo payload snapshot backend-only.
- Lane lease theo `meinvoice_account_id + inv_series`; các cửa hàng dùng chung account/series không thể đồng thời lấy số.
- Publish contract `POST /invoice/publishing`, kiểm tra `ErrorCode` của từng item.
- Status contract `POST /invoice/status` với `inputType=2` để tra bằng `RefID`.
- Timeout, lỗi mạng, response không đầy đủ và RefID trùng luôn chuyển sang `PENDING_CONFIRMATION`; không publish lại ngay.
- Exponential backoff, giới hạn retry, circuit breaker sau 5 lỗi retryable liên tiếp và sweep recovery.
- UI chọn tối đa 30 draft `READY_TO_ISSUE`, xác nhận rõ đây là hóa đơn thật và theo dõi tiến độ job.

## Chốt an toàn

`MEINVOICE_ISSUE_ENABLED` mặc định là `false`. API tạo job chỉ hoạt động khi đồng thời thỏa:

1. feature flag bằng `true`;
2. store config đã enable, validate và có `go_live_at`;
3. thời điểm thanh toán của đơn không trước `go_live_at`;
4. draft đang `READY_TO_ISSUE`, source hash còn mới và đã qua validation;
5. đơn chưa được reconciliation đánh dấu `MATCHED`;
6. người sửa số liệu tài chính không phải người phát hành cùng draft;
7. draft chưa thuộc issue job khác và `RefID` chưa được giữ chỗ.

Ngày 19/07/2026 được người dùng xác nhận toàn bộ đơn đã có hóa đơn. Không dùng ngày này để test publish; chỉ dùng cho sync/read/reconciliation. Policy `go_live_at` và trạng thái `MATCHED` là hai lớp bảo vệ độc lập.

## State machine

Item đi qua các trạng thái:

`QUEUED -> SUBMITTING -> PENDING_CONFIRMATION -> ISSUED`

Nhánh lỗi gồm `RETRYABLE_ERROR` và `MANUAL_RECONCILIATION`. Chỉ lỗi được xác định chắc chắn là chưa tạo hóa đơn mới được retry publish. Mọi lỗi mơ hồ sau submit đều chỉ gọi status bằng `RefID`.

Job tổng hợp thành `QUEUED`, `PROCESSING`, `COMPLETED`, `PARTIAL`, `FAILED` hoặc `CANCELLED` từ counters được cập nhật cùng transaction với item.

## Cấu hình hạ tầng

```dotenv
MEINVOICE_ISSUE_ENABLED=false
MEINVOICE_TASK_LOCATION=
MEINVOICE_TASK_QUEUE=
MEINVOICE_WORKER_BASE_URL=
MEINVOICE_WORKER_SERVICE_ACCOUNT=
MEINVOICE_WORKER_SECRET=
```

Khi đủ cấu hình Cloud Tasks, mỗi item được dispatch bằng task name deterministic và OIDC service account. Nếu chưa cấu hình Cloud Tasks, endpoint sweep xử lý một lô ngắn bằng Firestore lease; không tạo vòng lặp sống lâu trong Cloud Run.

Cloud Scheduler gọi:

`POST /api/invoices/internal/issues/sweep`

với header `X-MeInvoice-Worker-Secret`. Trên production, route Cloud Run cần được khóa bằng IAM cho service account; secret là lớp xác thực ứng dụng bổ sung.

## Kiểm thử

```powershell
pnpm --filter @bduck/be-wms test:meinvoice-phase4
pnpm --filter @bduck/be-wms typecheck
pnpm --filter @bduck/fe-wms typecheck
```

Contract tests bao phủ body `SignType`, lỗi từng item, status bằng RefID, timeout/duplicate không republish, policy chặn giao dịch trước go-live/đã MATCHED/SOD và deterministic job/lane key. Firestore Emulator test bao phủ double-click, task trùng, worker chết giữa chừng, RefID registry và hai cửa hàng dùng chung lane. Firestore Rules test xác nhận payload snapshot và RefID registry không thể đọc trực tiếp kể cả system admin phía client.

## Việc còn lại trước khi bật production

- Kế toán hoàn tất UAT calculation/preview của Giai đoạn 3.
- Thiết lập Cloud Tasks queue, Cloud Scheduler, IAM/OIDC và alert.
- Chọn chính xác `go_live_at` sau khi chức năng được nghiệm thu.
- Chạy sandbox issue/status bằng fixture không phải đơn 19/07/2026.
- Pilot một cửa hàng, một series, lô nhỏ; chỉ sau đó mới đổi `MEINVOICE_ISSUE_ENABLED=true`.

Tài liệu contract chính thức: [Publish invoice](https://doc.meinvoice.vn/itg/Doc/PublishInvoice.html), [Get invoice status](https://doc.meinvoice.vn/itg/Doc/GetStatusInvoice.html), [Publish result](https://doc.meinvoice.vn/itg/Doc/Info/PublishInvoiceResult.html).
