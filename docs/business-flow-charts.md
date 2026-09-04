# Business flow charts của hệ thống BDuck

Tài liệu được tổng hợp từ giao diện `apps/fe-wms`, các route và controller trong `apps/be-wms`, cùng kiểu dữ liệu trong `packages/shared-types`.

Quy ước chung:

- API nội bộ xác thực bằng session cookie, kiểm tra RBAC và phạm vi cơ sở trước khi xử lý.
- API tích hợp ngoài xác thực bằng API key và danh sách kho được cấp quyền.
- Phần lớn API trả envelope `{ success, data, messages }`. Khi lỗi, `data` thường là `null` và `messages` chứa thông báo tiếng Việt, tiếng Trung.
- Các thao tác ghi quan trọng đều kiểm tra dữ liệu đầu vào, cập nhật Firestore theo transaction khi cần và ghi audit log.
- Ký hiệu `id` trong endpoint là định danh bản ghi tương ứng.

## 1. Xác thực, phiên đăng nhập và MFA

```mermaid
flowchart TD
    A["Người dùng nhập, username hoặc email và mật khẩu"] --> B["Frontend gọi, POST /api/auth/login/resolve, Input: identifier"]
    B --> C{"Tìm thấy tài khoản?"}
    C -- "Không" --> D["Trả lỗi xác thực, success false, data null"]
    C -- "Có" --> E["Trả email chuẩn hóa, data: email"]
    E --> F["Frontend đăng nhập Firebase Auth, bằng email và mật khẩu"]
    F --> G{"Thông tin hợp lệ?"}
    G -- "Không" --> D
    G -- "Có" --> H["Firebase trả ID token"]
    H --> I["Frontend gọi, POST /api/auth/sessionLogin, Input: idToken"]
    I --> J["Backend xác minh token, tạo session cookie HttpOnly, tải user, vai trò và access snapshot"]
    J --> K["Trả data, user, roles, access metadata, access grants"]
    K --> L["Frontend cô lập cache theo tài khoản, lưu quyền và khóa màn hình MFA"]
    L --> M["Người dùng nhập OTP"]
    M --> N["POST /api/auth/mfa/verify, Input: token"]
    N --> O{"OTP hợp lệ?"}
    O -- "Không" --> P["Trả lỗi OTP, giữ màn hình khóa"]
    O -- "Có" --> Q["Mở dashboard theo quyền"]
    Q --> R["Lần tải sau gọi, GET /api/auth/session"]
    R --> S["Khôi phục user, roles, access, hoặc trả 401 nếu phiên hết hạn"]
    A --> T["Người dùng quên mật khẩu"]
    T --> U["POST /api/auth/password-reset/request, Input: email"]
    U --> V["Backend gửi email khôi phục, Trả data null và thông báo chung"]
    Q --> W["Người dùng đăng xuất"]
    W --> X["POST /api/auth/logout"]
    X --> Y["Thu hồi session, xóa cookie, Frontend sign out Firebase và xóa cache"]
```

## 2. Dashboard tổng hợp tồn kho và chi phí

```mermaid
flowchart TD
    A["Người dùng mở Dashboard, chọn toàn bộ hoặc một kho"] --> B["Frontend tạo bộ lọc, warehouse_id nếu có"]
    B --> C["GET /api/dashboard/summary, Query: warehouse_id"]
    C --> D["Backend kiểm tra quyền theo cơ sở, xác định danh sách kho được xem"]
    D --> E["Tổng hợp warehouse, inventory, product, movement và stock policy"]
    E --> F["Trả InventoryDashboardSummary, KPI, phân bổ, xu hướng, tồn thấp, xếp hạng và chi tiết theo kho"]
    F --> G["Frontend hiển thị KPI, biểu đồ và bảng cảnh báo"]
    G --> H["Người dùng bấm KPI hoặc đổi bộ lọc"]
    H --> I["Frontend phân rã dữ liệu đã nhận, hoặc tải lại summary theo kho"]
    B --> J{"Có quyền xem chi phí?"}
    J -- "Không" --> G
    J -- "Có" --> K["GET /api/expenses/dashboard/:warehouseId/:period, Input: kho và kỳ"]
    K --> L["Backend tổng hợp ngân sách, thực chi, doanh thu và lợi nhuận"]
    L --> M["Trả KPI chi phí, cost center, xu hướng và cảnh báo ngân sách"]
    M --> G
```

## 3. Tổ chức, kho, vị trí và ô kệ

```mermaid
flowchart TD
    A["Người dùng mở trang Kho hàng"] --> B["Frontend tải dữ liệu nền"]
    B --> C["GET /api/organizations, GET /api/warehouses, GET /api/locations, GET /api/location-slots và /mappings"]
    C --> D["Backend áp dụng quyền cơ sở, lọc bản ghi chưa xóa"]
    D --> E["Trả danh sách Organization, Warehouse, WarehouseLocation, Slot và ProductMapping"]
    E --> F{"Người dùng chọn thao tác"}
    F -- "Tạo hoặc sửa tổ chức" --> G["POST /api/organizations, hoặc PUT /api/organizations/:id, Input: mã, tên, loại, trạng thái, mô tả"]
    F -- "Tạo hoặc sửa kho" --> H["POST /api/warehouses, hoặc PUT /api/warehouses/:id, Input: organization_id, code, name, manager, type, status, address, tọa độ"]
    F -- "Tạo hoặc sửa vị trí" --> I["POST /api/locations, hoặc PUT /api/locations/:id, Input: warehouse_id, code, name, type, status"]
    F -- "Tạo hoặc sửa ô kệ" --> J["POST /api/location-slots, hoặc PUT /api/location-slots/:id, Input: warehouse_id, location_id, code, name"]
    F -- "Gán sản phẩm vào ô kệ" --> K["POST /api/location-slots/mappings, Input: slot_id, product_id và dữ liệu gán"]
    F -- "Xóa" --> L["DELETE /api/organizations/:id, /api/warehouses/:id, /api/locations/:id, /api/location-slots/:id hoặc /mappings/:id"]
    G --> M["Validate mã duy nhất và quan hệ tổ chức"]
    H --> M
    I --> M
    J --> M
    K --> M
    L --> M
    M --> N["Repository cập nhật Firestore, soft delete khi xóa và ghi audit log"]
    N --> O["Trả entity đã cập nhật, hoặc data null với thao tác xóa"]
    O --> P["Frontend làm mới bản đồ, danh sách kho, vị trí và ô kệ"]
    P --> Q["Người dùng mở chi tiết kho"]
    Q --> R["GET /api/inventory?warehouse_id=:id"]
    R --> S["Trả tồn kho theo sản phẩm và vị trí, ATP, tạm giữ, chờ xuất, cách ly, tổng"]
```

## 4. Sản phẩm, danh mục, BOM và chính sách tồn

```mermaid
flowchart TD
    A["Người dùng mở trang Sản phẩm"] --> B["GET /api/products, GET /api/categories, GET /api/stock-policies"]
    B --> C["Backend lọc theo quyền và query, từ khóa, danh mục, loại, nguồn gốc"]
    C --> D["Trả Product, ProductCategory, và InventoryStockPolicy"]
    D --> E{"Người dùng chọn thao tác"}
    E -- "Tạo hoặc sửa sản phẩm" --> F["POST /api/products, hoặc PUT /api/products/:id, Input: category_id, name, sku, barcode, unit, price, origin, serial flag, image"]
    E -- "Cấu hình BOM" --> G["GET /api/products/:id/bom, sau đó PUT /api/products/:id/bom, Input: danh sách component_id, quantity, note"]
    E -- "Tạo hoặc sửa danh mục" --> H["POST /api/categories, hoặc PUT /api/categories/:id, Input: code, name, type, parent_id, description"]
    E -- "Kéo thả cây danh mục" --> I["PUT /api/categories/:id, Input: parent_id mới"]
    E -- "Đặt ngưỡng tồn" --> J["POST /api/stock-policies, Input: warehouse_id, product_id, ngưỡng và quy tắc cảnh báo"]
    E -- "Xóa" --> K["DELETE /api/products/:id, DELETE /api/categories/:id, DELETE /api/stock-policies/:id"]
    F --> L["Backend validate dữ liệu, kiểm tra quan hệ và mã trùng"]
    G --> L
    H --> L
    I --> L
    J --> L
    K --> L
    L --> M["Ghi master data và audit log"]
    M --> N["Trả Product, BOM, Category, Policy đã cập nhật hoặc xác nhận xóa"]
    N --> O["Frontend làm mới danh sách, cây danh mục và cảnh báo tồn"]
```

## 5. Phiếu nhập, phiếu xuất và điều chuyển kho

```mermaid
flowchart TD
    A["Người dùng chọn loại lệnh, Nhập, Xuất hoặc Điều chuyển"] --> B["GET /api/process-configs/:entityType, Query: warehouse_id"]
    B --> C["Trả ProcessConfig, auto approve, chứng từ, OTP, chuỗi duyệt và bước vận hành"]
    C --> D["Người dùng nhập thông tin, chọn sản phẩm, vị trí, số lượng, đơn giá, chứng từ, ghi chú, OTP"]
    D --> E{"Loại lệnh"}
    E -- "Phiếu nhập" --> F["POST /api/import-vouchers, Input: warehouse_id, supplier_name, PO, items expected_quantity, unit_price, condition, attachment_urls, notes, action_time, otp"]
    E -- "Phiếu xuất" --> G["POST /api/export-vouchers, Input: warehouse_id, export_type, recipient, items product_id, location_id, quantity, unit_price, attachment_urls, notes, action_time, otp"]
    E -- "Điều chuyển" --> H["POST /api/transfer-orders, Input: transfer_type, kho nguồn, kho đích, items product_id, source_location_id, destination_location_id, quantity, attachments, otp"]
    F --> I["Backend validate scope, cấu hình quy trình, và dữ liệu sản phẩm, vị trí, ATP"]
    G --> I
    H --> I
    I --> J{"Quy trình tự duyệt?"}
    J -- "Không" --> K["Tạo approval records, trạng thái chờ duyệt"]
    J -- "Có" --> L["Chuyển thẳng sang bước vận hành"]
    K --> M["Trả voucher hoặc transfer order, kèm trạng thái và mã lệnh"]
    L --> M
    M --> N{"Lệnh đã được duyệt"}
    N -- "Nhập kho" --> O["PUT /api/import-vouchers/:id/actuals, Input: item id, actual_quantity, notes"]
    O --> P["POST /api/import-vouchers/:id/complete-receiving, Backend đối chiếu dự kiến và thực nhận"]
    N -- "Xuất kho" --> Q["PUT /api/export-vouchers/:id/picking-actuals, Input: item id, actual_picked_quantity"]
    Q --> R["POST /api/export-vouchers/:id/complete-picking, sau đó POST /api/export-vouchers/:id/complete-export"]
    N -- "Điều chuyển liên kho" --> S["POST /api/transfer-orders/:id/create-export, Input: additional_attachment_urls"]
    S --> R
    R --> T["POST /api/transfer-orders/:id/receive, bắt đầu nhận tại kho đích"]
    T --> U["POST /api/transfer-orders/:id/complete-receiving, Input: item_id, destination_location_id, received_quantity"]
    P --> V["Transaction cập nhật tồn kho, trạng thái lệnh và chênh lệch"]
    R --> V
    U --> W["Transaction giảm in_transit kho nguồn, tăng ATP kho đích và hoàn tất điều chuyển"]
    V --> X["Trả lệnh hoặc xác nhận hoàn tất, frontend làm mới tồn kho và audit"]
    W --> X
    Y["Người dùng theo dõi lệnh"] --> Z["GET /api/import-vouchers, GET /api/export-vouchers và /completed, GET /api/transfer-orders, Query: trạng thái, kho, người tạo, ngày"]
    Z --> AA["Trả danh sách lệnh theo scope"]
    AA --> AB["GET /api/import-vouchers/:id, GET /api/export-vouchers/:id, GET /api/transfer-orders/:id, và GET /api/import-vouchers/:id/timeline"]
    AB --> AC["Trả chi tiết lệnh, items, chứng từ và lịch sử xử lý"]
```

## 6. Phê duyệt, cấu hình quy trình và xử lý không phù hợp

```mermaid
flowchart TD
    A["Quản trị viên mở cấu hình Quy trình"] --> B["GET /api/process-configs, hoặc GET /api/process-configs/:entityType"]
    B --> C["Trả ProcessConfig, cấp duyệt, vai trò, auto approve, yêu cầu chứng từ, OTP và bước xử lý"]
    C --> D{"Đã có cấu hình?"}
    D -- "Chưa" --> E["POST /api/process-configs/seed/:entityType, Input: warehouse_id nếu có"]
    D -- "Có" --> F["PUT /api/process-configs/:id, Input: cấu hình quy trình mới"]
    E --> G["Backend lưu cấu hình mặc định, Trả ProcessConfig"]
    F --> G
    H["Người duyệt mở Việc cần xử lý"] --> I["GET /api/approvals/pending"]
    I --> J["Backend lọc task theo vai trò, cấp duyệt và phạm vi cơ sở"]
    J --> K["Trả danh sách ApprovalRecord đang chờ"]
    K --> L["Người dùng mở chi tiết"]
    L --> M["GET /api/approvals/:entityType/:entityId, Trả timeline phê duyệt"]
    M --> N{"Quyết định"}
    N -- "Duyệt" --> O["POST /api/approvals/:id/approve, Input: comments, otp"]
    N -- "Từ chối" --> P["POST /api/approvals/:id/reject, Input: reason, otp"]
    O --> Q["Backend kiểm tra người duyệt, cấp hiện tại, OTP và trạng thái chống xử lý lặp"]
    P --> Q
    Q --> R{"Kết quả"}
    R -- "Còn cấp tiếp theo" --> S["Mở task cấp kế tiếp, Trả allApproved false"]
    R -- "Đã duyệt hết" --> T["Cập nhật entity sang APPROVED, Trả allApproved true"]
    R -- "Từ chối" --> U["Cập nhật entity sang REJECTED"]
    T --> V["Frontend mở bước nhận hàng, soạn hàng hoặc xử lý tương ứng"]
    W["Người có quyền hủy hoặc chạy lại"] --> X["POST /api/approvals/:entityType/:entityId/cancel, force-cancel hoặc restart, Input: reason, otp, action_time"]
    X --> Y["Trả trạng thái hủy, hoặc attempt mới"]
    Z["Người xử lý chênh lệch"] --> AA["GET /api/nonconformities, Trả NonconformityReport theo scope"]
    AA --> AB["POST /api/nonconformities/:id/resolve, Input: resolution_type, resolution_notes, otp, action_time"]
    AB --> AC["Backend cập nhật report, quarantine, inventory và audit log"]
    AC --> AD["Trả xác nhận thành công, frontend làm mới báo cáo và tồn kho"]
```

## 7. Kiểm kê nội bộ

```mermaid
flowchart TD
    A["Người dùng mở trang Kiểm kê"] --> B["GET /api/stock-counts, Query: warehouse_id, location_id, status"]
    B --> C["Backend lọc theo quyền cơ sở"]
    C --> D["Trả danh sách StockCountSession"]
    D --> E["Người dùng tạo phiên kiểm kê"]
    E --> F["POST /api/stock-counts, Input: warehouse_id, count_scope, location_ids, product_ids hoặc category_id, blind_count_enabled, notes, action_time"]
    F --> G["Backend chụp snapshot tồn kho, tạo session và item ở trạng thái IN_PROGRESS"]
    G --> H["Trả StockCountDetail, session và danh sách item"]
    H --> I["Người kiểm kê nhập số đếm, tình trạng, bằng chứng và lý do"]
    I --> J["PATCH /api/stock-counts/:id/items/:itemId, Input: counted_quantity, condition, evidence_urls, discrepancy_reason, notes"]
    J --> K["Backend tính discrepancy, cập nhật item và recount_count"]
    K --> L["Trả StockCountDetail mới nhất"]
    L --> M{"Người dùng hoàn tất?"}
    M -- "Hủy" --> N["POST /api/stock-counts/:id/cancel, Input: reason, action_time"]
    M -- "Gửi kết quả" --> O["POST /api/stock-counts/:id/submit, Input: action_time"]
    O --> P["Backend kiểm tra đủ item, tổng hợp các chênh lệch"]
    P --> Q{"Có chênh lệch?"}
    Q -- "Không" --> R["Đặt trạng thái VERIFIED, ghi completed_at"]
    Q -- "Có" --> S["Đặt trạng thái DISCREPANCY_FOUND, tạo ngoại lệ cần xử lý"]
    R --> T["Trả session, items, discrepancy_count và trạng thái"]
    S --> T
    N --> T
```

## 8. Kiểm kê ngoài, quét hàng và hàng chờ phê duyệt

```mermaid
flowchart TD
    A["Thiết bị hoặc hệ thống ngoài bắt đầu ca"] --> B["GET /api/external/v1/count/state, Query: warehouse_id, location_id, business_date, operator_id, shift_id"]
    B --> C["Backend kiểm tra API key, phạm vi kho và yêu cầu kiểm kê đầu ca"]
    C --> D["Trả trạng thái checkpoint, và quyền được quét"]
    D --> E["Thiết bị gửi kiểm kê đầu ca hoặc cuối ca"]
    E --> F["POST /api/external/v1/count, Input: checkpoint_type, business_date, idempotency_key, operator, shift, device, items barcode hoặc product_id, counted_quantity, condition, evidence_urls, base_atp"]
    F --> G["Backend chống gửi trùng, so sánh ATP và tạo session kiểm kê"]
    G --> H{"Có chênh lệch?"}
    H -- "Có" --> I["Tạo nonconformity và quarantine, Trả session DISCREPANCY_FOUND"]
    H -- "Không" --> J["Trả session VERIFIED, cấp quyền quét cho ca"]
    J --> K["Nhân viên quét sản phẩm"]
    K --> L["POST /api/external/v1/scan, Input: barcode hoặc product_id, warehouse_id, location_id, quantity, operator, device, scan_time, shift"]
    L --> M["Backend kiểm tra sản phẩm được phép, đủ ATP và checkpoint đầu ca"]
    M --> N["Transaction chuyển lượng quét, từ ATP sang on_hold, Trả ExternalScanRecord QUEUED"]
    N --> O["Thiết bị chốt batch, POST /api/external/v1/batch-submit, Input: kho, vị trí, ca, operator, notes"]
    O --> P["Backend gom scan thành batch, theo cấu hình auto approve hoặc chuỗi duyệt"]
    P --> Q["Quản lý mở hàng chờ, GET /api/external-queue/pending"]
    Q --> R{"Quản lý xử lý batch"}
    R -- "Sửa số lượng" --> S["PATCH /api/external-queue/update-quantity, Input: scan_id, quantity, reason"]
    R -- "Hủy scan" --> T["POST /api/external-queue/cancel-scan, Input: scan_id, reason"]
    R -- "Từ chối batch" --> U["POST /api/external-queue/reject, Input: batch_id, reason"]
    R -- "Phê duyệt" --> V["POST /api/external-queue/approve, Input: batch_id, approved_items, notes"]
    S --> Q
    T --> Q
    V --> W["Backend đối chiếu lượng đang giữ, tạo hoặc cập nhật phiếu xuất SALE_POS, khi duyệt đủ thì tiêu thụ on_hold, ghi audit"]
    U --> X["Cập nhật trạng thái REJECTED"]
    W --> Y["Trả kết quả batch, frontend tải lịch sử"]
    X --> Y
    Z["Quản trị cấu hình tự động"] --> AA["PUT /api/external-queue/auto-submit-schedule, Input: enabled, times, hoặc PUT approval-config, scannable-products"]
    AA --> AB["Trả lịch chạy, ProcessConfig, hoặc danh sách sản phẩm được quét"]
```

## 9. Nhập liệu và báo cáo chi phí

```mermaid
flowchart TD
    A["Người dùng chọn kho và kỳ chi phí"] --> B["GET /api/expenses/:warehouseId/:period"]
    B --> C["Backend kiểm tra quyền expenses.read, tải ExpenseDocument"]
    C --> D["Trả trạng thái kỳ, items cố định và custom_items"]
    D --> E{"Người dùng thao tác"}
    E -- "Sửa dòng cố định" --> F["PUT /api/expenses/:warehouseId/:period/items/:category, Input: actual_amount, budget_amount, note"]
    E -- "Thêm hoặc sửa dòng tự tạo" --> G["PUT /api/expenses/:warehouseId/:period/custom-items/:itemId, Input: label, cost_center, actual_amount, budget_amount, note"]
    E -- "Xóa dòng tự tạo" --> H["DELETE /api/expenses/:warehouseId/:period/custom-items/:itemId"]
    F --> I["Backend validate kỳ còn mở, cập nhật document và ghi audit"]
    G --> I
    H --> I
    I --> J["Trả ExpenseDocument đã cập nhật"]
    D --> T["Người dùng import Excel"]
    T --> U["Frontend parse và validate workbook, chuyển từng dòng thành expense item"]
    U --> F
    U --> G
    J --> K{"Hoàn tất nhập liệu?"}
    K -- "Khóa kỳ" --> L["POST /api/expenses/:warehouseId/:period/close"]
    K -- "Mở lại kỳ" --> M["POST /api/expenses/:warehouseId/:period/reopen"]
    L --> N["Backend đổi trạng thái kỳ, Trả ExpenseDocument"]
    M --> N
    A --> O["Người dùng mở Báo cáo chi phí"]
    O --> P["GET /api/expenses/dashboard/:warehouseId/:period"]
    P --> Q["Backend tổng hợp doanh thu, chi phí, lợi nhuận, ngân sách và xu hướng"]
    Q --> R["Trả KPI, cost center, chart series, top expense và cảnh báo"]
    R --> S["Frontend hiển thị thẻ KPI, biểu đồ và bảng phân tích"]
```

## 10. Doanh thu và mẫu báo cáo Excel

```mermaid
flowchart TD
    A["Người dùng chọn nguồn, kho, và khoảng thời gian doanh thu"] --> B{"Nguồn dữ liệu"}
    B -- "Open API" --> C["GET /api/revenue/sync/:period, hoặc POST /api/revenue/partner-pos-sync, Input: kho và khoảng ngày"]
    B -- "POS nội bộ" --> D["Backend đọc dữ liệu LOCAL_POS đã đồng bộ"]
    C --> E["Backend gọi hệ thống nguồn, chuẩn hóa đơn hàng, hàng bán, thuế, và lưu cache theo kỳ"]
    D --> F["GET /api/revenue/dashboard, Query: source, warehouseId, mode, date, month, year, startDate, endDate"]
    E --> F
    F --> G["Backend tổng hợp so sánh kỳ trước, phương thức thanh toán, top sản phẩm, tiêu thụ thiết bị và đơn hàng"]
    G --> H["Trả RevenueDashboardData, stats, charts, dailyRows, topProductGroups, deviceConsumptions, orders, soldItems"]
    H --> I["Frontend hiển thị dashboard doanh thu"]
    I --> J["Người dùng xem chi tiết đơn"]
    J --> K["GET /api/revenue/order-details/:orderId, Trả đơn và các dòng hàng"]
    I --> L["Người dùng xuất báo cáo doanh thu"]
    L --> M["POST /api/revenue/export, Input: source, reportType, warehouseId, bộ lọc ngày, locale, actionTime"]
    M --> N["Backend tạo workbook, Trả file Excel nhị phân"]
    O["Người dùng quản lý mẫu báo cáo"] --> P["GET /api/reports/templates, Trả danh sách ReportTemplate"]
    P --> Q["POST /api/reports/templates/excel, Input: name, original_file_name, file_base64, visibility, mapping"]
    Q --> R["Backend lưu file gốc, template, version và mapping ô dữ liệu"]
    R --> S["Trả template và version"]
    S --> T["POST /api/reports/templates/:id/preview, Input: mapping"]
    T --> U["Trả danh sách sheet_name, cell, value"]
    U --> V["POST /api/reports/templates/:id/export, Input: mapping"]
    V --> W["Backend đổ dữ liệu vào workbook, Trả file Excel nhị phân"]
```

## 11. Hóa đơn điện tử MISA meInvoice

```mermaid
flowchart TD
    A["Quản trị viên cấu hình cửa hàng"] --> B["GET /api/meinvoice/store-configs/:warehouseId/account-options, Trả tài khoản MISA khả dụng"]
    B --> C["PUT /api/meinvoice/store-configs/:warehouseId, Input: account_id, inv_series, sign_type, seller shop, VAT mapping, SKU mapping, payment mapping, go_live_at, enabled"]
    C --> D["POST /api/meinvoice/store-configs/:warehouseId/validate"]
    D --> E["Backend gọi MISA kiểm tra mẫu hóa đơn, Trả template và validated_at"]
    F["Nhân viên chọn kho và ngày bán"] --> G["POST /api/invoices/source-orders/sync, Input: warehouse_id, business_date, purpose"]
    G --> H["Backend lấy đơn nguồn, upsert theo source identity, tạo hoặc rebase draft, và chạy đối soát ngày"]
    H --> I["Trả InvoiceSyncResult, order_count, inserted, updated, unchanged, draft counts và reconciliation summary"]
    I --> J["GET /api/invoices/source-orders, Query: warehouse_id, business_date"]
    J --> K["Trả InvoiceSourceOrderView"]
    K --> L["Người dùng chọn đơn để chuẩn bị hóa đơn"]
    L --> M["POST /api/invoices/source-orders/:id/prepare, Input: warehouse_id"]
    M --> N["Backend dựng InvoiceDocument, áp mapping, tính tiền và VAT, tạo revision"]
    N --> O["Trả InvoiceDocumentView"]
    O --> P["Người dùng sửa người mua, phương thức thanh toán hoặc dòng hàng"]
    P --> Q["PUT /api/invoices/documents/:id, Input: warehouse_id, expected_revision, expected_source_payload_hash, buyer, payment_method_name, items"]
    Q --> R["Backend kiểm tra optimistic lock, tính lại tổng và lưu revision mới"]
    R --> S["POST /api/invoices/documents/:id/preview, Input: warehouse_id"]
    S --> T["Backend preflight và gọi MISA preview, Trả url, expires_at, ref_id, prepared_payload_hash, source_payload_hash"]
    T --> U{"Người dùng xác nhận phát hành"}
    U -- "Một hoặc nhiều hóa đơn" --> V["POST /api/invoices/issues, hoặc POST /api/invoices/bulk-issues, Input: warehouse_id, business_date, document hoặc source_order ids"]
    V --> W["Backend khóa chống phát hành trùng, tạo issue job và các job item"]
    W --> X["Worker gọi MISA phát hành, retry lỗi tạm thời, lưu transaction_id, invoice_number và invoice_code"]
    X --> Y{"Kết quả MISA"}
    Y -- "Thành công" --> Z["Ghi InvoiceLedgerEntry, đặt trạng thái ISSUED"]
    Y -- "Không chắc chắn hoặc lệch dữ liệu" --> AA["Tạo reconciliation case, không tự phát hành lại"]
    Y -- "Lỗi có thể thử lại" --> AB["Đặt retry candidate, POST /api/invoices/issues/retry khi người dùng yêu cầu"]
    Z --> AC["GET /api/invoices/ledger, Trả sổ hóa đơn theo ngày"]
    AC --> AD["GET /api/invoices/ledger/:id/view, hoặc /download, Trả URL xem hoặc dữ liệu PDF, XML"]
    AA --> AE["GET /api/invoices/reconciliation-cases, Trả danh sách case và details"]
    AE --> AF["POST /api/invoices/reconciliation-cases/:id/resolve, Input: warehouse_id, note"]
    AF --> AG["Backend đóng case, Trả case đã cập nhật"]
    AH["Khách mở link yêu cầu hóa đơn"] --> AI["GET /api/public/invoice-requests/:token, Trả thông tin đơn được phép khai báo"]
    AI --> AJ["POST /api/public/invoice-requests/:token/submissions, Input: idempotency_key, action_time, buyer gồm tên, mã số thuế, địa chỉ, email"]
    AJ --> AK["Backend validate token và dữ liệu người mua, Trả public view và cờ duplicate"]
```

## 12. Hồ sơ nhân viên, vòng đời làm việc và hợp đồng

```mermaid
flowchart TD
    A["HR mở danh sách nhân viên"] --> B["GET /api/employee-profiles, hoặc GET /api/employee-profiles/me"]
    B --> C["Backend lọc theo workplace và quyền, Trả EmployeeProfile"]
    C --> D{"Thao tác hồ sơ"}
    D -- "Tạo" --> E["POST /api/employee-profiles, Input: employee_code, full_name, liên hệ, job_title, department, workplace, status, create_account và account nếu tạo user cùng lúc"]
    D -- "Sửa" --> F["PUT /api/employee-profiles/:id, Input: trường hồ sơ thay đổi"]
    D -- "Xóa" --> G["DELETE /api/employee-profiles/:id"]
    E --> H["Backend kiểm tra mã nhân viên, liên kết user và quyền cơ sở, ghi audit"]
    F --> H
    G --> H
    H --> I["Trả EmployeeProfile đã cập nhật, hoặc xác nhận soft delete"]
    C --> J["HR lên lịch đổi trạng thái làm việc"]
    J --> K["POST /api/employee-profiles/:id/employment-transitions, Input: to_status, effective_date, probation_end_date, reason"]
    K --> L["Backend tạo transition SCHEDULED, hoặc áp dụng ngay nếu đến hạn"]
    L --> M["Trả EmployeeEmploymentTransition"]
    N["HR mở lịch sử hợp đồng"] --> O["GET /api/employee-profiles/:id/contracts, Trả EmployeeContract theo thứ tự gia hạn"]
    O --> P{"Thao tác hợp đồng"}
    P -- "Tạo" --> Q["POST /api/employee-profiles/:id/contracts, Input: contract_number, type, start_date, end_date, notes, idempotency_key, action_time"]
    P -- "Sửa" --> R["PUT /api/employee-profiles/:id/contracts/:contractId, Input: trường sửa, expected_revision, idempotency_key, action_time"]
    P -- "Gia hạn" --> S["POST /api/employee-profiles/:id/contracts/:contractId/renew, Input: hợp đồng mới và expected_revision"]
    P -- "Hủy hoặc chấm dứt" --> T["POST endpoint cancel hoặc terminate, Input: reason, expected_revision, termination_date nếu có, idempotency_key"]
    Q --> U["Backend kiểm tra trùng số, khoảng ngày, trạng thái vòng đời và optimistic lock"]
    R --> U
    S --> U
    T --> U
    U --> V["Trả EmployeeContractMutationResult, contract, source_contract, replayed"]
    V --> W["Người dùng tải PDF hợp đồng"]
    W --> X["POST documents/upload-intents, Input: original_file_name, idempotency_key, action_time"]
    X --> Y["Trả signed upload_url, fields, expires_at và max_file_size"]
    Y --> Z["Frontend upload PDF trực tiếp storage"]
    Z --> AA["POST upload-intents/:intentId/finalize, Input: idempotency_key, action_time"]
    AA --> AB["Backend kiểm tra file, size, mime, checksum, Trả EmployeeContractDocument"]
    AC["HR import lịch sử hợp đồng"] --> AD["POST /api/employee-contract-imports/upload-sessions, Input: danh sách file Excel, PDF"]
    AD --> AE["Upload signed URL rồi POST /preview, Input: upload_session, file path, checksum, pdf_files"]
    AE --> AF["Backend parse tối đa 100 dòng, Trả batch, rows và validation_messages"]
    AF --> AG["POST /api/employee-contract-imports/:batchId/commit, Input: expected_batch_checksum, idempotency_key, action_time"]
    AG --> AH["Trả commit result, committed_rows và duplicate_rows"]
```

## 13. Chấm công, đơn nghỉ và quản trị phép

```mermaid
flowchart TD
    A["Nhân viên mở Chấm công"] --> B["GET /api/attendance/context"]
    B --> C["Backend tải workplace, policy, exemption, work arrangement và log gần nhất"]
    C --> D["Trả AttendanceCheckInContext"]
    D --> E["Nhân viên bấm Check in, cho phép lấy vị trí nếu chính sách yêu cầu"]
    E --> F["POST /api/attendance/check-in, Input: action_time và location gồm, latitude, longitude, accuracy_m, captured_at"]
    F --> G["Backend kiểm tra ca, geofence, miễn trừ, lịch làm việc và chống trùng"]
    G --> H{"Kết quả"}
    H -- "Hợp lệ" --> I["Ghi AttendanceLog ACCEPTED, Trả log và trạng thái đúng hoặc trễ"]
    H -- "Không hợp lệ" --> J["Trả rejected_reason, không ghi nhận chấm công hợp lệ"]
    I --> K{"Đi trễ cần giải trình?"}
    K -- "Có" --> L["POST /api/attendance/late-reports, Input: attendance_date, expected_arrival_time, estimated_arrival_time, reason, action_time"]
    L --> M["Trả AttendanceLateReport"]
    BA["HR cấu hình chấm công"] --> BB["PUT /api/attendance/policies/:warehouseId, Input: enabled, IP, verification_strategy, GPS radius, accuracy, age và chế độ làm việc"]
    BB --> BC["Backend validate chính sách theo kho, Trả WarehouseAttendancePolicy"]
    BA --> BD["PUT /api/attendance/exemptions/:warehouseId, Input: excluded_user_ids"]
    BD --> BE["Trả WarehouseAttendanceExemption"]
    BA --> BF["POST /api/attendance/work-arrangements/:warehouseId, Input: user_id, type, khoảng ngày, location_rule, điểm đến, radius, reason"]
    BF --> BG["Trả AttendanceWorkArrangement"]
    N["Nhân viên mở Nghỉ phép"] --> O["GET /api/leave/me/balance, GET /api/leave/me/requests, GET /api/leave/policy"]
    O --> P["Trả balance buckets, ledger summary, đơn cá nhân và chính sách công ty"]
    P --> Q["Người dùng tạo đơn nháp"]
    Q --> R["POST /api/leave/me/requests, Input: request_type, days, reason, submit và action_time"]
    R --> S["Backend tính ngày làm việc và số đơn vị, Trả LeaveRequest DRAFT"]
    S --> T["POST /api/leave/me/requests/:id/submit, Input: action_time"]
    T --> U["Backend kiểm tra số dư và trùng lịch, giữ số dư, tạo approval tasks"]
    U --> V["Trả LeaveRequest SUBMITTED"]
    W["Người duyệt mở inbox phép"] --> X["GET /api/leave/approval-tasks/me, Trả LeaveApprovalTaskView"]
    X --> Y["POST /api/leave/approval-tasks/:id/decision, Input: decision, reason, action_time"]
    Y --> Z{"Đã duyệt hết?"}
    Z -- "Chưa" --> AA["Mở cấp duyệt tiếp theo, Trả request đang chờ"]
    Z -- "Duyệt hết" --> AB["Commit giữ phép vào ledger, Trả request APPROVED"]
    Z -- "Từ chối" --> AC["Giải phóng số dư giữ, Trả request REJECTED"]
    AD["HR quản trị phép"] --> AE["PUT /api/leave/policy, PUT /api/leave/approval-config, POST hoặc DELETE /api/leave/holidays"]
    AE --> AF["Backend lưu chính sách, chuỗi duyệt và ngày lễ, Trả entity cấu hình"]
    AD --> AG["POST /api/leave/balances/:profileId/adjustments, Input: idempotency_key, leave_year, posting_date, available_units_delta, reason, action_time"]
    AG --> AH["Ghi ledger điều chỉnh, Trả adjustment và balance mới"]
    AD --> AI["POST /api/leave/imports/preview, Input: source_file_name, source_file_url, source_file_checksum, action_time"]
    AI --> AJ["Trả batch và validation từng dòng"]
    AJ --> AK["POST /api/leave/imports/:id/commit, Input: action_time"]
    AK --> AL["Ghi lịch sử và số dư phép, Trả committed_rows, duplicate_rows"]
```

## 14. Thư viện tệp, tài liệu quy trình và thông báo

```mermaid
flowchart TD
    A["Người dùng mở tài liệu quy trình"] --> B["GET /api/process-documents"]
    B --> C["Backend tải tài liệu chưa xóa, Trả danh sách ProcessDocument"]
    C --> D{"Người dùng thao tác tài liệu"}
    D -- "Thêm tài liệu" --> E["POST /api/process-documents, Input: title, description, process_type, file_name PDF, file_url, file_size, file_format"]
    D -- "Xóa tài liệu" --> F["DELETE /api/process-documents/:id"]
    E --> G["Backend lưu liên kết tài liệu, và ghi audit log"]
    F --> G
    G --> H["Trả ProcessDocument, hoặc xác nhận soft delete"]
    I["Người dùng quản lý file mẫu"] --> J["GET /api/file-templates, GET /api/file-template-bundles"]
    J --> K["Trả FileTemplate, version history, và FileTemplateBundle"]
    K --> L["POST /api/file-templates, Input: title, description, category, file_name, file_url, file_size, file_format"]
    L --> M["PATCH /api/file-templates/:id để sửa metadata, PUT /api/file-templates/:id/version để tải bản mới"]
    M --> N1["Backend lưu template và version, Trả FileTemplate đã cập nhật"]
    K --> M1["DELETE /api/file-templates/:id, hoặc DELETE /api/file-template-bundles/:id"]
    M1 --> N1
    K --> N2["POST hoặc PATCH /api/file-template-bundles, Input: name, description, template_ids, process_document_ids"]
    N2 --> N3["Trả FileTemplateBundle đã cập nhật"]
    N["Người dùng mở trang Thông báo"] --> O["GET /api/notifications/dispatches, Query: limit"]
    O --> P["Trả lịch sử NotificationDispatch"]
    P --> Q{"Chọn kênh gửi"}
    Q -- "Trong hệ thống" --> R["POST /api/notifications/in-app, Input: recipient_user_ids, recipient_role_ids, title, message, priority, action_url"]
    Q -- "Email" --> S["POST /api/notifications/email, Input: to, cc, bcc, subject, html_content và text_content"]
    R --> T["Backend phân giải người nhận, sanitize nội dung, tạo notification và dispatch"]
    S --> U["Backend sanitize nội dung, gọi dịch vụ email và ghi dispatch"]
    T --> V["Trả NotificationDispatch, status SENT, PARTIAL hoặc FAILED"]
    U --> V
    W["Thiết bị bật push notification"] --> X["POST /api/notifications/push-token, Input: token, platform và device metadata"]
    X --> Y["Backend gắn token với user, Trả id và enabled true"]
```

## 15. Người dùng, vai trò, phạm vi cơ sở, cấu hình hệ thống và audit

```mermaid
flowchart TD
    A["Quản trị viên mở quản lý truy cập"] --> B["GET /api/users, GET /api/roles, GET /api/office-scopes"]
    B --> C["Backend kiểm tra quyền quản trị, lọc dữ liệu theo phạm vi được phép"]
    C --> D["Trả User, Role, role assignments và office scope overview"]
    D --> E{"Thao tác quản trị"}
    E -- "Tạo hoặc sửa người dùng" --> F["POST /api/users, hoặc PUT /api/users/:id, Input: username, email, full_name, employee_id, workplace_facility_id, status, assignments"]
    E -- "Gửi lời mời" --> G["POST /api/users/:id/invitation, Input: user id"]
    E -- "Tạo hoặc sửa vai trò" --> H["POST /api/roles, hoặc PUT /api/roles/:id, Input: name, parent_role_id, color, permissions"]
    E -- "Đặt phạm vi văn phòng" --> I["PUT /api/office-scopes/:officeId, Input: scope_mode, target_facility_ids, expected_revision, valid_from, valid_until"]
    E -- "Đặt trần phạm vi" --> J["PUT /api/office-scopes/:officeId/ceiling, Input: scope_mode, target_facility_ids, expected_revision"]
    F --> K["Backend validate quyền không vượt trần, cập nhật source assignments"]
    G --> L["Backend tạo invitation token, gửi email và trả trạng thái lời mời"]
    H --> K
    I --> K
    J --> K
    K --> M["Materialize access snapshot mới, tăng access version và ghi audit"]
    M --> N["Trả user, role hoặc office scope, kèm revision mới"]
    N --> O["Frontend làm mới quyền hiệu lực, GET /api/users/:id/effective-access"]
    O --> P["Trả metadata và facility grants đã hợp nhất"]
    Q["Quản trị viên cấu hình Open API"] --> R["GET hoặc PUT /api/system-configs/openapi/:warehouseId, Input: app_id, secret_key, base_url, api_version, action_versions, payment_channel_mapping, enabled"]
    R --> S["POST /api/system-configs/openapi/:warehouseId/test"]
    S --> T["Backend gọi thử upstream, Trả kết quả kết nối đã che dữ liệu bí mật"]
    U["Kiểm toán viên tra cứu lịch sử"] --> V["GET /api/audit-logs, Query: entity, user, warehouse, action, date range, pagination, sort"]
    V --> W["Backend áp scope, Trả danh sách AuditLog theo limit và page"]
    W --> X["Frontend tạo workbook Excel từ dữ liệu đã lọc"]
    X --> Y["POST /api/audit-logs/export, Input: entity_type, warehouse_id, filters"]
    Y --> Z["Backend chỉ ghi audit action EXPORT, Trả xác nhận, frontend tải file đã tạo"]
```

## 16. Quản lý thiết bị và cấu hình POS

```mermaid
flowchart TD
    A["Quản trị viên chọn cửa hàng POS"] --> B["GET /api/pos/stores/:warehouseId/overview, GET /api/pos/stores/:warehouseId/devices"]
    B --> C["Backend kiểm tra quyền POS theo cửa hàng, Trả PosStoreOverview và SafePosDevice"]
    C --> D["Quản trị viên tạo mã ghi danh"]
    D --> E["POST /api/pos/stores/:warehouseId/enrollments, Input: otp"]
    E --> F["Backend tạo enrollment có hạn, Trả grant cho thiết bị"]
    F --> G["Ứng dụng POS kích hoạt"]
    G --> H["POST /api/pos/devices/activate, Input: enrollment token, device info"]
    H --> I["Backend tạo device credential dạng an toàn, Trả PosDeviceActivationResult"]
    I --> J["Thiết bị mở phiên và gửi heartbeat"]
    J --> K["POST /api/pos/devices/session, POST /api/pos/devices/heartbeat, Input: device_id, credential, app_version"]
    K --> L["Backend xác minh thiết bị ACTIVE, cập nhật last_seen và trả session status"]
    L --> M["POST /api/pos/devices/config, Input: device_id, credential, known_versions"]
    M --> N["Backend so sánh version cấu hình, Trả phần receipt, ticket, display, visibility và payment cần đồng bộ"]
    C --> O{"Quản trị viên chọn cấu hình"}
    O -- "Biên lai" --> P["PUT /api/pos/stores/:warehouseId/receipt-settings, Input: nội dung, logo, font, paper, expected_version"]
    O -- "Vé" --> Q["PUT /api/pos/stores/:warehouseId/ticket-settings, Input: nội dung vé, logo, layout, expected_version"]
    O -- "Vòng quay" --> R["PUT /api/pos/stores/:warehouseId/lucky-draw-settings, Input: enabled, package options, paper size"]
    O -- "Hiển thị sản phẩm" --> S["PUT /api/pos/stores/:warehouseId/product-visibility-settings, Input: visible_product_ids, expected_version"]
    O -- "Thanh toán theo máy" --> T["PUT /api/pos/devices/:deviceId/payment-settings, Input: payment configuration"]
    O -- "Màn hình khách" --> U["PUT /api/pos/stores/:warehouseId/customer-display-settings, Input: playlist, expected_version, action_time"]
    P --> V["Backend validate version, lưu cấu hình, tăng version và ghi audit"]
    Q --> V
    R --> V
    S --> V
    T --> V
    U --> V
    O -- "Media màn hình khách" --> U1["POST /api/pos/stores/:warehouseId/customer-display-media, Input: body file, Content-Type, X-File-Name, X-Expected-Version, X-Action-Time"]
    U1 --> U2["Backend lưu IMAGE hoặc VIDEO, Trả PosCustomerDisplaySettingsView"]
    U2 --> U
    V --> W["Trả settings mới, thiết bị nhận ở lần config sync kế tiếp"]
    C --> X["Quản trị viên khóa hoặc chuyển máy"]
    X --> Y["PATCH /api/pos/devices/:deviceId/status, Input: ACTIVE hoặc REVOKED, hoặc PATCH warehouse với warehouse_id"]
    Y --> Z["Backend thu hồi hoặc đổi cửa hàng, Trả SafePosDevice đã cập nhật"]
```

## 17. Chiến dịch voucher marketing

Luồng backend đã có đầy đủ API và feature gate. Tại thời điểm rà soát, menu có đường dẫn `/admin/vouchers` nhưng chưa tìm thấy page route tương ứng trong frontend; vì vậy sơ đồ dưới đây mô tả contract nghiệp vụ mà giao diện quản trị cần gọi.

```mermaid
flowchart TD
    A["Người quản trị nhập thông tin chiến dịch, tên, mô tả, phần thưởng, thời hạn, prefix, suffix, số lượng và độ dài mã"] --> B["POST /api/marketing-vouchers/campaigns, Input: name, description, reward_type, reward_value, valid_from, valid_to, prefix, suffix, code_length, purpose, accent_color, requested_code_count, idempotency_key và action_time"]
    B --> C["Backend kiểm tra quyền workplace, sức chứa không gian mã và dữ liệu chiến dịch"]
    C --> D["Tạo campaign và generation job"]
    D --> E["Trả MarketingVoucherCampaignMutationResult, campaign, job và replayed"]
    E --> F["Worker gọi, POST /api/marketing-vouchers/internal/jobs/:jobId/process"]
    F --> G["Backend sinh mã theo chunk, chống trùng và cập nhật progress"]
    G --> H{"Job hoàn tất?"}
    H -- "Chưa" --> F
    H -- "Có" --> I["Cập nhật code_counts và trạng thái campaign"]
    I --> J["GET /api/marketing-vouchers/campaigns/:campaignId, Trả campaign và thống kê mã"]
    J --> K{"Người quản trị thao tác"}
    K -- "Sinh thêm mã" --> L["POST /api/marketing-vouchers/campaigns/:campaignId/generate, Input: quantity, expected_revision, idempotency_key, action_time"]
    K -- "Gia hạn" --> M["POST /api/marketing-vouchers/campaigns/:campaignId/extend, Input: valid_to, expected_revision, idempotency_key, action_time"]
    K -- "Tạm dừng hoặc kích hoạt" --> N["POST /api/marketing-vouchers/campaigns/:campaignId/status, Input: status, expected_revision, idempotency_key, action_time"]
    K -- "Thu hồi mã" --> O["POST /api/marketing-vouchers/codes/revoke, Input: code_ids, reason, idempotency_key, action_time"]
    K -- "Kết thúc và ẩn" --> P["DELETE /api/marketing-vouchers/campaigns/:campaignId, Input: expected_revision, idempotency_key, action_time"]
    L --> Q["Tạo generation job, Trả job QUEUED"]
    M --> R["Tạo extension job, Trả job QUEUED"]
    N --> S["Trả campaign với status mới"]
    O --> T["Backend chỉ thu hồi mã hợp lệ, Trả mutation result và số mã đổi trạng thái"]
    P --> S
    Q --> F
    R --> F
    U["Người quản trị theo dõi job"] --> V["GET /api/marketing-vouchers/jobs/:jobId, Trả type, status, progress và error"]
    V --> W{"Job lỗi hoặc tạm dừng?"}
    W -- "Có" --> X["POST /api/marketing-vouchers/jobs/:jobId/resume, Input: expected_job_revision, expected_campaign_revision, idempotency_key, action_time"]
    X --> F
    W -- "Không" --> Y["Hiển thị tiến độ và kết quả"]
```
