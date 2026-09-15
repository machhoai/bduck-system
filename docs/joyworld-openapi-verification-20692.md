# Báo cáo khảo sát và kiểm thử API JoyWorld/OpenAPI — cửa hàng 20692

Ngày kiểm thử: 2026-09-15

Cửa hàng xác thực: `20692 — B.Duck Cityfuns-Landmark 81店`

## 1. Phạm vi và cách xác thực

Hệ thống đối tác có hai lớp API khác nhau:

1. **OpenAPI chính thức dành cho tích hợp**
   - Endpoint chung: `POST /openapi/action`
   - Xác thực bằng `appId`, `secretKey`, `action`, `version`, `timestamp`, `body` và chữ ký MD5 viết hoa.
   - Cấu hình đang được lưu mã hóa trong collection `openapi_warehouse_configs` của dự án; biến môi trường chỉ chứa khóa giải mã. Không có bí mật nào được in ra trong quá trình kiểm thử.

2. **API nội bộ của giao diện quản trị JoyWorld**
   - Các endpoint dạng `/gift/manager/...` và `/setmeal/manager/...`.
   - Xác thực bằng tài khoản/mật khẩu để lấy Bearer token.
   - Đây là API được frontend JoyWorld gọi, không phải hợp đồng OpenAPI được công bố trong tài liệu. Không nên coi là API tích hợp ổn định nếu chưa được đối tác xác nhận hỗ trợ.

## 2. Ma trận API theo nhu cầu

| Nhu cầu | API chính thức trong tài liệu | Trạng thái tài liệu | Kết quả kiểm thử | Kết luận |
| --- | --- | --- | --- | --- |
| Danh sách cửa hàng | `basic_shop_list` | Completed | Thành công; trả đúng duy nhất shop `20692` | Dùng để xác nhận kết nối/shop, không phải danh sách kho |
| Danh sách kho | Không có action OpenAPI riêng | — | API quản trị `GET /gift/manager/stockbase/getlist` thành công, trả 4 kho | Cần đối tác công bố API kho chính thức hoặc chấp thuận dùng API quản trị |
| Danh sách nhóm hàng `gift_type` | `gift_type` | Completed | Thành công; 2 nhóm | Phù hợp để mapping danh mục một-một theo từng kết nối |
| Hàng hóa và tồn kho theo kho | `gift_realtime_stock` | Completed | Thành công; 228 dòng khi `isFilterZero=false` | Phù hợp để đọc số đối chiếu; JPULSE vẫn là nguồn chính |
| Danh sách hàng hóa vật lý độc lập với tồn kho | Không có action OpenAPI riêng | — | API quản trị `GET /gift/manager/base/list` thành công; 82 hàng hóa | OpenAPI chỉ có thể lấy danh sách hàng xuất hiện trong dữ liệu tồn kho |
| Danh sách sản phẩm/gói bán | `setmeal_getsellgoods` | In Progress | Thành công: category `1` có 7 gói, category `4` có 5 vé | Có thể đọc, nhưng hợp đồng chưa được đánh dấu ổn định |
| Danh sách vé chi tiết | `setmeal_passticket_list` | In Progress | Thành công; 5 vé đếm lượt | Có thể đọc với version `11.7.1` |
| Chi tiết vé | `setmeal_passticket_details` | In Progress | Thành công với version `11.7.1` | Cấu hình version hiện tại của dự án còn thiếu action này |
| Danh sách nhóm vé/gói | `setmeal_type_select` | In Progress | Thành công với version `11.7.1`; 8 nhóm | Cấu hình version hiện tại của dự án còn thiếu action này |
| Nhập kho | Không có action OpenAPI | — | API quản trị có `POST /gift/manager/stockvalue/batch/gift/add` và `POST /gift/manager/stockorder/add/gift`; payload rỗng bị chặn đúng | Không đủ điều kiện triển khai đồng bộ chính thức qua OpenAPI |
| Xuất kho | Không có action OpenAPI | — | API quản trị có `POST /gift/manager/stockvalue/batch/gift/out` và `POST /gift/manager/stockorder/out/gift`; payload rỗng bị chặn đúng | Không đủ điều kiện triển khai đồng bộ chính thức qua OpenAPI |
| Tạo hàng hóa vật lý | Không có action OpenAPI phù hợp | — | API quản trị có `POST /gift/manager/base/add` nhưng server chấp nhận payload rỗng | Không an toàn để dùng nếu chưa có validation chặt ở JPULSE và cam kết hỗ trợ từ đối tác |
| Tạo vé | `setmeal_passticket_create` | In Progress | Đã xác định hợp đồng/version; chưa chạy payload hợp lệ trên shop thật | Có thể là ứng viên sau khi kiểm thử mutation có kiểm soát |
| Tạo gói thành viên/category 1 | Không có action create được tài liệu hóa | — | API quản trị có `POST /setmeal/manager/coin/add` | Chưa có OpenAPI chính thức đáp ứng |
| Cập nhật vé | `setmeal_passticket_update` | In Progress | Đã xác định hợp đồng/version; chưa cập nhật dữ liệu shop thật | Có thể là ứng viên sau khi kiểm thử mutation có kiểm soát |
| Cập nhật hàng hóa vật lý | Không có action OpenAPI | — | API quản trị có `POST /gift/manager/base/update`; payload rỗng bị từ chối đúng | Chưa có OpenAPI chính thức đáp ứng |
| Cập nhật gói thành viên/category 1 | Không có action OpenAPI được tài liệu hóa | — | API quản trị có `POST /setmeal/manager/coin/update` | Chưa có OpenAPI chính thức đáp ứng |
| Báo cáo phân tích tồn kho | `report_stock_analysis` | Completed | Thất bại: hệ thống báo không tìm thấy action/version | Không dùng cho luồng đồng bộ |

## 3. Endpoint và dữ liệu quan trọng

### 3.1 Danh sách kho qua API quản trị

`GET /gift/manager/stockbase/getlist`

Kết quả hiện tại:

| `stockId` | Tên kho |
| --- | --- |
| `08de19d6-313d-4482-8e15-6f5635db2c4e` | Kho mặc định |
| `08de19d6-33af-4f0b-8dd6-e079a3db9421` | Kho tiền thật |
| `08de19d6-33b4-4207-8ce8-d9b1f13e0a08` | Kho vé hiện vật |
| `7c689b7b-022c-4e50-b441-b83eb941b614` | Kho Landmark 81 |

API phân trang đầy đủ: `GET /gift/manager/stockbase/list?page=1&limit=20`.

### 3.2 Nhóm hàng hóa

OpenAPI action: `gift_type`, version `10.11.8`, body `{}`.

Kết quả:

| `typeId` | `typeName` |
| --- | --- |
| `4141acbd-5bbc-4d25-a5d6-6c6ab7ffc122` | HÀNG TẶNG |
| `5c70d40d-6bc6-44f2-bacc-f3ea980f3183` | HÀNG BÁN |

Kết quả này khớp hoàn toàn với `GET /gift/manager/type/getlist`.

### 3.3 Tồn kho hàng hóa

OpenAPI action: `gift_realtime_stock`, version `10.11.8`.

Body phục vụ màn hình đối chiếu:

```json
{
  "stockId": "<mã kho đã mapping>",
  "isFilterZero": false
}
```

Có thể lọc thêm `typeId`, `giftName`, `giftNo`.

Phản hồi thực tế có thêm `stockId` và `giftId`, dù bảng response trong tài liệu không liệt kê hai trường này. Đây là hai khóa cần lưu để đối chiếu ổn định; mã nghiệp vụ dùng để mapping sản phẩm vẫn là `giftNo` theo yêu cầu.

Đối chiếu toàn bộ dữ liệu với API quản trị `GET /gift/manager/stockvalue/list?isFilterZero=false`:

- OpenAPI: 228 dòng.
- API quản trị: 228 dòng.
- Thiếu ở OpenAPI: 0.
- Thiếu ở API quản trị: 0.
- Sai lệch `amount` theo `giftId + stockId`: 0.

### 3.4 Danh sách sản phẩm/vé/gói

OpenAPI action `setmeal_getsellgoods`, version `11.7.1`:

```json
{ "Category": "1" }
```

trả 7 gói category 1; và:

```json
{ "Category": "4" }
```

trả 5 vé category 4.

Các trường chính: `goodsId`, `goodsName`, `category`, `subCategory`, `price`, `underlinePrice`, `badge`, `imgUrl`, `isOpenRemark`, `remark`.

OpenAPI action `setmeal_passticket_list`, version `11.7.1`, cung cấp dữ liệu vé đầy đủ hơn:

```json
{
  "category": 4,
  "subCategory": 1,
  "page": 1,
  "limit": 20
}
```

Chi tiết một vé dùng `setmeal_passticket_details`, version `11.7.1`, body:

```json
{ "setmealId": "<setMealId>" }
```

## 4. Điểm không phù hợp hoặc cần xử lý trước khi phát triển

### 4.1 Không có OpenAPI danh sách kho

Không nên suy danh sách kho bằng cách lấy unique `stockId/stockName` từ `gift_realtime_stock`:

- Danh mục kho hiện tại có 4 kho.
- Dữ liệu tồn kho chỉ xuất hiện 3 kho.
- Dữ liệu tồn kho còn chứa kho cũ `Kho LM81` (`55d92708-7be9-4dc8-9cd1-ff7055255698`) không còn trong danh mục kho.
- Hai kho hiện tại không có dòng tồn kho nên không xuất hiện khi suy từ inventory.

Vì vậy mapping kho phải dùng `stockbase/getlist` hoặc một OpenAPI danh mục kho mới do đối tác cung cấp.

### 4.2 Không có OpenAPI ghi tồn kho

Tài liệu không công bố action nhập kho, xuất kho hoặc đặt tồn kho tuyệt đối. Các endpoint ghi tìm được đều là API nội bộ của màn hình quản trị. Đây là blocker chính đối với luồng đồng bộ một chiều JPULSE → Trung Quốc.

Đồng bộ ATP yêu cầu chuyển chênh lệch thành nghiệp vụ:

- `delta = ATP_JPULSE - amount_China`.
- `delta > 0`: nhập kho `delta`.
- `delta < 0`: xuất kho `abs(delta)`.

Phải khóa/kiểm tra lại tồn Trung Quốc ngay trước khi gửi để tránh race condition. Nếu đối tác có API “set absolute stock” thì nên ưu tiên API đó hơn nhập/xuất chênh lệch.

### 4.3 API tạo hàng hóa quản trị thiếu validation

`POST /gift/manager/base/add` với `{}` đã trả thành công và tạo một hàng hóa trống. Bản ghi thử nghiệm đã được xác định duy nhất, xóa ngay bằng ID, và kiểm tra tổng số hàng hóa trở lại 82. Điều này chứng minh phía JPULSE phải validate tối thiểu `giftNo`, `giftName`, `typeId`, đơn vị, giá và tính duy nhất trước khi gửi.

### 4.4 Sai/missing action version trong cấu hình dự án

`setmeal_passticket_details` và `setmeal_type_select` thất bại khi đi qua action-version mặc định `10.11.8`, nhưng thành công khi gọi đúng `11.7.1`. Cần bổ sung tối thiểu các action sau vào default/action mapping:

- `setmeal_passticket_create`: `11.7.1`
- `setmeal_passticket_update`: `11.7.1`
- `setmeal_passticket_delete`: `11.7.1`
- `setmeal_passticket_details`: `11.7.1`
- `setmeal_type_add`: `11.7.1`
- `setmeal_type_select`: `11.7.1`

### 4.5 `oversea_goods_create` không phải hàng hóa kho

Action `oversea_goods_create` thuộc nhóm **Reservation Package – add-on products**, không phải master hàng hóa vật lý của module kho/gift. Không dùng action này để tạo sản phẩm cần đồng bộ tồn kho.

### 4.6 Rủi ro bảo mật giao vận

Base URL cấu hình hiện tại dùng HTTP thay vì HTTPS. Đặc biệt API quản trị gửi thông tin đăng nhập để lấy token; không nên vận hành tích hợp qua HTTP trên mạng không tin cậy. Cần yêu cầu endpoint HTTPS trước khi đưa vào production.

## 5. Kết luận triển khai

Có thể triển khai ngay phần đọc/đối chiếu:

1. Lấy danh mục kho qua API quản trị đã xác minh hoặc API chính thức mới do đối tác cung cấp.
2. Mapping `stockId` vào từng kết nối/kho JPULSE bằng dropdown, không cho nhập tự do.
3. Mapping danh mục JPULSE với `gift_type.typeId` bằng dropdown.
4. Đọc `gift_realtime_stock` theo kho, đối chiếu theo `giftNo`, hiển thị ATP JPULSE và `amount` Trung Quốc.
5. Chặn dòng không có đối ứng hoặc trùng mã.

Chưa nên triển khai phần ghi production cho đến khi có ít nhất một trong hai điều kiện:

- Đối tác bổ sung/xác nhận chính thức OpenAPI nhập/xuất hoặc đặt tồn tuyệt đối; hoặc
- Đối tác cam kết API quản trị `/gift/manager/...` là hợp đồng tích hợp được hỗ trợ lâu dài, cung cấp schema, idempotency và quy tắc nghiệp vụ.

Kiểm thử mutation hợp lệ (tạo/cập nhật vé, tạo hàng hóa, nhập +1 rồi xuất -1) chưa được thực hiện vì đây là shop thật và sẽ tạo chứng từ/audit thực. Cần một sản phẩm test, kho test và xác nhận rõ trước khi chạy.
