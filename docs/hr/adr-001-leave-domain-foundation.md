# ADR-001: Nền tảng miền nhân sự và nghỉ phép

- Trạng thái: Chấp thuận cho Giai đoạn 0
- Ngày: 2026-07-23
- Phạm vi: Hồ sơ lao động, ngày phép, phê duyệt và nhập lịch sử

## Bối cảnh

Hệ thống đã có hồ sơ nhân viên, RBAC, audit log, realtime listener và engine
phê duyệt tuần tự. Tuy nhiên, các mốc thử việc/chính thức/nghỉ việc chưa nằm
trong shared types; số dư phép và biểu mẫu yêu cầu hành chính mới chỉ là giao
diện placeholder.

Giải pháp phải tuân thủ:

- Không xóa cứng dữ liệu nghiệp vụ.
- Ghi `action_time`, `sync_time`, dữ liệu cũ/mới và người thao tác.
- Backend là nguồn xác thực cuối cùng cho số dư và quyền thao tác.
- Cập nhật trạng thái realtime, không yêu cầu tải lại thủ công.
- Mọi nội dung hướng tới người dùng có bản tiếng Việt và tiếng Trung.
- Không cho người tạo tự phê duyệt yêu cầu của mình.

## Quyết định

### 1. Tách trạng thái hồ sơ và trạng thái lao động

`EmployeeProfileStatus` tiếp tục mô tả trạng thái vận hành của hồ sơ. Trạng
thái lao động mới dùng `EmployeeEmploymentStatus`:

- `UNSPECIFIED`: dữ liệu cũ chưa được HR chuẩn hóa.
- `PROBATION`: thử việc.
- `OFFICIAL`: chính thức.
- `RESIGNED`: đã nghỉ việc.

Mọi chuyển trạng thái được ghi thành `EmployeeEmploymentTransition` với ngày
hiệu lực do người có quyền chọn. Ngày kết thúc thử việc không tự động xác nhận
nhân viên đạt thử việc.

Các ngày nhân sự dùng chuỗi lịch `YYYY-MM-DD` thay vì timestamp để không bị
lệch ngày khi dữ liệu đi qua client, backend và Firestore. Timezone nghiệp vụ
là `Asia/Ho_Chi_Minh`.

### 2. Sổ cái phép là bất biến

Số dư được chiếu từ `LeaveLedgerEntry` và lưu read model theo nhân viên/năm
trong `LeaveBalanceBucket`. Mọi thay đổi sử dụng delta cho các ngăn:

- khả dụng;
- đang giữ chỗ;
- đã dùng;
- đang khóa trong thử việc;
- đã hết hạn.

Không cập nhật hoặc xóa giao dịch lịch sử. Sai sót được sửa bằng bút toán điều
chỉnh hoặc đảo ngược có tham chiếu và audit log.

### 3. Backend tự tính số ngày

Client chỉ gửi ngày và phần ngày (`FULL_DAY`, `MORNING`, `AFTERNOON`). Backend
tự tính đơn vị `1` hoặc `0.5`, kiểm tra ngày cuối tuần/ngày lễ, trùng lặp và
quy tắc khoảng ngắt.

Sau khi sắp xếp ngày:

- khoảng cách giữa hai ngày liền kề không lớn hơn 2 ngày lịch;
- chỉ được có tối đa một khoảng cách lớn hơn 1 ngày.

Do đó `18,19,20,22` hợp lệ; `18,19,20,24` và `18,20,22` không hợp lệ.

### 4. Tích lũy ngày 15 và khóa trong thử việc

Ngày 15 mỗi tháng là kỳ ghi nhận:

- chưa đến ngày bắt đầu lao động: không cộng;
- đang thử việc: cộng vào ngăn khóa;
- đã chính thức: cộng vào ngăn khả dụng;
- đã đến ngày nghỉ việc: không cộng.

Người bắt đầu sau ngày 15 nhận kỳ đầu vào ngày 15 tháng kế tiếp. Khi HR áp
dụng chuyển trạng thái sang chính thức, các đơn vị thử việc đủ điều kiện mới
được mở khóa.

Phép của năm cũ hết hạn sau ngày 31/03 năm sau. Việc hết hạn tạo một ledger
entry riêng và giữ lịch sử vĩnh viễn.

### 5. Cấu hình phê duyệt toàn công ty

Cấu hình nghỉ phép có tối đa ba vị trí cấp duyệt và phải bật ít nhất một cấp.
Mỗi cấp dùng đúng một kiểu phân công:

- `ROLE`: một role có permission `leave.approve`;
- `USER`: một người cụ thể có permission `leave.approve`.

Engine phê duyệt hiện tại sẽ được mở rộng ở Giai đoạn 4. Contract riêng
`LeaveApprovalAssignment` được đưa vào từ Giai đoạn 0 để tránh buộc các quy
trình kho hiện hữu phải đổi schema ngay lập tức.

Nếu người duyệt mất hiệu lực, yêu cầu chuyển `APPROVER_UNAVAILABLE`. Việc phân
công lại phải do người có `leave.approver.reassign` thực hiện, có lý do và
audit log; không tự động fallback.

### 6. Nhập lịch sử có phiên bản và chống trùng

Tệp Excel mẫu được quản lý bằng module File Template. Mỗi đợt nhập giữ:

- phiên bản template;
- file nguồn và checksum;
- người thực hiện;
- kết quả từng dòng;
- `source_reference` chống nhập trùng;
- trạng thái preview/commit/failure.

Nhập lại cùng dữ liệu không tạo thêm ledger entry hoặc yêu cầu lịch sử.

## Tương thích và migration

Các trường lao động mới trên `EmployeeProfile` là tùy chọn trong Giai đoạn 0
để dữ liệu cũ và các constructor hiện hữu tiếp tục hoạt động. Giai đoạn 1 sẽ:

1. backfill `UNSPECIFIED`;
2. cung cấp danh sách hồ sơ cần HR chuẩn hóa;
3. chỉ chuyển sang contract bắt buộc sau khi migration và đối soát hoàn tất.

Không tự suy đoán nhân viên cũ là chính thức để tránh tự động cấp sai ngày
phép.

## Yêu cầu i18n

- Permission registry phải có `label` và `description` cho `vi` và `zh`.
- Policy thuần hàm trả mã lỗi ổn định kèm thông báo `vi/zh`.
- Enum và mã lỗi không được dùng trực tiếp làm nội dung hiển thị.
- UI Giai đoạn sau phải ánh xạ toàn bộ trạng thái, hành động, validation và
  toast qua hệ thống i18n.

## Hệ quả

- Số dư có thể đối soát từ ledger và phục hồi khi read model sai.
- Job ngày 15, hết hạn và import có thể chạy lại nhờ idempotency key.
- Schema nhiều collection hơn nhưng đổi lại tránh race condition và giữ đủ
  bằng chứng audit.
- Việc tích hợp engine phê duyệt được hoãn đến Giai đoạn 4 để Giai đoạn 0
  không làm gián đoạn các quy trình kho đang hoạt động.
