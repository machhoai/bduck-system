# meInvoice — Giai đoạn 2: Adapter, calculation và preflight

Trạng thái: hoàn thành phần code; chờ kế toán cấu hình mapping và xác nhận UAT  
Ngày cập nhật: 20/07/2026

## Thành phần đã triển khai

- Adapter chuẩn hóa `goodsInfo` của chi tiết đơn và dữ liệu danh sách hàng HKAPI thành từng dòng hóa đơn.
- Ghép fallback theo `goodsId`, tên hàng hoặc vị trí để giữ được mã nguồn khi chi tiết đơn không trả `goodsId`.
- Mapping SKU cho mã hàng, tên hàng, đơn vị tính và VAT.
- Mapping VAT theo nguồn, SKU hoặc category; chế độ `MANUAL_REVIEW` luôn yêu cầu người dùng xác nhận.
- Mapping phương thức thanh toán theo cấu hình cửa hàng.
- Decimal arithmetic dùng số nguyên `BigInt` và scale thập phân; không thực hiện phép cộng/nhân tiền bằng floating point.
- Rounding half-up theo `OptionUserDefined` của meInvoice.
- Tính từng dòng, tổng master và `TaxRateInfo` cho `0%`, `5%`, `8%`, `10%`, `KCT`, `KKKNT` theo đúng contract MISA.
- Sinh `calculation_hash` ổn định và gắn phiên bản `meinvoice-decimal-v1`.
- Preflight trả mã lỗi theo field, phân biệt `NEEDS_TAX_CONFIGURATION`, `NEEDS_REVIEW` và `READY_FOR_REVIEW`.
- Chặn phát hành đơn trước go-live nhưng vẫn lưu và cho phép dùng trong đối chiếu.
- Chặn hóa đơn rỗng hoặc có từ 200 dòng trở lên; 199 dòng vẫn hợp lệ.
- So sánh tuyệt đối tiền trước thuế, VAT và tổng thanh toán giữa HKAPI với kết quả tính sau rounding.

## Dữ liệu projection bổ sung

Mỗi document `invoice_source_orders` có thêm:

- `mapped_payment_method`;
- `normalized_items`;
- `calculation` và `calculation.calculation_hash`;
- `preflight.status`, `preflight.issue_eligible`, `preflight.issues`;
- `mapping_version` và `calculation_version`.

Raw HKAPI và revision vẫn được lưu riêng trong `invoice_source_order_payloads` và không cho client đọc.

## API

```text
POST /api/invoices/source-orders/sync
GET  /api/invoices/source-orders?warehouse_id=:id&business_date=YYYY-MM-DD
GET  /api/invoices/source-orders/:id?warehouse_id=:id
```

API chi tiết kiểm tra lại `warehouse_id` ở repository, ngoài permission check của middleware/service, để không thể đọc chéo cửa hàng bằng document ID.

## Preflight hiện có

- Account/store config tồn tại, đang bật và đã test kết nối thành công.
- Có series, giá đã/chưa gồm VAT được xác nhận và đã đặt go-live.
- Có thời điểm thanh toán thành công và không trước go-live.
- Phương thức thanh toán đã được mapping.
- Có 1–199 dòng hàng.
- Mã hàng, tên hàng, đơn vị tính, số lượng, đơn giá và VAT hợp lệ.
- Calculation chạy được và khớp source ở cấp dòng/master.

Các kiểm tra phụ thuộc draft/job như `expected_revision`, `RefID` uniqueness, issue job đang hoạt động và thứ tự ngày trong series sẽ được bổ sung ở Giai đoạn 4 vì các entity đó chưa tồn tại trong Giai đoạn 2.

## Kiểm tra đã chạy

```text
@bduck/shared-types typecheck/build             PASS
@bduck/be-wms typecheck/build                   PASS
test:meinvoice-foundation                       15/15 PASS
test:meinvoice-phase2                           6/6 PASS
test:authorization                              81/81 PASS
firestoreRules.test.mjs                         13/13 PASS
```

## Việc cần kế toán xác nhận trong UAT

- Mapping đơn vị tính cho từng SKU hoặc nhóm SKU vì fixture HKAPI hiện không luôn trả đơn vị tính.
- Mapping phương thức thanh toán nguồn sang tên hiển thị trên hóa đơn.
- Chọn nguồn VAT (`SOURCE`, `SKU`, `CATEGORY`, `MANUAL_REVIEW`) và cấu hình mapping tương ứng.
- Xác nhận `price_includes_vat` cho từng cửa hàng. Engine hỗ trợ cả hai lựa chọn; với mẫu HKAPI `187.000` tổng tiền và `17.000` VAT, kết quả trước thuế là `170.000`.
- Xác nhận rounding/decimal digits từ `OptionUserDefined` của tài khoản thật.

Sau khi các mapping trên được lưu, lần đồng bộ lại cùng ngày sẽ tính lại projection và preflight mà không tạo raw revision mới nếu payload HKAPI không thay đổi.
