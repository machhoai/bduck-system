# Khảo sát API quản trị JoyWorld qua trình duyệt — cửa hàng 20692

Ngày khảo sát: 2026-09-15

Cửa hàng: `20692 — B.Duck Cityfuns-Landmark 81店`

## 1. Phạm vi và nguyên tắc kiểm tra

Các contract dưới đây được xác định bằng cách đăng nhập trang quản trị, mở danh sách/form chi tiết trên bốn route do người dùng cung cấp và đọc các request cùng bundle JavaScript mà chính giao diện tải:

- `/background/coinsetmealsetting`
- `/background/countTicketSetMealSetting`
- `/background/giftbasesetting`
- `/background/goodsstockvalue`

Chỉ thực hiện thao tác đọc và mở form. Không bấm `Lưu`, không tạo/cập nhật hàng hóa, gói, vé hoặc chứng từ nhập/xuất kho trên cửa hàng thật. Các endpoint đọc bên dưới đã trả HTTP 200 và `success: true` trong phiên xác thực ngày khảo sát.

Đây là **API nội bộ của trang quản trị**, dùng Bearer token lấy từ tài khoản/mật khẩu. Nó không phải OpenAPI `/openapi/action`, không dùng `appId/secretKey`, và chưa có cam kết tương thích hoặc hỗ trợ tích hợp từ đối tác.

### Xác thực của trang quản trị

```http
POST /basic/manager/login/account
Content-Type: application/json
```

```json
{
  "userName": "<manager account>",
  "password": "<manager password>"
}
```

Response đăng nhập có envelope chung; `data.token` được gửi ở các request sau bằng `Authorization: Bearer <token>`. Phiên trình duyệt cũng gọi `/basic/account/refresh/token` để làm mới token. JPULSE phải thực hiện xác thực này ở backend, mã hóa credential tại nơi lưu và tuyệt đối không trả token về frontend.

### Ánh xạ route màn hình với API chính

| Route quản trị | API danh sách | API chi tiết | API ghi |
| --- | --- | --- | --- |
| `/background/coinsetmealsetting` | `/setmeal/manager/coin/list` | `/setmeal/manager/coin/details` | `/setmeal/manager/coin/add`, `/coin/update` |
| `/background/countTicketSetMealSetting` | `/setmeal/manager/passticket/list` | `/setmeal/manager/passticket/details` | `/passticket/add`, `/passticket/update` |
| `/background/giftbasesetting` | `/gift/manager/base/list` | `/gift/manager/base/details` | `/base/add`, `/base/update` |
| `/background/goodsstockvalue` | `/gift/manager/stockvalue/list` | Dữ liệu dòng nằm ngay trong list | `/stockvalue/batch/gift/add`, `/stockvalue/batch/gift/out` |

## 2. API đọc đã xác minh

| Chức năng | Method và endpoint | Kết quả tại shop 20692 |
| --- | --- | --- |
| Danh sách kho để mapping | `GET /gift/manager/stockbase/getlist` | Thành công; mảng `{ key: stockId, value: stockName }` |
| Danh sách nhóm hàng hóa | `GET /gift/manager/type/getlist` | Thành công; mảng `{ key: typeId, value: typeName }` |
| Danh sách hàng hóa | `GET /gift/manager/base/list?page=1&limit=20` | Thành công; tổng 82 |
| Chi tiết hàng hóa | `GET /gift/manager/base/details?id={giftId}` | Thành công |
| Tồn theo hàng hóa–kho | `GET /gift/manager/stockvalue/list?isFilterZero=false&page=1&limit=20` | Thành công; tổng 228 dòng |
| Danh sách gói thành viên | `GET /setmeal/manager/coin/list?category=1&page=1&limit=20` | Thành công; tổng 7 |
| Chi tiết gói thành viên | `GET /setmeal/manager/coin/details?setmealId={setMealId}` | Thành công |
| Danh sách vé đếm lượt | `GET /setmeal/manager/passticket/list?category=4&subCategory=1&page=1&limit=20` | Thành công; tổng 5 |
| Chi tiết vé | `GET /setmeal/manager/passticket/details?setmealId={setMealId}` | Thành công |
| Nhóm gói/vé | `GET /setmeal/manager/setmealtype/getselect` | Thành công |
| Loại nhập kho | `GET /gift/manager/stockorder/subcategory/keyvalue?categoryContent=1` | Route hoạt động nhưng dữ liệu hiện tại rỗng |
| Loại xuất kho | `GET /gift/manager/stockorder/subcategory/keyvalue?categoryContent=2` | Route hoạt động nhưng dữ liệu hiện tại rỗng |

Response chung của các API quản trị:

```json
{
  "success": true,
  "msg": "",
  "code": 0,
  "data": {},
  "desc": ""
}
```

API phân trang bổ sung `pageSize`, `pageIndex`, `totals`; API tồn kho còn có `footData` và `isAsyncFoot`.

### Trường cần dùng để đối chiếu tồn

Mỗi dòng của `stockvalue/list` có các trường chính:

```json
{
  "id": "<stock-value-id>",
  "stockId": "<warehouse-id>",
  "stockName": "<warehouse-name>",
  "giftId": "<gift-master-id>",
  "giftNo": "<business-sku>",
  "giftName": "<name>",
  "amount": 0,
  "giftPrice": 0,
  "totalMoney": 0,
  "safeAmount": 0,
  "isEnabled": true,
  "updateTime": "yyyy-MM-dd HH:mm:ss"
}
```

JPULSE vẫn ghép chính xác `Product.code === giftNo`. Sau khi ghép, phải giữ thêm `giftId` vì API nhập/xuất sử dụng ID nội bộ này trong payload.

## 3. Contract nhập và xuất kho của giao diện

### 3.1 Chọn hàng hóa cho phiếu

Giao diện gọi bằng `POST`:

- Nhập kho: `/gift/manager/base/getgiftforaddstock`
- Xuất kho: `/gift/manager/base/getgiftforoutstock`

Payload tìm kiếm:

```json
{
  "giftTypeId": null,
  "giftNo": "",
  "giftName": "",
  "barCode": "",
  "supplierId": "",
  "stockId": "<stockId khi chọn hàng xuất hoặc lọc theo kho>",
  "noGiftIds": [],
  "sortField": "",
  "sortType": "",
  "page": 1,
  "limit": 20
}
```

Các giá trị chuỗi rỗng bị frontend loại khỏi request trước khi gửi.

### 3.2 Nhập kho theo lô

`POST /gift/manager/stockvalue/batch/gift/add`

Payload do form quản trị tạo:

```json
{
  "stockId": "<kho thao tác>",
  "stockName": "<tên kho>",
  "remark": "JPULSE inventory sync ...",
  "inType": "<mã loại nhập, có thể bỏ nếu không chọn>",
  "supplierId": null,
  "orderItems": [
    {
      "stockId": "<kho thao tác; frontend bắt buộc trên từng dòng>",
      "giftId": "<ID hàng hóa JoyWorld>",
      "giftNo": "<SKU>",
      "giftName": "<tên hàng>",
      "amount": 10,
      "giftPrice": 0,
      "money": "0.00",
      "remark": "",
      "isOpenExpire": false,
      "giftDate": null
    }
  ]
}
```

Nếu hàng hóa bật quản lý hạn dùng, frontend chặn gửi khi thiếu `giftDate`. Nếu đi từ chứng từ nháp, frontend còn thêm `orderId` và dùng `/gift/manager/stockorder/add/gift`.

### 3.3 Xuất kho theo lô

`POST /gift/manager/stockvalue/batch/gift/out`

```json
{
  "stockId": "<kho thao tác>",
  "stockName": "<tên kho>",
  "remark": "JPULSE inventory sync ...",
  "outType": "<mã loại xuất, có thể bỏ nếu không chọn>",
  "orderItems": [
    {
      "stockId": "<kho thao tác; frontend bắt buộc trên từng dòng>",
      "giftId": "<ID hàng hóa JoyWorld>",
      "giftNo": "<SKU>",
      "giftName": "<tên hàng>",
      "stockValue": 100,
      "amount": 8,
      "giftPrice": 0,
      "money": "0.00",
      "remark": ""
    }
  ]
}
```

Nếu đi từ chứng từ nháp, frontend thêm `orderId` và dùng `/gift/manager/stockorder/out/gift`.

Frontend chỉ kiểm `response.success`; không sử dụng ID chứng từ trả về. Vì không phát sinh chứng từ thật trong lần khảo sát, success response của hai endpoint ghi chưa được thu trực tiếp. Theo client chung, envelope dự kiến vẫn là `{ success, msg, code, data, desc }`.

## 4. Contract tạo/cập nhật master data

### Hàng hóa vật lý

- `POST /gift/manager/base/add`
- `POST /gift/manager/base/update`
- `GET /gift/manager/base/details?id={id}`

Hai endpoint add/update dùng cùng payload; update có `id`. Trường chính:

```json
{
  "id": "<chỉ khi update>",
  "typeId": "<gift type id>",
  "giftName": "Tên hàng hóa",
  "giftNo": "SKU",
  "price": 0,
  "memberPrice": null,
  "giftPrice": 0,
  "underlinePrice": 0,
  "supplierIds": [],
  "unitId": null,
  "barCode": "",
  "manufactorBarCode": "",
  "brandId": null,
  "isOpenSales": true,
  "isOpenExchange": false,
  "isOpenRecovery": false,
  "isOpenAuthorize": false,
  "isOpenRemark": false,
  "remark": "",
  "isOpenExpire": false,
  "expireAmount": 0,
  "expireMode": 0,
  "warningDay": 0,
  "saleWarningDay": 0,
  "taxRate": 0,
  "banners": [],
  "exchangeSetts": [],
  "recoverySetts": []
}
```

### Gói thành viên/category 1

- `POST /setmeal/manager/coin/add`
- `POST /setmeal/manager/coin/update`
- `GET /setmeal/manager/coin/details?setmealId={setMealId}`

Add/update dùng cùng model; `setMealId` chỉ có khi update. Payload do frontend gửi có dạng:

```json
{
  "setMealId": "<chỉ khi update>",
  "setMealName": "Tên gói",
  "typeId": "<set-meal-type-id>",
  "price": 0,
  "underlinePrice": 0,
  "amount": 0,
  "remark": "",
  "sortIndex": 0,
  "effectiveMode": 1,
  "enableDays": 0,
  "conditionJson": "{}",
  "giveConfigs": [],
  "exchangeSetts": [],
  "applyScenes": [],
  "setApplyScenes": [],
  "isOpenSales": true,
  "isOpenExchange": false,
  "isOpenAuthorize": false,
  "isOpenRemark": false,
  "isEnabled": true,
  "cancelMode": 1,
  "cancelValue": null,
  "imgUrl": "",
  "foreColor": "",
  "backColor": "",
  "badge": "",
  "methodId": null,
  "numberLimitType": 0,
  "purchaseLimit": 0,
  "discountDesc": "",
  "taxRate": 0,
  "isNoBuyDiscount": false,
  "buyActivity": {}
}
```

Các mảng `giveConfigs`, `exchangeSetts`, `applyScenes` và JSON điều kiện được lấy từ các component con ngay trước khi gửi, không chỉ từ các input tab cơ bản.

### Vé đếm lượt/category 4, subCategory 1

- `POST /setmeal/manager/passticket/add`
- `POST /setmeal/manager/passticket/update`
- `GET /setmeal/manager/passticket/details?setmealId={setMealId}`

Ngoài các trường chung của gói, payload vé có dạng rút gọn sau:

```json
{
  "setMealId": "<chỉ khi update>",
  "passticketId": "<pass-ticket master id>",
  "setMealName": "Tên vé",
  "typeId": "<set-meal-type-id>",
  "category": 4,
  "subCategory": 1,
  "price": 0,
  "underlinePrice": 0,
  "amount": 1,
  "strategyMode": 0,
  "strategyValue": 0,
  "chargingMode": 0,
  "chargingAfterDays": 0,
  "chargingStartTime": null,
  "conditionJson": "{}",
  "useConditionJson": "{}",
  "useRulesJson": "{}",
  "giveConfigs": [],
  "exchangeSetts": [],
  "applyScenes": [],
  "setApplyScenes": [],
  "useMachineCategory": 3,
  "machineKindIds": [],
  "machineTags": [],
  "machineIds": [],
  "numberLimitType": 0,
  "purchaseLimit": 0,
  "maxAccompany": 0,
  "maxNumber": 0,
  "dailyMaxNumber": 0,
  "isLimitUserNumber": false,
  "maxBindRelative": 0,
  "renewalProtectDays": 0,
  "renewalProtectInPrice": 0,
  "renewalProtectOutPrice": 0,
  "taxRate": 0,
  "buyActivity": {}
}
```

Response chi tiết thực tế còn có cấu hình thời gian chơi, tính phí quá giờ, tạm rời khu vực, đặt cọc và giới hạn sử dụng. Khi cập nhật phải giữ nguyên các trường không sửa.

Không nên gửi một payload tối giản tự suy đoán. Cần lấy `details`, merge thay đổi vào model đầy đủ rồi gửi `update`, vì frontend quản lý nhiều JSON lồng nhau và cấu hình áp dụng thiết bị/kênh bán.

## 5. Cách đồng bộ ATP bằng API quản trị

Đồng bộ chỉ được kích hoạt thủ công tại modal của trang chi tiết kho JPULSE. Không có cron, polling nền, webhook ghi hoặc tự đồng bộ trong luồng tạo đơn JPOS.

1. Người dùng mở modal; backend gọi `stockvalue/list` đúng `stockId` đã mapping và lấy snapshot một lần.
2. Modal ghép `Product.code === giftNo`, hiển thị ATP JPULSE, `amount` JoyWorld và chênh lệch.
3. Dòng thiếu đối ứng hoặc trùng mã bị chặn. Người dùng chọn một/nhiều dòng rồi bấm “Đồng bộ”.
4. Backend kiểm quyền, mapping, snapshot TTL và ATP revision; đọc lại đúng các SKU được chọn ngay trong job để tránh dùng số cũ.
5. Backend tách một batch nhập và một batch xuất, gửi API quản trị, sau đó đọc lại để xác minh từng dòng.
6. Chỉ job do người dùng đã bấm mới được tiếp tục chạy nếu modal đóng hoặc mất kết nối; hệ thống không tự tạo job mới.

Với từng dòng đã mapping:

```text
delta = ATP_JPULSE - amount_JoyWorld

delta > 0  => nhập kho amount = delta
delta < 0  => xuất kho amount = abs(delta)
delta = 0  => không gửi
```

Một job chỉ nên tạo tối đa hai batch cho một kho: một batch nhập và một batch xuất. Trước khi gửi phải đọc lại tồn của đúng `stockId + giftId`, tính lại delta và loại các dòng đã thay đổi so với preview.

Sau mỗi batch phải đọc lại `stockvalue/list` và chỉ đánh dấu thành công khi `amount === ATP_JPULSE` trên từng SKU.

## 6. Rủi ro và điều kiện bắt buộc trước production

1. **Không có idempotency key trong payload.** Timeout sau khi server đã ghi có thể khiến retry tạo chứng từ lần hai. Khi kết quả không rõ, bắt buộc đọc lại tồn trước; không retry mù.
2. **Nhập kho ảnh hưởng giá vốn/tổng tiền.** Phải chốt với kế toán và đối tác cách điền `giftPrice`, `money`, supplier và loại nhập. Không mặc định 0 hoặc tự lấy giá bán.
3. **Quản lý hạn dùng.** Hàng có `isOpenExpire=true` cần `giftDate`; nếu JPULSE không có ngày sản xuất phù hợp thì phải chặn dòng.
4. **Xuất kho có thể đụng phát sinh bán hàng đồng thời.** API không cho thấy compare-and-set/version. Cần khóa theo kết nối+kho+SKU phía JPULSE, re-read ngay trước gửi và verify sau gửi; vẫn không bảo đảm atomic với giao dịch JoyWorld.
5. **Bearer token từ tài khoản người dùng.** Cần cơ chế đăng nhập/refresh riêng ở backend, mã hóa credential, không đưa token/password ra frontend hoặc log.
6. **HTTP không mã hóa.** Host hiện được cung cấp bằng `http://`; không nên gửi tài khoản/token production qua mạng không tin cậy. Yêu cầu HTTPS hoặc kênh mạng riêng.
7. **API nội bộ có thể đổi.** Cần đối tác xác nhận đây là contract được phép tích hợp, version/chính sách thay đổi và rate limit.
8. **Loại nhập/xuất hiện rỗng.** Cần xác nhận server chấp nhận bỏ `inType/outType` và nghiệp vụ/audit sẽ phân loại chứng từ thế nào.

## 7. Kết luận

Về kỹ thuật, màn hình quản trị cung cấp đủ primitive để cân tồn một chiều JPULSE → JoyWorld bằng nhập/xuất chênh lệch. Tuy nhiên chưa nên bật gửi thật chỉ dựa trên việc route tồn tại. Blocker không còn là “không có endpoint”, mà là giá vốn, hạn dùng, idempotency, đồng thời và cam kết hỗ trợ API nội bộ.

Có thể triển khai adapter ở chế độ `read/compare` ngay; chức năng `write` phải nằm sau feature flag và chỉ mở khi các điều kiện trong mục 6 được chốt, sau đó kiểm thử mutation có kiểm soát trên SKU/kho test.
