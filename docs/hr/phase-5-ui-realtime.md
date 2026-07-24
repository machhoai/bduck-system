# Giai đoạn 5 — UI và realtime

Giai đoạn 5 hoàn thiện không gian ngày phép của nhân viên và HR trên desktop/mobile.

## Không gian nhân viên

- Số dư và sổ cái ngày phép cập nhật realtime.
- Phép năm trước hiển thị hạn dùng đến hết ngày 31/03.
- Lịch chọn nhiều ngày, khóa cuối tuần và ngày lễ công ty.
- Chọn cả ngày, buổi sáng hoặc buổi chiều cho từng ngày.
- Lịch sử có bộ lọc và timeline duyệt tuần tự.

## Không gian HR

- Quản lý chính sách ngày phép toàn công ty.
- Quản lý ngày lễ và cấu hình tối đa ba cấp duyệt.
- Task inbox và danh sách người duyệt không khả dụng.
- Danh sách đơn toàn công ty theo `leave.requests.read_all`.
- Điều chỉnh số dư có audit theo `leave.balance.adjust`.

## Realtime và thông báo

Firestore listener theo dõi số dư, đơn, task duyệt, chính sách, ngày lễ và hồ sơ
nhân viên; API là fallback có kiểm tra phạm vi. Các sự kiện gửi đơn, duyệt, từ
chối, thiếu người duyệt và phân công lại đều tạo thông báo in-app Việt/Trung.
Client không ghi trực tiếp vào collection nghiệp vụ.

## Điều kiện hoàn thành

- Tất cả nội dung mới có i18n Việt/Trung.
- Trạng thái tải dùng skeleton theo cấu trúc màn hình.
- Mutation dùng `gooeyToast.promise`, có retry và khóa nút khi đang xử lý.
- Backend kiểm tra permission và phạm vi nơi làm việc.
- Firestore Rules hỗ trợ timeline cá nhân và policy theo quyền hiệu lực.
