# Kế hoạch đồng bộ ATP JPULSE → OpenAPI Trung Quốc

Ngày: 2026-09-15. Trạng thái: đã triển khai luồng cốt lõi mapping, đối chiếu và đồng bộ thủ công; ghi production vẫn tắt cho tới khi mutation test được nghiệm thu.

> Cập nhật triển khai: backend dùng API quản trị JoyWorld đã khảo sát, chỉ lấy ATP JPULSE làm target, ghép SKU chính xác, có snapshot TTL, recheck trước gửi, idempotency theo request, khóa theo kho, read-back và trạng thái `UNKNOWN`. Khi kết quả chưa xác định, hệ thống chỉ cho đối soát lại bằng thao tác đọc và không gửi lại mutation mù. Frontend có picker-only mapping kho/danh mục và modal desktop/mobile tại chi tiết kho. `JOYWORLD_INVENTORY_SYNC_WRITE_ENABLED` mặc định `false`.

## 1. Quyết định nghiệp vụ đã chốt

| Nội dung | Quyết định của người dùng |
| --- | --- |
| Nguồn dữ liệu chuẩn | JPULSE |
| Chiều ghi | JPULSE → OpenAPI Trung Quốc |
| Số lượng gửi | Chỉ tồn khả dụng `atp_quantity` |
| Ghép sản phẩm | `Product.code` trùng chính xác `giftNo` |
| Mapping kho | Một-một trong từng kết nối đối tác |
| Không có sản phẩm đối ứng | Hiển thị lý do, chặn chọn/gửi dòng đó |
| Phê duyệt | Người có quyền bấm là gửi ngay; không có bước người khác duyệt |
| Thao tác | Chọn một/nhiều sản phẩm trong modal tại chi tiết kho |
| Mapping UI | Chỉ chọn giá trị lấy từ API; không nhập mã/tên tự do |
| Mapping danh mục | Danh mục JPULSE ↔ `gift_type.typeId` trong đúng kết nối |
| Cơ chế kích hoạt | Chỉ chạy khi người dùng mở modal và chủ động bấm đồng bộ; không có lịch định kỳ, webhook hoặc tự đồng bộ khi tạo đơn |

Giai đoạn này bao gồm mapping, đối chiếu và gửi tồn. Tạo hàng hóa phía đối tác và tích hợp ghi tồn vào JPOS riêng là phạm vi sau. `jposProductSyncClient.ts` hiện có dùng giao thức riêng, không thay thế OpenAPI đối tác.

## 2. Căn cứ và quy tắc dự án

Đã đọc `.agent/rules/rules.md`, `AGENTS.md`, `packages/shared-types/src/master-data.ts`, `inventory.ts`, `system.ts` và các phần tích hợp liên quan.

- `Warehouse`, `ProductCategory` hiện chưa có mapping đối tác.
- `Inventory` lưu theo kho–vị trí–sản phẩm. `total_quantity` gồm ATP, on-hold, in-transit, quarantine. Chỉ cộng ATP trong tính năng này.
- `OpenApiWarehouseConfig` và `openApiConfigService.ts` đã quản lý cấu hình theo kho, mã hóa secret và version theo action.
- `openApiService.ts` đã ký MD5 và gửi `/openapi/action`; cần bổ sung validation response, timeout, phân loại lỗi khi tích hợp ghi tồn, không áp retry ghi đại trà cho mọi action hiện có.
- `useInventory.ts` đã có listener Firestore giới hạn theo quyền cơ sở; nhánh fallback API hiện không đủ để cam kết realtime, cần listener thay thế nếu dùng fallback trong modal.
- `useInventoryByWarehouse.ts` có helper cộng `Math.max(atp_quantity, 0)`. Không tái sử dụng phép làm tròn âm đó cho đồng bộ: số âm phải hiển thị lỗi dữ liệu.
- `WarehouseDetailHero.tsx`, `WarehouseFormModal.tsx`, `CategoryFormModal.tsx` là điểm tích hợp giao diện.
- Dự án đã có Cloud Tasks dispatcher và worker job trong module hóa đơn/voucher. Tái sử dụng mẫu tổ chức, cấu hình riêng cho tồn kho.

Tuân thủ: shared types trước code; Controller → Service → Repository; JWT và RBAC ở backend; Zod; messages vi/zh; audit_logs; soft delete; realtime; local-first; light theme; Tailwind; skeleton; goey-toast promise và chống click đúp; module khoảng 200–300 dòng.

Đã đọc `.agent/skills/frontend-expert/SKILL.md`. Các hướng dẫn MUI/inline style/snackbar của skill nhường cho quy tắc Tailwind/goey-toast của dự án. Skill `brainstorming` và các reference được dẫn trong frontend-expert chưa tìm thấy trong lần kiểm tra; yêu cầu nghiệp vụ đã được làm rõ trực tiếp và người dùng trả lời đủ 5 câu hỏi. Trước khi viết Next.js code phải đọc guide tương ứng trong `node_modules/next/dist/docs/` của phiên bản cài đặt.

Nút “Đồng bộ kho Trung Quốc” là điểm kích hoạt duy nhất. Khi mở modal, hệ thống lấy một snapshot mới để đối chiếu; chỉ khi người có quyền chọn dòng và bấm đồng bộ mới phát sinh lệnh ghi. Không có polling định kỳ, webhook tự ghi hoặc tự đồng bộ trước khi tạo đơn JPOS. Không thêm bước phê duyệt vào luồng đã chốt. Chênh lệch giữa hai hệ thống là kết quả đối chiếu tích hợp, không tự tạo biên bản kiểm đếm hoặc cách ly hàng; nghiệp vụ kiểm đếm thực tế giữ quy tắc evidence/QUARANTINE hiện hành.

## 3. Hợp đồng API và điều kiện mở chức năng

| Khả năng | Bằng chứng hiện có | Việc cần hoàn tất |
| --- | --- | --- |
| Danh sách kho | API quản trị `GET /gift/manager/stockbase/getlist` | Đã xác minh HTTP 200, `success=true`; trả `{ key: stockId, value: stockName }`, hiện có 4 kho |
| Danh mục | API quản trị `GET /gift/manager/type/getlist`; OpenAPI `gift_type` | Đã xác minh; hai nguồn khớp, hiện có 2 nhóm |
| Đọc tồn | API quản trị `GET /gift/manager/stockvalue/list?isFilterZero=false&page=...`; OpenAPI `gift_realtime_stock` | Đã xác minh 228 dòng và khớp theo `giftId + stockId`; mỗi dòng có `giftNo`, `giftId`, `stockId`, `amount` |
| Ghi tăng tồn | `POST /gift/manager/stockvalue/batch/gift/add` | Đã xác định method, endpoint và payload từ frontend; chưa gửi mutation hợp lệ trên shop thật |
| Ghi giảm tồn | `POST /gift/manager/stockvalue/batch/gift/out` | Đã xác định method, endpoint và payload từ frontend; chưa gửi mutation hợp lệ trên shop thật |

`goodsstockbase` là khái niệm màn hình/danh mục kho; request thực tế của trang quản trị là `/gift/manager/stockbase/getlist`. API quản trị dùng Bearer token lấy từ `/basic/manager/login/account`, không dùng chữ ký OpenAPI. Credential và token chỉ được giữ ở backend JPULSE, không đưa ra trình duyệt JPULSE hoặc log.

Contract chi tiết của bốn màn hình, gồm request/response và payload nhập/xuất/tạo/cập nhật, nằm tại `docs/joyworld-manager-browser-contracts-20692.md`.

Cần lấy từ đối tác:

1. API danh sách kho trả về ID ổn định; có hỗ trợ cả kho rỗng và trạng thái khóa/ngừng hoạt động.
2. Xác nhận chính thức cho phép tích hợp hai endpoint tăng/giảm tồn của API quản trị. Hiện chưa tìm thấy API đặt tồn tuyệt đối hoặc compare-and-set.
3. Ý nghĩa `amount`: phải xác nhận trường ghi/đọc tương thích tồn khả dụng ATP, không vô tình ghi vào tổng tồn khác định nghĩa.
4. Cơ chế request ID/idempotency, tra cứu trạng thái lệnh, timeout, lỗi từng dòng, giới hạn batch/rate, độ trễ dữ liệu sau ghi.
5. Đơn vị tính, số lẻ, tồn âm, SKU phân biệt hoa thường và số 0 đầu mã.
6. Thẩm quyền của JPULSE đối với tồn phía đối tác, kể cả khi đối tác có giao dịch đang cập nhật cùng lúc.

Adapter nội bộ dự kiến: `fetchPartnerWarehouses`, `fetchPartnerGiftTypes`, `fetchPartnerStock`, `increasePartnerStock`, `decreasePartnerStock`. Đây là tên hàm JPULSE đề xuất; chúng bọc API quản trị và không phải action OpenAPI.

Cho phép xây dựng schema, UI và test bằng fixture trong khi chờ hợp đồng. Chỉ bật đọc thật khi xác minh API đọc; chỉ bật ghi thật khi xác minh đầy đủ API ghi. Không báo hoàn thành tính năng nếu mới có mock hoặc chỉ đọc đối chiếu.

## 4. Mapping và nhận diện kết nối

### Kho

- Tách khái niệm kết nối/cửa hàng đối tác khỏi `stockId`: một AppId có thể chứa nhiều kho đối tác.
- Tạo định danh kết nối ổn định phía server theo account đã xác nhận (base URL chuẩn hóa + AppId). Không đưa secret vào định danh; đổi secret không làm mất mapping.
- Vẫn tái sử dụng kho sở hữu cấu hình `openapi_warehouse_configs` để resolve credential. Không đổi luồng cấu hình doanh thu hiện có.
- Nếu nhiều cấu hình kho cùng account, dùng một connection ID và một chủ cấu hình rõ ràng; cấu hình trùng nhưng bất nhất phải được xử lý trước khi bật sync, không tự chọn credential.
- Mỗi mapping giữ `connection_id`, `config_warehouse_id`, `warehouse_id`, `partner_stock_id`, tên/mã hiển thị, version, trạng thái và metadata audit.
- Transaction bảo vệ cả hai khóa duy nhất: `(connection_id, warehouse_id)` và `(connection_id, partner_stock_id)`. Có khóa claim phía DB để hai người lưu đồng thời không mapping trùng.
- Đổi mapping/connection khi có job đang gửi hoặc kết quả chưa rõ bị chặn đến khi xử lý xong. Đổi mapping tạo version mới và vô hiệu preview cũ. Hủy mapping là soft delete và giải phóng claim có kiểm soát.

### Danh mục

- Mapping lưu riêng theo `(connection_id, category_id)` → `partner_type_id`; không lưu một `typeId` toàn cục vào danh mục dùng chung nhiều cửa hàng.
- Quy tắc thiết kế: mỗi danh mục JPULSE có một đối ứng trong mỗi kết nối; nhiều danh mục JPULSE được chọn cùng một nhóm đối tác. Không áp ràng buộc một-một của kho sang danh mục.
- Danh mục có cây: mapping trực tiếp danh mục của sản phẩm, không tự kế thừa từ cha. Giao diện hiển thị rõ trạng thái chưa mapping.
- Mapping không đổi phân loại sản phẩm tại đối tác. Khi thiếu mapping hoặc loại đối tác chưa được xác minh, hiển thị cảnh báo theo dòng; chặn ghi cho đến khi mapping hợp lệ theo chính sách giai đoạn đầu.
- Danh sách `gift_type` chỉ trả ID/tên; response tồn chỉ trả `typeName`. Không dùng tên để xác minh ID: khi cần xác thực membership, đọc tồn theo `typeId` đã mapping và `stockId` đích.

### UI chọn mapping

- Form kho: chọn kết nối trong danh sách có quyền, sau đó chọn kho đối tác bằng tên + mã/ID; hiển thị trạng thái đã dùng bởi mapping khác.
- Form danh mục: chọn kết nối và chọn nhóm `gift_type` tương ứng.
- Dùng dropdown/list picker không có ô nhập mã hoặc nhập tên tự do, không creatable option. Mobile dùng sheet chọn với danh sách cuộn và vùng chạm lớn.
- Backend kiểm tra lại ID thuộc đúng danh sách/kết nối và còn hợp lệ; không tin giá trị select gửi từ client.
- Skeleton khi tải; danh sách trống, chưa cấu hình và API lỗi là các trạng thái riêng, có mô tả vi/zh.

## 5. Tính toán đối chiếu

Với kho W và sản phẩm P:

```text
ATP_JPULSE(W, P) = SUM(atp_quantity của các dòng Inventory hợp lệ thuộc W, P)
Chênh lệch = ATP_JPULSE - amount_Trung_Quốc
Số lượng đích sau gửi = ATP_JPULSE
```

- Backend là nơi tính ATP đáng tin cậy. Frontend chỉ hiển thị; không nhận số lượng client làm nguồn chuẩn.
- Ghép chính xác chuỗi `Product.code` với `giftNo`. Giữ số 0 đầu mã và hoa/thường; không ghép theo tên, barcode hoặc ép mã sang số.
- Cộng các vị trí thuộc đúng kho, bỏ dữ liệu soft-delete; không cộng số lượng gán kệ/slot vì sẽ trùng Inventory.
- Âm/NaN/đơn vị không tương thích/số lẻ không được đối tác hỗ trợ: báo lỗi và chặn dòng, không clamp hoặc làm tròn.
- Danh sách gồm sản phẩm có Inventory trong kho và sản phẩm đối tác để phát hiện dòng chỉ có ở một bên. Không tự lấy toàn bộ catalog JPULSE rồi mặc định mỗi SKU đều thuộc kho này.
- SKU có Inventory hợp lệ, tổng ATP bằng 0 và có đối ứng: được phép gửi 0.
- SKU chỉ có phía đối tác nhưng chưa có Inventory/quan hệ kho có thẩm quyền ở JPULSE: hiển thị “Chưa xác định nguồn JPULSE”, chặn gửi; không mặc định xóa tồn đối tác về 0.
- API không trả SKU: “Chưa có đối ứng trong kết quả API”, chặn dòng. Không khẳng định hàng chưa tồn tại toàn hệ thống; không coi thiếu dòng là tồn 0.
- Luôn gửi `isFilterZero: false`. Nếu lỗi/trang thiếu/response không đầy đủ thì không thay dữ liệu bằng mảng rỗng hoặc số 0; giữ snapshot cũ và đánh dấu cũ/lỗi.
- Response mẫu chỉ có `stockName`, không có `stockId`: đọc riêng từng `stockId` đã mapping và gắn ngữ cảnh request vào snapshot; nghiệm thu việc lọc kho hoạt động chính xác. Không ghép kho bằng tên.
- Trùng SKU trong cùng kết quả kho mà không có quy tắc phân tách rõ: chặn dòng; không lấy dòng đầu hoặc cộng tùy ý.

## 6. Modal đồng bộ tại trang chi tiết kho

### Bố cục

Header: “Đồng bộ kho Trung Quốc”, tên kho JPULSE → tên kho đối tác, trạng thái kết nối, thời điểm lấy số liệu đối tác. Kho đích cố định theo mapping của trang hiện tại.

Thanh tổng quan: tổng dòng, dòng lệch, dòng khớp, dòng bị chặn, số dòng được chọn. Bộ lọc theo danh mục và trạng thái; mặc định hiển thị toàn bộ để thấy cả hàng thiếu đối ứng.

| Chọn | SKU / Tên sản phẩm | ATP JPULSE | Tồn Trung Quốc | Chênh lệch | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| ☐ | SKU001 / Sản phẩm A | 125 | 100 | +25 | Có thể đồng bộ |
| ☐ | SKU002 / Sản phẩm B | 0 | 8 | -8 | Có thể đồng bộ |
| — | SKU003 / Sản phẩm C | 12 | — | — | Chưa có đối ứng |
| — | SKU004 / Sản phẩm D | 20 | 20 | 0 | Đã khớp |

Footer cố định: “Đã chọn N sản phẩm”, bỏ chọn, “Đồng bộ N sản phẩm”, đóng. Thông tin hướng gửi và ATP hiển thị thường trực; không có bước người khác phê duyệt.

### Hành vi lựa chọn

- Chỉ chọn các dòng lệch và đủ điều kiện. Dòng khớp không cần gửi lại; dòng bị chặn có lý do cụ thể.
- “Chọn tất cả N sản phẩm đủ điều kiện trong bộ lọc”: áp dụng toàn bộ kết quả lọc, xuyên trang. Nếu vượt giới hạn job, hiển thị giới hạn và yêu cầu thu hẹp; không âm thầm chọn một phần.
- Đổi bộ lọc xóa lựa chọn để không gửi dòng đang bị ẩn; thông báo số lựa chọn đã bỏ.
- Chọn tất cả chốt danh sách ID tại thời điểm chọn; dòng mới xuất hiện không tự được thêm.
- Realtime làm ATP, mapping hoặc đối ứng đổi: đánh dấu dòng thay đổi, bỏ chọn dòng bị ảnh hưởng; không tự gửi giá trị mới mà người dùng chưa nhìn thấy.
- Khi đang gửi: disable submit, hiển thị tiến độ/lỗi từng dòng. Có thể đóng modal; mở lại đọc job còn chạy. Server kiểm soát trùng job dù mở nhiều tab.
- Mobile dùng modal toàn màn hình với card từng sản phẩm, hai số lượng cạnh nhau, footer cố định; desktop dùng bảng có header cố định. Light theme, Tailwind, keyboard/focus trap, label checkbox rõ ràng.
- Skeleton theo bố cục; tất cả nhãn/lỗi vi/zh; thao tác mutation dùng goey-toast promise với mô tả và Retry phù hợp.
- Toast nhận job chỉ nói “Đã tiếp nhận”; chỉ nói hoàn tất khi job đã xác minh kết quả các dòng. Retry lỗi chưa rõ kết quả phải đi qua đối soát backend.

## 7. Kích hoạt thủ công, offline và độ mới của dữ liệu

- JPULSE dùng listener tồn kho theo phạm vi quyền để cập nhật ATP đang hiển thị. Dữ liệu JoyWorld chỉ được tải theo thao tác của người dùng.
- Mở modal tạo đúng một snapshot mới từ JoyWorld. Không polling lại trong nền. Người dùng có nút “Làm mới số liệu” để chủ động lấy snapshot khác; làm mới sẽ xóa lựa chọn cũ và yêu cầu chọn lại.
- UI luôn ghi “Số liệu JoyWorld lấy lúc …”. Trước khi bấm gửi, backend kiểm snapshot còn trong TTL ngắn. Nếu hết hạn, hệ thống chặn gửi và yêu cầu người dùng bấm “Làm mới”, không tự gọi API hoặc tự thay đổi lựa chọn.
- Offline được xem cache cuối cùng và giữ lựa chọn cục bộ, có nhãn offline/thời gian. Không xếp lệnh ghi tồn cũ tự chạy khi có mạng lại.
- Khi kết nối trở lại, người dùng chủ động bấm “Làm mới” rồi chọn và gửi lại. Nếu job đã được server nhận trước mất mạng thì job tiếp tục và UI nối lại bằng job ID; đây là tiếp tục tác vụ đã bấm, không phải một lần đồng bộ tự động mới.

## 8. Luồng ghi và an toàn khi có thay đổi đồng thời

1. Client gửi danh sách product ID đã chọn, preview ID/version, request ID và `action_time`; không gửi arbitrary action, kho đích hay số lượng đích để backend thực thi trực tiếp.
2. Backend kiểm JWT/quyền trên kho và kết nối, mapping version, snapshot đầy đủ/còn mới, SKU, đơn vị, loại số lượng.
3. Backend đọc ATP theo các vị trí và tạo dấu phiên bản từ nguồn đã đọc (các ID/bucket/version), so với preview. Nguồn đã đổi thì dòng đó `STALE`, không gửi; dòng hợp lệ vẫn có thể tiếp tục và có kết quả riêng.
4. Transaction tạo job, danh sách item bất biến, idempotency claim, audit và outbox dispatch. Chia batch có manifest/trạng thái PREPARING để job lớn không vượt giới hạn Firestore và không chạy trước khi tạo đủ item.
5. Worker Cloud Tasks đọc job đã lưu. Lấy lease/claim theo connection + stockId + SKU; recheck quyền của người yêu cầu, mapping và ATP trước khi gửi. Không gọi HTTP đối tác trong Firestore transaction có thể bị chạy lại.
6. Tính `delta = target ATP - partner-before`, tách batch tăng và giảm. Lưu send intent rồi gọi `/stockvalue/batch/gift/add` hoặc `/stockvalue/batch/gift/out`. Kho đích và target của một item không đổi khi retry.
7. Đọc lại `stockvalue/list` đúng kho/SKU sau từng batch. Chỉ `VERIFIED` khi số đối tác bằng target đã gửi.
8. Nếu ATP JPULSE đổi sau khi item đã gửi, giữ kết quả đã gửi cùng revision và hiển thị “Nguồn đã thay đổi/cần đồng bộ tiếp”. Không tự mở rộng tác vụ đã chọn thành đồng bộ nền vô hạn.
9. Lưu kết quả/audit từng item và kết quả tổng hợp. Một dòng lỗi không làm ghi ngược các dòng thành công; không giả lập rollback xuyên hệ thống.

### Timeout, retry, concurrency

- Request ID trùng + payload trùng trả lại job cũ; cùng ID nhưng payload khác trả conflict. Double click và retry mạng không tạo nhiều lệnh.
- Timeout/mất kết nối sau gửi: `UNKNOWN`, ưu tiên tra trạng thái lệnh/read-back trước khi gửi lại. Đọc thấy target chỉ chứng minh giá trị quan sát đã khớp, không tự chứng minh request trước hoàn tất nếu đối tác còn xử lý ngầm.
- Chặn job mới cùng SKU/kho khi lệnh cũ còn UNKNOWN. Lease hết hạn không tự cho phép gửi chồng; worker phục hồi phải xác minh lần gửi trước.
- Backoff có giới hạn, tôn trọng rate-limit/Retry-After. Lỗi validation/quyền/mapping không retry tự động.
- Retry giữ target cũ chỉ khi source revision vẫn hợp lệ và lệnh trước đã xác định an toàn; nguồn mới yêu cầu một lựa chọn/attempt mới, không sửa payload của idempotency key cũ.
- Idempotency nội bộ không đủ bảo đảm exactly-once ở đối tác vì payload quản trị không có request/idempotency key. Khi timeout phải đọc lại trước; không retry batch nhập/xuất mù.
- Snapshot và claim mới phải commit trước thao tác mạng; kết quả mạng không thể atomic với DB. Có recovery cho crash sau partner success nhưng trước ghi kết quả, và outbox audit để không mất lịch sử.
- Tính năng bảo đảm đối chiếu tại thời điểm/revision đã xác minh. Hai bên có thể lệch tiếp khi phát sinh giao dịch mới; không cam kết luôn bằng nhau sau một lần bấm.

## 9. Mô hình dữ liệu đề xuất

Thêm file shared types riêng `packages/shared-types/src/partnerInventorySync.ts`, export qua `index.ts`. Không thay ý nghĩa `Inventory` hiện có.

| Collection đề xuất | Nội dung |
| --- | --- |
| `partner_inventory_connections` | account scope, config owner reference, capability và trạng thái; không chứa secret public |
| `partner_warehouse_mappings` | mapping một-một, version, connection/config owner, warehouse_id, stockId |
| `partner_category_mappings` | category_id + connection_id → typeId, version |
| `partner_mapping_claims` | claim unique phía server cho mapping kho |
| `partner_inventory_snapshots` + items | snapshot theo kho, fetched_at, completeness, schema version, số lượng/đối ứng |
| `partner_inventory_sync_jobs` + items | actor, nguồn/đích, lựa chọn, target, source revision, lỗi, kết quả và timestamps |
| `partner_inventory_sync_claims` | khóa cùng SKU/kho và trạng thái send intent đang xử lý/chưa rõ |
| `partner_inventory_sync_outbox` | dispatch/recovery/audit cần thực hiện; trạng thái bền vững |

Tất cả dữ liệu xem từ UI có `warehouse_id`/scope phù hợp; danh mục public của kết nối chỉ được đọc khi có quyền mapping liên quan. Claim/outbox/credential không cho client ghi/đọc tự do.

Job states: `PREPARING`, `QUEUED`, `RUNNING`, `COMPLETED`, `PARTIAL`, `FAILED`, `NEEDS_ATTENTION`. Item states: `PENDING`, `SENDING`, `VERIFYING`, `VERIFIED`, `STALE`, `FAILED`, `UNKNOWN`, `BLOCKED`, `ALREADY_MATCHED`. Mỗi trạng thái có transition rõ, giữ attempt history.

Metadata: `request_id`, `user_id`, `action_time` (client bấm), `sync_time` (server nhận), `sent_at`, `verified_at`, `source_revision`, `mapping_version`, `old_value`, `new_value`, `is_deleted`. Log lỗi rút gọn không chứa secret/sign/body nhạy cảm.

## 10. API nội bộ và phân quyền đề xuất

Các route sau là thiết kế mới của JPULSE, không phải endpoint phía Trung Quốc:

| Route | Chức năng |
| --- | --- |
| `GET /api/partner-inventory/connections` | Danh sách kết nối người dùng được phép sử dụng |
| `GET /api/partner-inventory/connections/:id/warehouses` | Danh sách kho đối tác |
| `GET /api/partner-inventory/connections/:id/gift-types` | Danh sách nhóm đối tác |
| `PUT /api/partner-inventory/warehouses/:id/mapping` | Lưu mapping kho bằng ID đã chọn |
| `PUT /api/partner-inventory/categories/:id/mappings/:connectionId` | Lưu mapping danh mục |
| `POST /api/partner-inventory/warehouses/:id/comparisons` | Tự khởi tạo snapshot đối chiếu khi mở modal |
| `POST /api/partner-inventory/warehouses/:id/sync-jobs` | Nhận lựa chọn và tạo job, trả 202 + job ID |
| `GET /api/partner-inventory/warehouses/:id/sync-jobs/:jobId` | Tra kết quả/khôi phục UI |
| `POST /api/partner-inventory/warehouses/:id/sync-jobs/:jobId/retry` | Retry các item đủ điều kiện sau đối soát |

Quyền mới dự kiến: `partner_inventory.read`, `partner_inventory.mapping.write`, `partner_inventory.sync`, giới hạn cơ sở. Mapping danh mục cần thêm quyền sửa danh mục và quyền trên kết nối được chọn. Chỉnh API credential vẫn giữ quyền cấu hình hệ thống hiện hành.

Worker endpoint dùng service identity/JWT xác minh audience và quyền gọi worker; job phải do người có quyền tạo và recheck quyền trước gửi. Không lấy actor từ body để bỏ qua middleware. Mọi route có Zod, messages vi/zh; áp middleware bảo mật/rate-limit hiện có. Firestore rules bảo vệ cả listener snapshot/job; cập nhật permission registry và access matrix tests.

## 11. Các giai đoạn triển khai và task list

### Giai đoạn 0 — Hợp đồng tích hợp và nền tảng

- [x] Đọc quy tắc, shared types và điểm tích hợp kho/danh mục/OpenAPI.
- [x] Chốt 5 quyết định nghiệp vụ với người dùng.
- [x] Hoàn thành chiến lược mapping, modal, nguồn ATP, job/retry và nghiệm thu.
- [x] Xác minh API quản trị danh sách kho liên quan `goodsstockbase`.
- [x] Xác định method và payload frontend của API quản trị nhập/xuất kho.
- [x] Xác minh danh sách kho/nhóm/tồn tại kết nối shop 20692 và đối chiếu dữ liệu đọc.
- [ ] Được đối tác xác nhận quyền dùng API quản trị và chốt nghĩa `amount`, giá vốn, hạn dùng, loại chứng từ, số lẻ, rate limit và timeout.
- [ ] Kiểm thử mutation hợp lệ có kiểm soát trên kho/SKU test, gồm nhập, xuất và read-back; chưa thực hiện trên dữ liệu thật.
- [ ] Chốt fixture và capability flags đọc/ghi. API chưa được xác nhận là dependency, không dùng action suy đoán.

### Giai đoạn 1 — Schema, quyền và mapping

- [x] Shared types/Zod, collection/rules, unique mapping claim, sync lease và audit.
- [ ] Connection identity/config owner; kiểm tra cấu hình trùng account trước migration.
- [ ] Migration additive, không tự mapping bằng tên; dữ liệu cũ ở trạng thái chưa mapping.
- [x] Adapter đọc kho/gift_type; backend mapping controller/service/repository.
- [x] Picker kho tại WarehouseFormModal và picker nhóm theo kết nối tại CategoryFormModal.
- [ ] Test mapping trùng, tenant scope, version, soft delete, mất quyền.

### Giai đoạn 2 — Đối chiếu và modal

- [x] Backend aggregate ATP đúng kho/vị trí; join exact SKU; snapshot và row eligibility.
- [x] `PartnerInventorySyncModal`, desktop table/mobile card, footer và status components.
- [x] Hook snapshot thủ công/job và API client riêng; logic aggregation tách khỏi TSX.
- [x] Nút mở modal tại WarehouseDetailHero và trang `(dashboard)/warehouses/[id]/page.tsx`.
- [ ] Chọn một/nhiều/tất cả theo bộ lọc; xử lý pagination, nguồn đổi, ATP 0, thiếu SKU.
- [ ] Nút làm mới thủ công, offline cache, skeleton, lỗi vi/zh; không polling; chỉ đọc khi write capability chưa sẵn sàng.

### Giai đoạn 3 — Gửi tồn và phục hồi tác vụ

- [ ] Job/manifest/items/idempotency/outbox, worker Cloud Tasks và local worker cho dev.
- [ ] Kiểm lại quyền, source revision, mapping, claim trước gửi.
- [ ] Adapter tăng/giảm tồn theo contract quản trị, read-back và UNKNOWN recovery; không retry mutation mù.
- [ ] Lịch sử theo kho và từng dòng; đóng/mở modal không mất tiến độ.
- [ ] Atomic audit nội bộ/send intent, phục hồi sau crash, không gọi partner trong transaction.
- [x] Cấu hình env/feature flag, batch limit, snapshot TTL và read-back recovery; không tạo lịch định kỳ hoặc polling.

### Giai đoạn 4 — Kiểm thử và triển khai có kiểm soát

- [x] Unit test phép cộng ATP, row eligibility, idempotency và trạng thái UNKNOWN.
- [x] Firestore Rules emulator test phạm vi đọc và backend-only writes cho mapping/snapshot/job/claim/lock. Test transaction race và audit tích hợp vẫn cần bổ sung trước rollout production.
- [ ] Contract test fixture đã xác minh và sandbox end-to-end với đối tác.
- [ ] UI desktop/mobile: checkbox, focus, skeleton, vi/zh, làm mới thủ công, offline và job resume.
- [x] Chạy lint/typecheck/test phù hợp shared-types, backend, frontend và Firestore Rules emulator.
- [ ] Mở chế độ đối chiếu trước tại một kho; đối chiếu số liệu thực tế với người vận hành.
- [ ] Sau khi API ghi nghiệm thu, mở gửi thật trên vài SKU của một kho rồi tăng dần.
- [ ] Theo dõi tỷ lệ lỗi, UNKNOWN, độ trễ xác minh, job kẹt và số dòng lệch sau gửi.

Không đặt thời hạn triển khai ghi thật khi chưa có hợp đồng API. Giai đoạn 1–2 có thể phát triển bằng fixture; nghiệm thu production phụ thuộc xác minh API đọc. Giai đoạn 3 ghi thật phụ thuộc hợp đồng ghi. Bản kế hoạch này không tự tạo lịch automation, deploy, migration hoặc lệnh gọi ghi đối tác.

## 12. Ma trận nghiệm thu tối thiểu

| Tình huống | Kết quả bắt buộc |
| --- | --- |
| Hai vị trí ATP 10 và 15; các bucket khác khác 0 | Target = 25, không gồm bucket khác |
| ATP 0, đối tác 8, SKU có đối ứng | Gửi đúng 0 và đọc lại xác minh |
| API lỗi/thiếu trang/không trả SKU | Không biến thành 0; hiển thị lỗi/thiếu và chặn |
| SKU `0001` và `1` | Không ghép chung |
| Một account có hai kho cùng tên | Dữ liệu/mapping theo stockId, không tên |
| Hai người mapping cùng stockId | Chỉ một mapping được lưu |
| Chọn tất cả qua nhiều trang | Gửi đúng tập đủ điều kiện được ghi rõ trong UI |
| ATP/mapping thay đổi sau preview | Dòng stale không gửi target cũ |
| ATP đổi sau partner success | Giữ audit target cũ, hiển thị cần đồng bộ tiếp |
| Double click/two tabs/Cloud Tasks redelivery | Không tạo lệnh ghi chồng |
| Timeout rồi đối tác vẫn đang xử lý | UNKNOWN, chặn lệnh mới cùng SKU, recovery trước retry |
| 8 dòng thành công, 2 lỗi | Báo 8/10 và lỗi cụ thể; không gửi lại 8 dòng mù quáng |
| Đóng modal/mất mạng sau nhận job | Worker tiếp tục, mở lại nhận kết quả |
| Offline trước khi gửi | Xem cache; không tự chạy lệnh cũ khi online |
| Người dùng không có quyền hoặc bị thu hồi | UI và backend/worker đều chặn theo scope |
| Đồng bộ bất kỳ kết quả nào | Không sửa ATP/Inventory JPULSE từ số liệu đối tác |
| Tắt feature flag ghi | Chặn send mới và pending chưa gửi, tiếp tục xác minh lệnh đã gửi |

Khi cần dừng triển khai: tắt ghi qua feature flag, giữ đối chiếu và lịch sử; không xóa dữ liệu/mapping và không tự đảo các thay đổi đã gửi sang đối tác.

## 13. Tài liệu và mã nguồn tham chiếu

- `.agent/rules/rules.md`, `AGENTS.md`.
- `docs/joyworld-manager-browser-contracts-20692.md`: contract API quản trị được khảo sát trực tiếp qua bốn màn hình.
- `海外-鲸舰-OpenApi_EN.md`: Access Guide dòng 69; Signature rules 103; gift_type 12574; gift_realtime_stock 12667.
- `packages/shared-types/src/{master-data,inventory,system,permissionRegistry}.ts`.
- `apps/be-wms/src/services/{openApiConfigService,openApiService,auditService,marketingVoucherTaskDispatcher,invoiceTaskDispatcher,jposProductSyncClient}.ts`.
- `apps/be-wms/src/api/routes/{warehouseRoutes,categoryRoutes,systemConfigRoutes}.ts`.
- `apps/fe-wms/src/hooks/{useInventory,useInventoryByWarehouse}.ts`.
- `apps/fe-wms/src/components/warehouses/{WarehouseDetailHero,WarehouseFormModal}.tsx`.
- `apps/fe-wms/src/components/categories/CategoryFormModal.tsx`.
