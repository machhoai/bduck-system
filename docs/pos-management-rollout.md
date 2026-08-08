# JPOS management rollout

## Phạm vi

JPULSE quản lý thiết bị tin cậy, cấu hình hóa đơn, QR chuyển khoản dự phòng,
quyền người dùng và audit theo từng cửa hàng. JPOS giữ cache local-first để luồng
thanh toán cơ bản tiếp tục hoạt động khi UI gặp lỗi hoặc ứng dụng khởi động lại.

## Quyết định nghiệp vụ đã chốt

- OTP kích hoạt dùng một lần được tạo và hiển thị trực tiếp trên trang quản lý POS
  của JPULSE sau khi Admin xác thực OTP cá nhân.
- Một máy POS chỉ thuộc một cửa hàng tại một thời điểm. Admin có quyền
  `pos.devices.manage` ở cả cửa hàng nguồn và đích mới được chuyển máy; giao dịch
  chuyển được ghi audit ở cả hai cửa hàng.
- Cấu hình in bill và thanh toán áp dụng theo từng cửa hàng, không có override
  riêng theo máy.
- Thiết bị và quyền người dùng đã cache chỉ được dùng offline tối đa 8 giờ tính từ
  lần xác minh thành công gần nhất. Hết thời hạn, JPOS khóa thao tác cho đến khi
  kết nối lại JPULSE.
- Audit POS chỉ ghi nghiệp vụ và sự kiện bảo mật; không ghi click, chuyển tab hay
  điều hướng màn hình.

## Biến môi trường bắt buộc

- Backend JPULSE: `POS_ENROLLMENT_HASH_SECRET` là chuỗi ngẫu nhiên tối thiểu 32 byte.
- Backend JPULSE: `BE_WMS_CORS_ORIGIN` phải gồm origin web JPULSE và origin Tauri
  `http://tauri.localhost,https://tauri.localhost,tauri://localhost`.
- Build JPOS: `NEXT_PUBLIC_JPULSE_API_URL` trỏ đến backend JPULSE production.
- Không đưa secret enrollment hoặc device credential vào biến `NEXT_PUBLIC_*`.

## Thứ tự triển khai an toàn

1. Deploy shared types, backend JPULSE, Firestore indexes và rules hợp nhất.
2. Cấp `pos.devices.manage`, `pos.settings.manage`, `pos.access.manage` cho nhóm quản trị.
3. Tạo các vai trò thu ngân/ca trưởng theo cửa hàng với `pos.login` và quyền chức năng cần thiết.
4. Cấu hình hóa đơn và QR dự phòng cho từng cửa hàng trên `/pos-management`.
5. Phát hành JPOS desktop mới; tạo OTP kích hoạt ngay trên trang quản lý POS để
   kích hoạt từng máy.
6. Xác nhận heartbeat, phiên bản app và cấu hình trên JPULSE.
7. Chỉ sau khi các máy pilot đã kích hoạt, deploy POS Cloud Functions có kiểm tra device credential.
8. Mở rộng theo từng cửa hàng; không triển khai đồng loạt ngay lần đầu.

## Ma trận quyền khuyến nghị

| Vai trò          | Quyền                                                                                       |
| ---------------- | ------------------------------------------------------------------------------------------- |
| Thu ngân         | `pos.login`, `pos.sales.create`, `pos.orders.read`                                          |
| Ca trưởng        | Quyền thu ngân + `pos.payments.manual_confirm`, `pos.shift.close`, `pos.orders.retry_sync`  |
| Quản lý cửa hàng | Quyền ca trưởng + `pos.settings.read`, `pos.devices.read`, `pos.audit.read`                 |
| Quản trị POS     | `pos.devices.manage`, `pos.settings.manage`, `pos.access.manage` và các quyền đọc tương ứng |

## Smoke test bắt buộc cho mỗi cửa hàng

1. Mã kích hoạt hết hạn sau 10 phút và không dùng lại được.
2. Máy sai cửa hàng không tạo đơn/thanh toán được.
3. Khóa máy trên JPULSE; JPOS bị chặn ở heartbeat kế tiếp. Mở khóa và kiểm tra lại thành công.
4. Chuyển máy sang cửa hàng mới bằng tài khoản có quyền quản lý ở cả nguồn và
   đích; máy chỉ truy cập được cửa hàng mới và cả hai cửa hàng đều thấy audit.
5. Đăng nhập bằng tài khoản có/không có `pos.login`.
6. Ngắt mạng trước và sau mốc 8 giờ kể từ lần xác minh gần nhất; JPOS chỉ cho dùng
   quyền cache trước khi hết hạn.
7. Thanh toán tiền mặt, PayOS và QR dự phòng; in lại khi máy in lỗi.
8. Buộc CartPanel/ProductGrid ném lỗi; giao diện chuyển sang checkout an toàn và hoàn tất được cả tiền mặt lẫn chuyển khoản.
9. Tắt app tại các checkpoint `CART_READY`, `PAYMENT_INITIATED`, `RECEIPT_PENDING`; mở lại không mất đơn hoặc thu tiền hai lần.
10. Đổi cấu hình trên JPULSE; JPOS nhận version mới trong tối đa 60 giây và chỉ
    dùng quyền/cấu hình cache tối đa 8 giờ khi backend không khả dụng.
11. Kiểm tra audit chỉ có nghiệp vụ/bảo mật và chứa cửa hàng, máy, người thao tác,
    thời gian thao tác cùng thời gian đồng bộ.

## Rollback

- Không xóa document. Khóa thiết bị bằng trạng thái `REVOKED` và thu hồi quyền qua vai trò.
- Nếu backend JPULSE cần rollback, giữ nguyên các collection `pos_*`; JPOS tiếp tục
  dùng cache gần nhất nhưng không vượt quá cửa sổ offline 8 giờ.
- Nếu POS Functions cần rollback, rollback riêng Functions; không deploy file rules từ repository POS.
- Sự cố đóng gói không được xóa journal checkout. Chỉ xóa journal sau khi đơn đã hoàn tất và đồng bộ thành công.

## Giới hạn bảo đảm

Các lớp bảo vệ xử lý lỗi ứng dụng/render/API và khởi động lại trong phạm vi tiến
trình JPOS. Mất điện, lỗi hệ điều hành/ổ đĩa, hỏng phần cứng và mất toàn bộ kết nối
là bất khả kháng; dữ liệu đã checkpoint vẫn được khôi phục khi môi trường hoạt động lại.
