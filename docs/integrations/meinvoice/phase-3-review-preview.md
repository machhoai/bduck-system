# meInvoice — Giai đoạn 3: Review và preview

Trạng thái: hoàn thành phần code; chờ UAT bằng dữ liệu và mapping thật  
Ngày cập nhật: 20/07/2026

## Thành phần đã triển khai

- Route `/invoice-management` trong dashboard và menu theo permission hóa đơn.
- Chọn cửa hàng, ngày giao dịch và mục đích đồng bộ `ISSUE`/`RECONCILIATION`.
- Mỗi lần đồng bộ tải toàn bộ đơn hàng của ngày đã chọn từ HKAPI rồi lưu projection, raw payload và revision theo hash.
- Summary theo trạng thái preflight, tìm kiếm và lọc trạng thái; bộ lọc được phản ánh vào query string để tải lại trang không mất ngữ cảnh.
- Bảng desktop, card mobile và drawer hiển thị dòng hàng, tiền trước thuế, VAT, tổng tiền và các lỗi preflight.
- Loading, empty, error/retry, thông báo promise và khóa nút trong lúc đồng bộ/preview để chống click đúp.
- Nội dung Việt/Trung.
- Preview chỉ bật khi người dùng có `invoices.review` và đơn vượt qua preflight.
- Tự tạo `invoice_documents` revision 1 cho đơn thuộc lần đồng bộ `ISSUE`; không tạo draft phát hành cho đơn trước go-live.
- Draft lưu buyer, phương thức thanh toán, input lines và kết quả calculation riêng; raw/projection HKAPI không bị ghi đè.
- Chỉnh sửa buyer/dòng hàng tạo revision mới bằng `expected_revision`; tổng tiền luôn được backend tính lại.
- Thay đổi số lượng, đơn giá, chiết khấu, VAT hoặc cấu trúc dòng chuyển `NEEDS_SECOND_REVIEW`.
- Người sửa không được tự duyệt cùng revision. Hai request duyệt đồng thời được chặn bằng revision + expected status trong Firestore transaction.
- Khi source hash thay đổi, draft bị đánh dấu stale. Người có `invoices.prepare` có thể rebase thành revision mới; approval và prepared payload cũ bị hủy.
- Lịch sử revision chỉ đọc qua backend; Firestore client không được đọc subcollection chứa buyer/snapshot.

## Contract preview MISA

Backend gọi:

```text
POST /invoice/unpublishview
Content-Type: application/json
Authorization: Bearer <token>
ClientID: <client id>
```

Request body là trực tiếp `InvoiceData`, không có object bọc. Payload dùng đúng tên trường chính thức, gồm `OriginalInvoiceDetail`, `TaxRateInfo` và `OptionUserDefined`. `VATRateName` dùng dạng `0%`, `5%`, `8%`, `10%`, `KCT`, `KKKNT`.

Với nguồn giá đã gồm VAT, `UnitPrice`, `AmountOC` và `Amount` gửi MISA là giá trị trước thuế. Ví dụ tổng thanh toán 187.000 và VAT 17.000 tạo tiền trước thuế 170.000.

`RefID` được sinh xác định từ legal entity, cửa hàng, đơn nguồn và loại hóa đơn; `prepared_payload_hash` dùng để theo dõi đúng revision. Link preview chỉ được chấp nhận nếu là HTTPS trên `meinvoice.vn` hoặc subdomain và được xem là hết hạn sau 5 phút.

Frontend không nhận credential/token, không tự tính payload tài chính và không lưu URL preview. Audit chỉ lưu `RefID`, các hash và thời điểm hết hạn.

## API

```text
POST /api/invoices/source-orders/:id/prepare
GET  /api/invoices/documents/:id?warehouse_id=:warehouseId
PUT  /api/invoices/documents/:id
POST /api/invoices/documents/:id/review
POST /api/invoices/documents/:id/preview
```

Body:

```json
{
  "warehouse_id": "warehouse-id",
  "expected_revision": 2,
  "expected_source_payload_hash": "sha256"
}
```

`expected_revision` và `expected_source_payload_hash` là optimistic concurrency guards. Nếu draft hoặc đơn nguồn thay đổi sau khi người dùng mở drawer, API trả `409` thay vì ghi đè hoặc preview revision cũ.

Review dùng `action = APPROVE | REJECT`. Từ chối bắt buộc có ghi chú. Approval chỉ thành công khi draft không còn validation error, source còn mới và actor khác `edited_by` của revision.

## Kiểm tra đã chạy

```text
@bduck/shared-types typecheck/build             PASS
@bduck/be-wms typecheck/build                   PASS
test:meinvoice-foundation                       15/15 PASS
test:meinvoice-phase2                           6/6 PASS
test:meinvoice-phase3                           6/6 PASS
test:authorization                              81/81 PASS
firestoreRules.test.mjs                         13/13 PASS
@bduck/fe-wms typecheck                         PASS
GET /invoice-management                         HTTP 200
Next compile + static generation                PASS (40/40 routes)
Next standalone artifact copy                   BLOCKED: Windows EPERM khi tạo symlink
```

Lỗi standalone xảy ra sau khi compile và static generation đã thành công, tại bước đóng gói symlink trên Windows; không phải lỗi TypeScript hoặc lỗi route hóa đơn.

## Phần còn lại để nghiệm thu Giai đoạn 3

- UAT bằng một đơn thật đã có đầy đủ mapping để gọi preview sandbox/live từ giao diện.
- Kế toán xác nhận lại kết quả sau khi chỉnh VAT, số lượng, đơn giá và chiết khấu trên fixture thật.
- Kiểm tra thực tế hai tài khoản: người A sửa revision, người B duyệt lần hai.

Không được ghi đè raw payload hoặc projection HKAPI khi người dùng sửa draft. Thiết kế revision này là điều kiện trước khi làm nút phát hành ở Giai đoạn 4.
