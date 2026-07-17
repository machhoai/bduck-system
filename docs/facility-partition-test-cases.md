# Bộ test case xác nhận phân vùng cơ sở

## 1. Mục tiêu và tiêu chí đạt

Bộ test này xác nhận cùng một quyết định phân quyền được áp dụng nhất quán tại
backend, Firestore Rules, listener frontend và cache local. Một đợt kiểm thử chỉ
được xem là đạt khi:

- Không API, deep link, listener hay truy vấn Firestore nào trả dữ liệu ngoài
  effective scope của người dùng.
- Có scope nhưng thiếu action, hoặc có action nhưng ngoài scope, đều bị từ chối.
- Văn phòng `ALL` nhận Kho/Cửa hàng mới sau khi materialization hoàn tất nhưng
  không nhận Văn phòng khác.
- Thu hồi scope làm listener cũ dừng và dữ liệu bị thu hồi biến mất không cần F5.
- Tài khoản bị vô hiệu hóa, snapshot sai version và phiên offline chưa được xác
  minh đều fail-closed.
- Mọi thay đổi scope/workplace/role có `audit_logs` chứa actor, action time, sync
  time, old value và new value.

Lệnh regression đầy đủ:

```powershell
pnpm test:facility-partition
```

## 2. Dữ liệu kiểm thử chuẩn

| Mã   | Loại        | Cấu hình                            |
| ---- | ----------- | ----------------------------------- |
| `OA` | Văn phòng A | Scope `ALL`                         |
| `OB` | Văn phòng B | Scope `SELECTED`: Kho C, Cửa hàng D |
| `OH` | Văn phòng H | Không thuộc scope OA/OB             |
| `WC` | Kho C       | Thuộc OB                            |
| `SD` | Cửa hàng D  | Thuộc OB, có doanh thu              |
| `WE` | Kho E       | Ngoài scope OB                      |
| `SF` | Cửa hàng F  | Ngoài scope OB                      |
| `SG` | Cửa hàng G  | Tạo sau khi OA đã dùng `ALL`        |

| Actor      | Nơi làm việc   | Quyền/phạm vi                           |
| ---------- | -------------- | --------------------------------------- |
| `SYS`      | Không bắt buộc | System admin, assignment null-scope `*` |
| `OA-MGR`   | OA             | Quản lý kho/cửa hàng, scope `ALL`       |
| `OB-MGR`   | OB             | Quản lý WC và SD                        |
| `OB-VIEW`  | OB             | Chỉ `inventory.read` tại WC và SD       |
| `WC-STAFF` | WC             | Nhân sự kho, chỉ WC                     |
| `SD-STAFF` | SD             | Nhân sự cửa hàng, chỉ SD                |
| `DISABLED` | OB             | Tài khoản `INACTIVE`                    |

Mỗi cơ sở cần tối thiểu hai bản ghi cho inventory, voucher, nhân sự và audit.
SD/SF cần thêm revenue; tạo một transfer `WC → SD` và một transfer `WE → SF`.

## 3. Test domain và danh mục cơ sở

| ID         | Thao tác                                | Kết quả mong đợi                                 | Lớp xác minh |
| ---------- | --------------------------------------- | ------------------------------------------------ | ------------ |
| `PART-001` | OA-MGR đọc inventory WC, SD, WE, SF     | Cho phép                                         | Auto + UAT   |
| `PART-002` | Tạo SG rồi hoàn tất rebuild OA-MGR      | SG tự xuất hiện trong effective scope            | Auto + UAT   |
| `PART-003` | Tạo OH khi OA dùng ALL                  | OA-MGR không thấy/không quản lý OH               | Auto + UAT   |
| `PART-004` | OB-MGR mở WC và SD                      | Cho phép                                         | Auto + UAT   |
| `PART-005` | OB-MGR mở WE hoặc SF bằng URL trực tiếp | API 403/404 policy-safe, UI không render dữ liệu | Auto + UAT   |
| `PART-006` | OB-MGR mở OA/OH                         | Không thấy dữ liệu văn phòng khác                | Auto + UAT   |
| `PART-007` | WC-STAFF đọc WC                         | Cho phép                                         | Auto + UAT   |
| `PART-008` | WC-STAFF đọc SD/WE                      | Từ chối                                          | Auto + UAT   |
| `PART-009` | SD-STAFF đọc revenue SD                 | Cho phép                                         | Auto + UAT   |
| `PART-010` | SD-STAFF đọc revenue SF hoặc WC         | Từ chối; kho không phải revenue target           | Auto + UAT   |
| `PART-011` | OB-VIEW sửa inventory WC                | Từ chối vì thiếu action write                    | Auto + UAT   |
| `PART-012` | OB-VIEW đọc inventory WE                | Từ chối vì ngoài scope                           | Auto + UAT   |
| `PART-013` | SYS đọc OA, OB, OH, WC, SD, WE, SF      | Cho phép theo action; revenue chỉ ở STORE        | Auto + UAT   |

## 4. Test API, list/detail và Firestore

| ID         | Bước kiểm thử                                           | Kết quả mong đợi                                   |
| ---------- | ------------------------------------------------------- | -------------------------------------------------- |
| `DATA-001` | OB-MGR gọi list inventory                               | Chỉ có WC và SD; không tải WE/SF rồi filter client |
| `DATA-002` | OB-MGR gọi detail inventory/voucher của WE              | Response không chứa tài nguyên; lỗi song ngữ       |
| `DATA-003` | Query inventory với `warehouse_id in [WC, SD]`          | Thành công, chỉ trả WC/SD                          |
| `DATA-004` | Query inventory với `warehouse_id in [WC, WE]`          | Firestore `permission-denied` toàn query           |
| `DATA-005` | Query inventory không có facility constraint            | Firestore `permission-denied`                      |
| `DATA-006` | Đọc child item của voucher WC                           | Actor có WC được đọc; actor chỉ có SD bị từ chối   |
| `DATA-007` | Đọc user/profile làm việc tại WE bằng OB-MGR            | Từ chối                                            |
| `DATA-008` | Đọc notification của người khác                         | Từ chối; chỉ recipient được đọc/cập nhật `is_read` |
| `DATA-009` | Người dùng đọc `authorization_shadow_diffs`/`counters`  | Từ chối kể cả SYS trên browser                     |
| `DATA-010` | Đổi metadata sang version không tồn tại/sai grant count | Mọi đọc facility-scoped fail-closed                |

## 5. Test realtime, thu hồi quyền và offline

| ID       | Bước kiểm thử                                           | Kết quả mong đợi/bằng chứng                                  |
| -------- | ------------------------------------------------------- | ------------------------------------------------------------ |
| `RT-001` | Mở inventory SD bằng OB-MGR, xóa SD khỏi SELECTED       | `access_version` tăng; listener cũ hủy; SD biến mất không F5 |
| `RT-002` | Thêm SD lại scope OB                                    | Listener mới đăng ký và SD xuất hiện realtime                |
| `RT-003` | Chuyển nhân sự từ OB sang WE                            | Mất WC/SD, chỉ nhận WE sau snapshot mới                      |
| `RT-004` | Đặt user thành INACTIVE khi đang mở trang               | Phiên bị chặn; dữ liệu nhạy cảm không tiếp tục render        |
| `RT-005` | Thu hồi SD rồi thử đọc với token cũ                     | Firestore từ chối ngay theo active version mới               |
| `RT-006` | Ngắt mạng trước khi có snapshot được server xác minh    | Không render cache nhạy cảm; trạng thái fail-closed/skeleton |
| `RT-007` | Offline sau snapshot hợp lệ rồi online khi scope đã đổi | Không áp dụng grant cũ; chờ version mới và remount listener  |
| `RT-008` | Đăng xuất OA-MGR, đăng nhập WC-STAFF trên cùng máy      | Không thấy cache/draft/phân quyền của OA-MGR                 |

Ghi lại timestamp thay đổi scope, timestamp listener nhận version mới và ảnh
chụp trước/sau. Không dùng F5 hoặc nút tải lại trong các case realtime.

## 6. Test transfer, phê duyệt và chống leo thang quyền

| ID         | Bước kiểm thử                             | Kết quả mong đợi                           |
| ---------- | ----------------------------------------- | ------------------------------------------ |
| `FLOW-001` | OB-MGR xem transfer WC → WE               | Được xem vì có scope nguồn WC              |
| `FLOW-002` | OB-MGR xem transfer WE → SD               | Được xem vì có scope đích SD               |
| `FLOW-003` | OB-MGR xem transfer WE → SF               | Từ chối vì không có endpoint nào           |
| `FLOW-004` | OB-MGR xuất/hủy transfer từ WC            | Cho phép nếu có `transfers.write` tại WC   |
| `FLOW-005` | OB-MGR xuất/hủy transfer từ WE tới SD     | Từ chối vì write kiểm tra nguồn WE         |
| `FLOW-006` | OB-MGR nhận transfer WE → SD              | Cho phép nếu có `transfers.receive` tại SD |
| `FLOW-007` | OB-MGR nhận transfer WC → SF              | Từ chối vì receive kiểm tra đích SF        |
| `FLOW-008` | Creator tự duyệt chứng từ                 | Từ chối self-approval                      |
| `FLOW-009` | OB-MGR cấp role tại WE/SF hoặc null-scope | Từ chối                                    |
| `FLOW-010` | OB-VIEW cấp `inventory.write` tại WC      | Từ chối vì actor không sở hữu action       |
| `FLOW-011` | OB-MGR cấp `inventory.read` tại WC        | Cho phép và tạo audit old/new đầy đủ       |

## 7. Test quản trị phạm vi, timeline và materialization

| ID          | Bước kiểm thử                                                          | Kết quả mong đợi                                                             |
| ----------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `SCOPE-001` | SYS cấu hình OA với scope `ALL`, sau đó tạo Cửa hàng SG                | SG tự vào effective scope của nhân sự OA; văn phòng mới không được kế thừa   |
| `SCOPE-002` | SYS cấu hình ceiling OB là `SELECTED [WC, SD]`                         | OB-MGR chỉ thấy WC/SD là lựa chọn hợp lệ                                     |
| `SCOPE-003` | OB-MGR thêm SD hoặc bỏ WC khỏi `SELECTED`                              | Revision tăng; timeline ghi trước/sau, thêm/bớt và số nhân sự bị ảnh hưởng   |
| `SCOPE-004` | Chuyển nhân sự OA sang OB                                              | Rebuild dùng đúng workplace mới; quyền OA bị thu hồi và chỉ còn scope OB     |
| `SCOPE-005` | Thay đổi role áp dụng cho nhân sự trong OB                             | Tạo rebuild, `access_version` tăng và permission kế thừa phản ánh role mới   |
| `SCOPE-006` | Kết hợp direct grant với inherited grant tại cùng facility             | Permission được hợp nhất và giữ đủ nguồn; direct grant không mở rộng ceiling |
| `SCOPE-007` | Thu hồi SD khi OB-MGR đang online, sau đó lặp lại lúc thiết bị offline | Online hủy listener ngay; offline không render cache cũ khi kết nối lại      |
| `SCOPE-008` | Hai admin cùng lưu dựa trên một `expected_revision`                    | Chỉ request đầu thành công; request sau nhận conflict 409 và không ghi đè    |
| `SCOPE-009` | OB-MGR cố thêm WE ngoài ceiling                                        | API từ chối kể cả khi OB-MGR có direct grant tại WE                          |
| `SCOPE-010` | Văn phòng chưa có scope/ceiling được truy cập bởi manager              | Fail-closed; không tự suy diễn `ALL` hay facility từ assignment              |
| `SCOPE-011` | Đổi scope của văn phòng không có nhân sự                               | Materialization hoàn tất ngay với requested/completed/failed đều bằng 0      |
| `SCOPE-012` | Giả lập rebuild ba user, một user lỗi; bấm retry                       | Trạng thái `FAILED`, retry chỉ user lỗi, idempotent và kết thúc `COMPLETED`  |
| `SCOPE-013` | Người có `office_scopes.read` nhưng không có `write` mở trang Office   | Xem timeline/preview được nhưng toàn bộ điều khiển sửa và retry bị ẩn/khóa   |
| `SCOPE-014` | Đọc materialization của Office khác hoặc private job từ browser        | Firestore `permission-denied`; response công khai không lộ user ID lỗi       |

Timeline phải hiển thị actor, `action_time`, `sync_time`, revision, before/after,
facility thêm/bớt, số nhân sự bị ảnh hưởng và trạng thái materialization. Mỗi lần
retry phải tạo audit riêng nhưng không tạo revision scope mới.

## 8. Checklist bằng chứng và kết luận

Với mỗi case UAT, lưu:

- Mã case, môi trường, commit, actor và `access_version`.
- Request/response API hoặc lỗi Firestore; không lưu token/cookie.
- Danh sách document ID thực tế trả về.
- Ảnh UI trước/sau đối với listener realtime.
- Audit log tương ứng cho các thay đổi scope, workplace, role và user status.

Kết luận **PASS** chỉ khi toàn bộ automated suite xanh và mọi case UAT bắt
buộc không có dữ liệu ngoài scope. Một lỗi lộ document ngoài scope là lỗi chặn
rollout, không được chấp nhận bằng cách ẩn dữ liệu ở UI.
