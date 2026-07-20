# meInvoice — Giai đoạn 5: Sổ hóa đơn và đối chiếu

Trạng thái: đã triển khai code, chờ nghiệm thu dữ liệu thực tế  
Ngày cập nhật: 20/07/2026

## Phạm vi đã triển khai

- Ba màn hình: Chờ phát hành, Đã phát hành, Lỗi/Đối chiếu.
- Đồng bộ với mục đích `RECONCILIATION` luôn kéo đầy đủ đơn JoyWorld trong ngày trước khi đọc danh sách hóa đơn MISA.
- Phân trang `POST /invoice/paging` theo ngày và series; lưu snapshot chuẩn hóa backend-only.
- Ghép hóa đơn theo `TransactionID`, `RefID`, sau đó tới `BuyerOrderCode` để hỗ trợ dữ liệu lịch sử không do hệ thống phát hành.
- Báo cáo kiểm soát theo ngày: số đơn nguồn, số hóa đơn MISA, số khớp, chưa xuất, MISA không có đơn nguồn, sai lệch và tổng tiền.
- Case đối chiếu có vòng đời `OPEN/RESOLVED`, lý do xử lý, người xử lý và audit log.
- Xem hóa đơn đã phát hành bằng `POST /invoice/publishview`; tải PDF/XML bằng `POST /invoice/Download`.
- Mọi thao tác xem/tải đều kiểm tra `warehouse_id` và quyền `invoices.download`. URL trả về chỉ chấp nhận HTTPS thuộc `meinvoice.vn`.
- Sweep trạng thái định kỳ đối với ledger nội bộ đã phát hành, phát hiện hóa đơn bị xóa, trạng thái phát hành lệch và trạng thái thuế bị từ chối.

## An toàn dữ liệu

- Ngày 19/07/2026 chỉ được dùng để đọc, đồng bộ và đối chiếu. Không dùng để publish.
- Tài khoản/series dùng chung giữa nhiều cửa hàng: hóa đơn MISA không có `SellerShopCode` và không khớp đơn nội bộ được tính là `unscoped_misa_count`, không tự động kết luận thuộc cửa hàng hiện tại.
- Raw payload JoyWorld, token, credential và snapshot MISA không đọc được từ client, kể cả system admin phía client.
- PDF/XML giới hạn kích thước và kiểm tra chữ ký nội dung trước khi trả về UI.
- Feature flag phát hành thật vẫn mặc định `MEINVOICE_ISSUE_ENABLED=false`.

## Endpoint

- `GET /api/invoices/ledger?warehouse_id=...&business_date=YYYY-MM-DD`
- `GET /api/invoices/reconciliation-cases?warehouse_id=...&business_date=YYYY-MM-DD`
- `POST /api/invoices/reconciliation-cases/:id/resolve`
- `GET /api/invoices/ledger/:id/view?warehouse_id=...`
- `GET /api/invoices/ledger/:id/download?warehouse_id=...&type=Pdf|Xml`
- `POST /api/invoices/internal/reconciliation/status-sweep`

Scheduler gọi status sweep với header `X-MeInvoice-Worker-Secret`. Production cần khóa route bằng Cloud Run IAM; shared secret chỉ là lớp bổ sung. Khuyến nghị chạy mỗi 15–30 phút với lô 100 hóa đơn.

## Firestore

- `invoice_reconciliation_runs`: báo cáo kiểm soát và trạng thái lần chạy.
- `invoice_reconciliation_cases`: case sai lệch có scope cửa hàng.
- `invoice_reconciliation_snapshots`: projection MISA tối thiểu, backend-only.
- `invoice_source_orders`: ledger chính; chứa khóa ghép, trạng thái MISA và thời điểm đối chiếu gần nhất.

## Kiểm thử

```powershell
pnpm --filter @bduck/be-wms test:meinvoice-phase5
pnpm --filter @bduck/be-wms typecheck
pnpm --filter @bduck/fe-wms typecheck
```

Test bao phủ ghép hóa đơn lịch sử theo `BuyerOrderCode`, missing/mismatch, bảo vệ shared account, contract view/download và chặn URL không tin cậy. Firestore Rules test xác nhận run/case đúng scope và snapshot bị khóa.

Tài liệu contract chính thức: [View published invoice](https://doc.meinvoice.vn/itg/Doc/ViewInvoicePublish.html), [Download invoice](https://doc.meinvoice.vn/itg/Doc/DowloadInvoice.html), [Get invoice status](https://doc.meinvoice.vn/itg/Doc/GetStatusInvoice.html).
