# meInvoice — Giai đoạn 0: Discovery và chốt contract

Trạng thái: đã chốt nghiệp vụ; contract token/templates trên MISA Developer đã kiểm thử thành công  
Ngày cập nhật: 20/07/2026  
Không ghi credential hoặc payload có dữ liệu cá nhân chưa ẩn vào tài liệu này.

## 1. Contract kỹ thuật đã xác minh

| Chức năng | Contract baseline | Trạng thái |
|---|---|---|
| Gateway base URL | `https://developer.misa.vn/apis/itg/meinvoice` | Đã xác minh trực tiếp trên MISA Developer |
| Token | `POST /invoice/token` | `ClientID` + `ClientSecret` ở header; MST/user/password ở body |
| Templates | `GET /invoice/templates` | Đã có client + unit test |
| Preview | `POST /invoice/unpublishview` | Giai đoạn 3 |
| Publish | `POST /invoice/publishing` | Giai đoạn 4 |
| Status | `POST /invoice/status` | Giai đoạn 4 |
| View/download | `/invoice/publishview`, `/invoice/Download` | Giai đoạn 5 |
| Danh sách/phân trang | `POST /invoice/paging` | Dùng cho đối chiếu theo ngày |
| Chuyển đổi giấy | `POST /invoice/voucher-paper` | Ngoài phạm vi phiên bản đầu |

Contract test sandbox:

```powershell
pnpm --filter @bduck/be-wms test:meinvoice-contract
```

Test tự bỏ qua nếu thiếu `MEINVOICE_SANDBOX_CLIENT_ID`, `MEINVOICE_SANDBOX_CLIENT_SECRET`, `MEINVOICE_SANDBOX_TAX_CODE`, `MEINVOICE_SANDBOX_USERNAME` hoặc `MEINVOICE_SANDBOX_PASSWORD`.

Contract legacy `/api/integration/auth/token` từng trả `SystemError` vì dùng sai thế hệ API. Baseline hiện tại là gateway MISA Developer và không dùng AppID trong body.

Sau khi tách riêng `MEINVOICE_SANDBOX_CLIENT_ID`, `MEINVOICE_SANDBOX_CLIENT_SECRET` và `MEINVOICE_CONFIG_ENCRYPTION_KEY`, contract test đã lấy token và truy vấn thành công cả template có mã lẫn không mã. Không ghi giá trị credential hoặc token vào log/tài liệu.

## 2. Quyết định nghiệp vụ đã chốt

| Quyết định | Đề xuất mặc định | Trạng thái |
|---|---|---|
| Quan hệ đơn hàng/hóa đơn | Một đơn = một hóa đơn | Đã xác nhận |
| Giá nguồn đã gồm VAT | Giá nguồn đã gồm VAT; thành tiền trước thuế = `realMoney - taxMoney` | Đã phê duyệt |
| Nguồn VAT | Lưu nguyên `taxRate/taxMoney` ở dòng hàng và `taxMoney` của đơn | Đã xác minh contract nguồn |
| SignType | Kế toán chọn theo store config giữa HSM `2` và máy tính tiền `5` | Đã xác nhận là option |
| Ngày hóa đơn | Lấy theo thời điểm thanh toán thành công | Đã xác nhận |
| Adjustment/replacement | Không thuộc phạm vi phiên bản này | Đã xác nhận |
| Go-live/backfill | Chỉ issue từ go-live; timestamp được đặt khi chức năng hoàn thành và kích hoạt | Đã xác nhận |
| Buyer mặc định | `Khách lẻ (Không lấy hóa đơn)`, địa chỉ được phép để trống, MST để trống | Đã xác nhận |
| Account/series | Các cửa hàng dùng chung account và series | Đã xác nhận |

## 2.1. Contract HKAPI đã kiểm tra bằng dữ liệu thật

- Danh sách đơn có `orderId`, `createTime`, các trường tiền và `taxMoney`.
- Danh sách hàng có `taxRate`, `taxMoney`, `sysMoney`, `discountMoney`, `realMoney`.
- Chi tiết đơn có `goodsInfo` và `payModeInfo`; thanh toán thành công có `payStatus = 2` và `payTime`.
- `payment_time` chuẩn hóa là `payTime` cuối cùng trong các dòng thanh toán thành công.
- `amount_before_tax = realMoney - taxMoney` theo quyết định đã phê duyệt; payload nguồn vẫn được lưu đầy đủ để có thể kiểm toán và tính lại.

## 3. Payload/fixture cần thu thập

Mỗi fixture phải xóa hoặc thay thế tên, số điện thoại, email, MST và thông tin ngân hàng của khách hàng.

- Đơn hoàn tất, một VAT, không giảm giá.
- Đơn có giảm giá từng dòng.
- Đơn có chiết khấu toàn hóa đơn.
- Đơn có hàng khuyến mại.
- Đơn có nhiều mức VAT.
- Đơn không có thông tin xuất hóa đơn.
- Đơn hoàn/hủy trước phát hành.
- Đơn hoàn/hủy sau phát hành.
- Đơn sát giới hạn số dòng.

## 4. Data mapping cần kế toán ký duyệt

| Nguồn | Domain chuẩn hóa | MISA | Quy tắc |
|---|---|---|---|
| Mã đơn | `source_order_id` | `RefID` qua UUID v5 | Không dùng trực tiếp làm RefID |
| Cửa hàng | `warehouse_id` | `SellerShopCode/Name` | Lấy từ store binding |
| SKU/tên hàng | `item_code/item_name` | `ItemCode/ItemName` | Chờ fixture |
| Số lượng | `quantity` | `Quantity` | Decimal, không float |
| Đơn giá | `unit_price` | `UnitPrice` | Phụ thuộc quyết định đã gồm VAT |
| Giảm giá | `discount_rate/amount` | `DiscountRate/DiscountAmountOC` | Chờ loại giảm giá nguồn |
| Thuế suất | `vat_rate_name` | `VATRateName` | Không suy đoán |
| Tổng theo thuế | `tax_rate_info` | `TaxRateInfo` | Tính lại từ dòng |
| Thanh toán | `payment_method` | `PaymentMethodName` | Mapping theo store config |

## 5. Checklist sandbox

- [x] Đã xác nhận có tài khoản sandbox.
- [ ] Tài khoản đăng nhập được `testapp.meinvoice.vn` và thuộc đúng môi trường sandbox.
- [ ] Tờ khai được CQT chấp nhận trong sandbox.
- [ ] Có ít nhất một template đang sử dụng.
- [ ] Xác nhận series, có mã/không mã và thường/máy tính tiền.
- [x] Chạy contract test token/templates thành công trên gateway MISA Developer.
- [ ] Lưu response mẫu đã redaction.
- [ ] Thử preview/publish/status/download thủ công với MISA.
- [ ] Hỏi MISA về rate limit, paging/list API và SLA.

## 6. Điều kiện kết thúc giai đoạn 0

- Các quyết định SignType, invoice date, buyer rule, series ownership và phạm vi go-live đã có người phê duyệt.
- Contract test token/templates chạy trên sandbox thật.
- Có fixture đã ẩn PII và bảng mapping được kế toán ký duyệt.
- Có câu trả lời chính thức về API danh sách/phân trang hoặc chấp nhận MVP dùng internal ledger + status.
