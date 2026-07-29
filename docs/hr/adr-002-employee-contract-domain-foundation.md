# ADR-002: Nền tảng quản lý hợp đồng lao động

- Trạng thái: Chấp thuận cho Giai đoạn 0
- Ngày: 2026-07-29
- Phạm vi: Hợp đồng lao động, tệp PDF, gia hạn, lịch sử và nhập dữ liệu cũ

## Bối cảnh

Hệ thống đã quản lý hồ sơ nhân viên, trạng thái thử việc/chính thức/nghỉ việc
và lịch sử chuyển trạng thái theo ngày hiệu lực. Tuy nhiên, số hợp đồng, khoảng
thời gian hợp đồng, tài liệu hợp đồng và quan hệ gia hạn chưa có domain riêng.

Giải pháp phải tuân thủ:

- Không xóa cứng dữ liệu nghiệp vụ hoặc tệp bằng chứng.
- Ghi `action_time`, `sync_time`, người thao tác và dữ liệu cũ/mới.
- Backend là nguồn xác thực cuối cùng cho validation và RBAC.
- Một nhân viên không có hai hợp đồng chồng lấn thời gian.
- Số hợp đồng duy nhất trong toàn công ty và không được tái sử dụng.
- Dữ liệu mới cập nhật realtime; frontend không yêu cầu tải lại thủ công.
- Nội dung hướng tới người dùng có bản tiếng Việt và tiếng Trung.
- File hợp đồng là dữ liệu HR nhạy cảm và không dùng URL tải công khai lâu dài.

Đọc/OCR PDF và tự điền biểu mẫu không thuộc phạm vi hiện tại. PDF chỉ là tài
liệu đính kèm để xem hoặc tải xuống sau khi kiểm tra quyền.

## Quyết định

### 1. Hợp đồng là domain riêng

Không đưa số hợp đồng và khoảng ngày trực tiếp vào `EmployeeProfile`.

Domain mới dùng các collection:

- `employee_contracts`: bản ghi hợp đồng và quan hệ gia hạn/kế tiếp;
- `employee_contract_documents`: metadata các phiên bản PDF;
- `employee_contract_number_locks`: khóa số hợp đồng duy nhất toàn công ty;
- `employee_contract_import_batches`: trạng thái các đợt nhập lịch sử;
- `employee_contract_import_rows`: kết quả validation và commit từng dòng.

`EmployeeProfile` tiếp tục là hồ sơ hiện tại. Lịch sử hợp đồng được truy vấn từ
`employee_contracts`, không lưu thành mảng nhúng trong hồ sơ nhân viên.

### 2. Loại hợp đồng

`EmployeeContractType` gồm:

- `PROBATION`: thử việc, bắt buộc có ngày kết thúc;
- `FIXED_TERM`: xác định thời hạn, bắt buộc có ngày kết thúc;
- `INDEFINITE`: không xác định thời hạn, ngày kết thúc phải là `null`;
- `SEASONAL`: thời vụ, bắt buộc có ngày kết thúc.

Giai đoạn hiện tại không cho tạo loại tùy ý ngoài bốn giá trị trên.

### 3. Trạng thái hợp đồng

`EmployeeContractStatus` gồm:

- `UPCOMING`: chưa đến ngày bắt đầu;
- `ACTIVE`: đang trong khoảng hiệu lực;
- `EXPIRED`: đã qua ngày kết thúc thông thường;
- `TERMINATED`: đã chấm dứt trước hạn;
- `CANCELLED`: đã hủy trước khi có hiệu lực.

Trạng thái `UPCOMING`, `ACTIVE` và `EXPIRED` là read model được suy ra từ ngày
theo timezone `Asia/Ho_Chi_Minh`. `TERMINATED` và `CANCELLED` là sự kiện
nghiệp vụ có người thao tác, thời gian và lý do.

Backend phải tính lại trạng thái khi đọc hoặc mutate để không phụ thuộc tuyệt
đối vào Scheduler. Job hằng ngày cập nhật trường `status` nhằm phục vụ query và
realtime.

### 4. Khoảng hiệu lực và chống chồng lấn

Ngày bắt đầu và ngày kết thúc đều được tính bao gồm ngày đó.

Khoảng hiệu lực:

```text
effective_start = start_date
effective_end   = termination_date ?? end_date ?? +infinity
```

Hợp đồng `CANCELLED` không chiếm khoảng hiệu lực. Với mọi hợp đồng còn lại,
hợp đồng mới bị xem là chồng lấn nếu:

```text
new.start_date <= existing.effective_end
AND
existing.start_date <= new.effective_end
```

Nếu hợp đồng cũ chấm dứt ngày `15-08-2026`, hợp đồng mới sớm nhất được bắt đầu
ngày `16-08-2026`.

Validation overlap phải chạy trong Firestore transaction cùng thao tác tạo hợp
đồng để hai request đồng thời không cùng thành công.

### 5. Số hợp đồng duy nhất toàn công ty

Số hợp đồng được trim, chuẩn hóa Unicode NFKC và chuẩn hóa chữ hoa để tạo
`contract_number_normalized`. Bản hiển thị gốc vẫn được giữ trong
`contract_number`.

Document khóa có ID được tạo từ SHA-256 của `contract_number_normalized`.
Transaction phải tạo/đọc lock trước khi ghi hợp đồng.

Lock không được xóa hoặc tái sử dụng khi hợp đồng bị hủy, chấm dứt hay xóa mềm.
Điều này giữ bằng chứng và ngăn một số hợp đồng đã tồn tại xuất hiện lại cho
một hợp đồng khác.

### 6. Gia hạn và hợp đồng kế tiếp

Gia hạn không sửa đè ngày kết thúc của hợp đồng cũ. Một lần gia hạn tạo
`EmployeeContract` mới với:

- `renewed_from_contract_id`: hợp đồng vừa được gia hạn;
- `root_contract_id`: hợp đồng đầu tiên trong chuỗi;
- `renewal_sequence`: số lần gia hạn tăng dần.

Chỉ `FIXED_TERM` và `SEASONAL` được dùng action gia hạn. Ngày bắt đầu mặc định
của hợp đồng gia hạn là ngày kế tiếp sau `end_date` của hợp đồng cũ.

`PROBATION` kết thúc bằng một hợp đồng kế tiếp loại `FIXED_TERM` hoặc
`INDEFINITE`; đây là chuyển loại hợp đồng, không phải gia hạn thử việc.
`INDEFINITE` không có action gia hạn.

Nếu hợp đồng mới không bắt đầu ngay ngày kế tiếp, hệ thống ghi nhận là hợp đồng
mới thay vì gia hạn. Mọi trường hợp vẫn phải vượt qua kiểm tra overlap.

### 7. Hủy và chấm dứt trước hạn

`CANCELLED` chỉ dùng cho hợp đồng chưa có hiệu lực. Request bắt buộc có
`cancellation_reason`.

`TERMINATED` dùng cho hợp đồng đã có hiệu lực và bắt buộc có:

- `termination_date`;
- `termination_reason`;
- `terminated_by`;
- `terminated_at`.

`termination_date` không được trước `start_date` và không được sau `end_date`
nếu hợp đồng có ngày kết thúc.

Không dùng soft delete để biểu diễn hủy hoặc chấm dứt. Soft delete chỉ dùng cho
sửa sai dữ liệu quản trị, vẫn giữ number lock, audit và file lịch sử.

### 8. Schema khái niệm

`EmployeeContract` có tối thiểu:

```typescript
interface EmployeeContract {
  id: string;
  employee_profile_id: string;
  employee_user_id: string | null;
  workplace_warehouse_id: string;
  contract_number: string;
  contract_number_normalized: string;
  contract_type: EmployeeContractType;
  start_date: LocalDate;
  end_date: LocalDate | null;
  status: EmployeeContractStatus;
  renewed_from_contract_id: string | null;
  root_contract_id: string;
  renewal_sequence: number;
  termination_date: LocalDate | null;
  termination_reason: string | null;
  terminated_by: string | null;
  terminated_at: Date | null;
  cancellation_reason: string | null;
  cancelled_by: string | null;
  cancelled_at: Date | null;
  notes: string | null;
  revision: number;
  created_by: string;
  updated_by: string;
  action_time: Date;
  sync_time: Date;
  is_deleted: boolean;
  created_at: Date;
  updated_at: Date;
}
```

`revision` là optimistic concurrency guard. Mutation cập nhật phải gửi
`expected_revision`; request dựa trên bản cũ nhận `409` thay vì ghi đè.

### 9. File hợp đồng PDF

File hợp đồng không bắt buộc. Chỉ chấp nhận:

- MIME `application/pdf`;
- phần mở rộng `.pdf`;
- chữ ký nội dung PDF hợp lệ;
- dung lượng tối đa 10MB.

Không tin MIME hoặc tên file do browser cung cấp. Backend phải kiểm tra metadata,
magic bytes và SHA-256 trước khi finalize.

`EmployeeContractDocument` có tối thiểu:

```typescript
interface EmployeeContractDocument {
  id: string;
  contract_id: string;
  employee_profile_id: string;
  employee_user_id: string | null;
  workplace_warehouse_id: string;
  storage_path: string;
  original_file_name: string;
  mime_type: "application/pdf";
  file_size: number;
  sha256: string;
  version: number;
  is_current: boolean;
  uploaded_by: string;
  action_time: Date;
  sync_time: Date;
  is_deleted: boolean;
  created_at: Date;
  updated_at: Date;
}
```

Không lưu Firebase token download URL trong contract/document. Backend tạo URL
tải ngắn hạn sau khi kiểm tra quyền.

Thay PDF tạo document version mới và đánh dấu version cũ `is_current: false`.
Không xóa object cũ tự động. Upload dùng quy trình hai bước: vùng tạm, xác thực,
sau đó finalize metadata. File tạm không được finalize sẽ được dọn bằng chính
sách lưu giữ riêng, có audit vận hành.

### 10. Phân quyền

Permission mới thuộc group `employees`:

| Permission                             | Nhãn tiếng Việt           | Nhãn tiếng Trung   |
| -------------------------------------- | ------------------------- | ------------------ |
| `employees.contracts.self.read`        | Xem hợp đồng của tôi      | 查看我的劳动合同   |
| `employees.contracts.read`             | Xem hợp đồng lao động     | 查看劳动合同       |
| `employees.contracts.manage`           | Quản lý hợp đồng lao động | 管理劳动合同       |
| `employees.contracts.terminate`        | Hủy và chấm dứt hợp đồng  | 取消和终止劳动合同 |
| `employees.contracts.documents.read`   | Xem tệp hợp đồng          | 查看合同文件       |
| `employees.contracts.documents.manage` | Quản lý tệp hợp đồng      | 管理合同文件       |
| `employees.contracts.history.import`   | Nhập lịch sử hợp đồng     | 导入合同历史       |

Quyền quản trị được kiểm tra theo `workplace_warehouse_id`.

Người dùng có `employees.contracts.self.read` chỉ được đọc hợp đồng và PDF khi
`employee_user_id` khớp UID đã xác thực. Self-read không cấp quyền xem hợp đồng
của người khác tại cùng cơ sở.

`employees.contracts.read` không mặc nhiên cho xem PDF. Xem file của người khác
cần thêm `employees.contracts.documents.read`.

`employees.contracts.manage` không mặc nhiên cho hủy/chấm dứt hoặc import hàng
loạt; các action này dùng permission riêng.

### 11. Chuẩn ngày tháng

Ngày lịch tiếp tục dùng `LocalDate` dạng `YYYY-MM-DD` trong shared types, API và
Firestore. Không parse bằng `new Date("YYYY-MM-DD")`.

Toàn bộ chức năng hợp đồng hiển thị và nhận nhập liệu từ người dùng theo
`DD-MM-YYYY`, gồm:

- form tạo/sửa/gia hạn/chấm dứt;
- timeline và thông báo;
- Excel import/export;
- validation message.

Boundary adapter chuyển đổi nghiêm ngặt:

```text
UI/import  DD-MM-YYYY -> LocalDate YYYY-MM-DD
LocalDate  YYYY-MM-DD -> display  DD-MM-YYYY
```

Parser phải từ chối ngày không tồn tại, sai số chữ số, sai thứ tự hoặc có ký tự
thừa. Năm nhuận phải được kiểm tra theo lịch Gregory. API nội bộ không nhận
`DD-MM-YYYY` để tránh hai định dạng ngày cùng tồn tại trong domain.

### 12. Import dữ liệu cũ

Template import phiên bản `1.0` được đặc tả tại
`docs/hr/employee-contract-import-template-v1.md`.

Import tuân theo preview/commit:

1. tải Excel và các PDF tùy chọn lên vùng của hệ thống;
2. backend tải lại, kiểm tra checksum và parse;
3. preview toàn bộ dòng, quyền, số hợp đồng và overlap;
4. batch có bất kỳ dòng lỗi nào không được commit;
5. commit từng hợp đồng bằng transaction có idempotency;
6. lưu batch, kết quả từng dòng và audit.

`source_reference` duy nhất trong toàn bộ domain import. Cùng reference và cùng
payload là retry; cùng reference nhưng payload khác là xung đột.

Trạng thái `UPCOMING`, `ACTIVE` và `EXPIRED` không được nhập tự do từ Excel mà
được backend suy ra. Excel chỉ khai báo sự kiện đặc biệt `TERMINATED` hoặc
`CANCELLED`.

### 13. Cảnh báo hết hạn

Job hằng ngày tạo cảnh báo trước đúng 30 ngày cho hợp đồng:

- có `end_date`;
- đang `ACTIVE`;
- không thuộc loại `SEASONAL`;
- chưa có notification với cùng idempotency key.

Idempotency key:

```text
contract-expiry:{contract_id}:30:{end_date}
```

Thông báo được gửi cho người có `employees.contracts.manage` trong phạm vi cơ
sở của hợp đồng. `SEASONAL` được loại trừ hoàn toàn khỏi cảnh báo 30 ngày trong
phiên bản hiện tại.

### 14. Audit, local-first và realtime

Mọi mutation gửi:

- `idempotency_key`;
- `action_time` do client ghi tại thời điểm người dùng xác nhận;
- `expected_revision` khi cập nhật record hiện có.

Backend ghi `sync_time`. Contract, lock và audit phải được ghi nguyên tử trong
cùng transaction khi có thể.

Frontend chỉ đọc realtime theo Firestore Rules; mọi write nghiệp vụ đi qua
backend. API là fallback khi listener không khả dụng. Không thiết kế nút tải
lại hoặc đồng bộ thủ công.

Binary upload cần kết nối mạng. Draft metadata có thể được giữ cục bộ, nhưng UI
không được báo đã đồng bộ trước khi backend finalize thành công.

## Mã lỗi nghiệp vụ ổn định

Policy và API dùng mã lỗi ổn định, tối thiểu:

- `CONTRACT_NUMBER_DUPLICATE`
- `CONTRACT_DATE_INVALID`
- `CONTRACT_END_DATE_REQUIRED`
- `CONTRACT_END_DATE_FORBIDDEN`
- `CONTRACT_PERIOD_OVERLAP`
- `CONTRACT_REVISION_CONFLICT`
- `CONTRACT_RENEWAL_NOT_ALLOWED`
- `CONTRACT_CANCELLATION_NOT_ALLOWED`
- `CONTRACT_TERMINATION_NOT_ALLOWED`
- `CONTRACT_DOCUMENT_INVALID`
- `CONTRACT_DOCUMENT_TOO_LARGE`
- `CONTRACT_IMPORT_REFERENCE_CONFLICT`

Mỗi mã có message `vi` và `zh`; enum/mã lỗi không dùng trực tiếp làm nội dung
hiển thị.

## Tương thích và rollout

Không backfill trường hợp đồng vào `EmployeeProfile`. Các collection mới được
triển khai sau shared types/policy.

Thứ tự rollout:

1. deploy Firestore indexes/rules;
2. deploy backend với feature flag đóng;
3. deploy frontend với feature flag đóng;
4. chạy import dry-run và đối soát;
5. mở tính năng theo nhóm HR thử nghiệm;
6. mở self-read sau khi dữ liệu và quyền đã được kiểm tra.

Rollback bằng feature flag; không xóa contract, number lock, document hoặc
audit đã tạo.

## Hệ quả

- Lịch sử hợp đồng và gia hạn được giữ độc lập với snapshot hồ sơ nhân viên.
- Unique lock và transaction tăng số document write nhưng loại bỏ race condition.
- PDF riêng tư cần backend-mediated upload/download thay cho tiện ích upload
  công khai hiện tại.
- Import yêu cầu HR cung cấp metadata; hệ thống không đọc nội dung PDF.
- OCR có thể được thiết kế thành module đề xuất riêng trong tương lai mà không
  thay đổi nguồn dữ liệu hợp đồng đã xác nhận.

## Hoàn thành Giai đoạn 0

- [x] Chốt loại hợp đồng và trạng thái.
- [x] Chốt quy tắc duy nhất và chống chồng lấn.
- [x] Chốt gia hạn, hủy và chấm dứt trước hạn.
- [x] Chốt schema khái niệm và collection.
- [x] Chốt permission Việt/Trung.
- [x] Chốt bảo mật và versioning PDF.
- [x] Chốt chuẩn ngày `DD-MM-YYYY` tại UI/import.
- [x] Chốt template import lịch sử phiên bản `1.0`.
- [x] Ghi rõ OCR nằm ngoài phạm vi hiện tại.
