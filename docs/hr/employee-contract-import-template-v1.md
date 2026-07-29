# Đặc tả import lịch sử hợp đồng lao động v1.0

- Trạng thái: Chấp thuận cho Giai đoạn 0
- Phiên bản template: `1.0`
- Định dạng: `.xlsx`
- Dung lượng Excel tối đa: 10MB
- Số dòng dữ liệu tối đa mỗi batch: 100
- File hợp đồng: PDF tùy chọn, tối đa 10MB mỗi file

## Mục tiêu

Template dùng để nhập hợp đồng cũ có kiểm soát, preview trước khi commit và
chống tạo trùng khi retry. Excel là nguồn metadata; hệ thống không đọc nội dung
PDF để tự điền dữ liệu.

## Cấu trúc workbook

Workbook gồm:

- `Employee_contracts`: sheet dữ liệu hiển thị cho HR;
- `_refs`: danh sách tham chiếu cho dropdown, có thể ẩn;
- `_meta`: metadata template, có thể ẩn.

Sheet `_meta` tối thiểu có:

| key                | value                |
| ------------------ | -------------------- |
| `template_version` | `1.0`                |
| `data_sheet_name`  | `Employee_contracts` |
| `date_format`      | `DD-MM-YYYY`         |

Backend không xử lý workbook thiếu `_meta` hoặc sai `template_version`.

## Các cột

| Cột                | Bắt buộc     | Quy tắc                                              |
| ------------------ | ------------ | ---------------------------------------------------- |
| `source_reference` | Có           | Duy nhất, 1–120 ký tự, chỉ chữ/số và `._:/-`         |
| `employee_code`    | Có           | Mã nhân viên tồn tại và thuộc phạm vi người import   |
| `contract_number`  | Có           | Duy nhất toàn công ty sau khi normalize              |
| `contract_type`    | Có           | `PROBATION`, `FIXED_TERM`, `INDEFINITE`, `SEASONAL`  |
| `start_date`       | Có           | Ngày thật theo `DD-MM-YYYY`                          |
| `end_date`         | Có điều kiện | Bắt buộc trừ `INDEFINITE`; trống với `INDEFINITE`    |
| `lifecycle_state`  | Không        | Trống, `TERMINATED` hoặc `CANCELLED`                 |
| `lifecycle_date`   | Có điều kiện | Bắt buộc với `TERMINATED`; `DD-MM-YYYY`              |
| `lifecycle_reason` | Có điều kiện | Bắt buộc khi có `lifecycle_state`, tối đa 1000 ký tự |
| `pdf_file_name`    | Không        | Tên chính xác của PDF đã upload trong cùng batch     |
| `notes`            | Không        | Tối đa 2000 ký tự                                    |

Không có cột `status`. Backend suy ra `UPCOMING`, `ACTIVE` hoặc `EXPIRED` theo
ngày hiện tại và sự kiện lifecycle.

## Quy tắc ngày

- Excel chỉ dùng `DD-MM-YYYY`.
- Không chấp nhận ngày serial của Excel ở template v1.0 để tránh phụ thuộc
  timezone và locale của máy người dùng.
- `start_date <= end_date` nếu có `end_date`.
- `INDEFINITE` phải để trống `end_date`.
- Ba loại còn lại bắt buộc có `end_date`.
- `lifecycle_date` của `TERMINATED` không được trước `start_date` hoặc sau
  `end_date`.
- `CANCELLED` không chiếm khoảng hiệu lực; `lifecycle_date` có thể để trống.

Backend chuyển ngày hợp lệ thành `LocalDate` `YYYY-MM-DD` trước khi chạy policy.

## Liên kết PDF

PDF không bắt buộc. Nếu `pdf_file_name` có giá trị:

- file phải tồn tại trong cùng import batch;
- tên file phải khớp chính xác sau khi trim;
- một file chỉ được liên kết với một dòng;
- MIME phải là `application/pdf`;
- phần mở rộng phải là `.pdf`;
- magic bytes và dung lượng phải hợp lệ;
- SHA-256 được lưu trong document metadata.

Tên file trùng trong cùng batch là lỗi. PDF không được nhúng trực tiếp trong
workbook.

## Preview

Preview kiểm tra toàn bộ batch:

- template/version/header;
- dữ liệu bắt buộc và sanitize;
- quyền `employees.contracts.history.import`;
- quyền theo cơ sở của từng nhân viên;
- mã nhân viên;
- số hợp đồng trùng trong file và trong hệ thống;
- `source_reference` trùng hoặc xung đột;
- loại hợp đồng và quy tắc ngày;
- overlap với dữ liệu hiện có và giữa các dòng trong batch;
- lifecycle state/date/reason;
- PDF được tham chiếu.

Mỗi row view chứa:

- số dòng;
- payload gốc đã normalize;
- hồ sơ nhân viên được resolve;
- trạng thái hợp lệ;
- danh sách lỗi/cảnh báo `vi` và `zh`;
- ID hợp đồng sau commit, nếu có.

Batch có ít nhất một dòng lỗi không được commit.

## Commit và idempotency

Mỗi dòng dùng ID ổn định từ:

```text
employee-contract-import:{source_reference}
```

Commit:

1. đọc lại batch preview và checksum file nguồn;
2. xác nhận batch chưa thay đổi;
3. xử lý từng dòng bằng Firestore transaction;
4. tạo number lock, contract, document metadata và audit;
5. đánh dấu row đã commit;
6. cập nhật tổng số thành công/thất bại của batch.

Cùng `source_reference` và cùng canonical payload được xem là retry. Cùng
reference nhưng payload/checksum khác trả `CONTRACT_IMPORT_REFERENCE_CONFLICT`.

Không rollback bằng cách xóa dữ liệu. Batch gián đoạn có thể retry và bỏ qua
những dòng đã commit.

## Audit

Audit tối thiểu ghi:

- import batch và checksum nguồn;
- actor;
- `action_time` và `sync_time`;
- source reference;
- payload chuẩn hóa;
- contract/document đã tạo;
- lỗi hoặc trạng thái commit.

PDF và dữ liệu hợp đồng không được ghi nguyên nội dung file vào audit log.

## Ví dụ

| source_reference       | employee_code | contract_number | contract_type | start_date   | end_date     | lifecycle_state | lifecycle_date | lifecycle_reason                  | pdf_file_name       | notes               |
| ---------------------- | ------------- | --------------- | ------------- | ------------ | ------------ | --------------- | -------------- | --------------------------------- | ------------------- | ------------------- |
| `LEGACY:NV001:2025-01` | `NV001`       | `HDLD-2025-001` | `FIXED_TERM`  | `01-01-2025` | `31-12-2025` |                 |                |                                   | `HDLD-2025-001.pdf` |                     |
| `LEGACY:NV002:TV-01`   | `NV002`       | `HDTV-2026-002` | `SEASONAL`    | `01-06-2026` | `31-08-2026` | `TERMINATED`    | `15-07-2026`   | `Hai bên thống nhất kết thúc sớm` |                     | `Không có bản scan` |
| `LEGACY:NV003:KTH`     | `NV003`       | `HDLD-KTH-003`  | `INDEFINITE`  | `01-03-2024` |              |                 |                |                                   | `HDLD-KTH-003.pdf`  |                     |

## Điều kiện nghiệm thu khi triển khai

- Template hiển thị đúng định dạng ngày `DD-MM-YYYY`.
- Dropdown loại hợp đồng/lifecycle dùng code ổn định.
- Preview không ghi contract chính thức.
- Commit chống trùng khi retry.
- Không thể vượt RBAC cơ sở qua `employee_code`.
- Không tạo được hợp đồng chồng lấn.
- PDF sai loại hoặc quá 10MB bị từ chối.
- Tất cả lỗi có message Việt–Trung.
