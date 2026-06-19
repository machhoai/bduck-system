Dưới đây là kế hoạch triển khai theo hướng bám sát hệ thống hiện tại, ưu tiên tận dụng model đã có thay vì đẻ thêm domain mới.
Mục Tiêu
Biến /task thành nơi xử lý toàn bộ công việc vận hành:
/task
- Xử lý phiếu
- Kiểm đếm / thao tác kho
- Hoàn thành phiếu
- Hàng hỏng / chênh lệch
Còn /voucher chỉ giữ vai trò:
/voucher
- Tạo lệnh
- Theo dõi trạng thái lệnh
- Xem lịch sử / chi tiết
- Không thao tác nghiệp vụ chính
Giai Đoạn 1: Chốt Quy Ước Tồn Kho
Dựa trên Inventory hiện có:
atp_quantity
on_hold_quantity
in_transit_quantity
quarantine_quantity
total_quantity
Quy ước nghiệp vụ:
atp_quantity          Hàng tốt, được tính ATP
on_hold_quantity      Hàng chênh lệch/chờ xác minh
quarantine_quantity   Hàng hỏng/cách ly chất lượng
in_transit_quantity   Hàng đang chuyển
total_quantity        Tổng các bucket
Không thêm tình trạng vào Product trong master-data.ts.
Nếu sau này cần quản lý hàng trưng bày rõ ràng, cân nhắc thêm:
display_quantity
Nhưng giai đoạn đầu có thể chưa cần.
Giai Đoạn 2: Chuẩn Hóa Luồng Phát Sinh Ngoại Lệ
Khi hoàn tất kiểm đếm, nhận hàng, soạn hàng hoặc kiểm kho:
Nếu số lượng thực tế khác số lượng hệ thống/kỳ vọng:
tạo NonconformityReport
issue_type = DISCREPANCY hoặc MISSING
số lượng ảnh hưởng = phần chênh lệch

Nếu hàng hỏng/hết hạn/rách seal:
tạo NonconformityReport
tạo QuarantineRecord
chuyển số lượng bị ảnh hưởng từ atp_quantity sang quarantine_quantity

Nếu hàng thừa:
không cộng vào ATP ngay
đưa vào on_hold_quantity
chờ người có quyền xác nhận

Nếu xác nhận cần điều chỉnh tồn:
tạo AdjustmentVoucher
reference về NONCONFORMITY hoặc STOCK_COUNT

(Đang thực hiện đến đây) Giai Đoạn 3: Backend API / Service
Cần bổ sung hoặc hoàn thiện các nhóm service sau:
Nonconformity service
tạo report từ import/export/stock count/manual
lấy danh sách report đang chờ xử lý
lấy chi tiết report
resolve report

Quarantine service
tạo quarantine record
release hàng về ATP
dispose/hủy hàng
trả NCC/thanh lý nếu cần

Inventory bucket transaction
Các thao tác phải chạy transaction:

ATP -> quarantine
ATP -> on_hold
on_hold -> ATP
on_hold -> adjustment decrease
quarantine -> ATP
quarantine -> disposed
Adjustment voucher
tạo phiếu điều chỉnh từ nonconformity
duyệt/từ chối theo role
sau duyệt mới cập nhật tồn cuối cùng

Permission / SOD
người tạo/người nhập kết quả không được xử lý ngoại lệ do họ tạo
role xử lý riêng, ví dụ:quản lý kho
kế toán kho
kiểm soát nội bộ
admin

mọi xử lý có audit log

Giai Đoạn 4: Refactor /task
Hiện tại TaskInbox chỉ xử lý pending_approvals. Nên đổi thành một component dạng workbench:
TaskWorkbench
- TaskApprovalTab
- WarehouseOperationTab
- VoucherCompletionTab
- InventoryExceptionTab
Mapping cụ thể:
TaskApprovalTab
dùng lại logic hiện tại của TaskInbox
data source: pending_approvals
drawer: TaskDetailDrawer

WarehouseOperationTab
chuyển action từ UnifiedInProgressTab sang đây
nhập kho: mở ReceivingSessionDrawer
xuất kho: mở PickingSessionDrawer
transfer receive nếu có thì bổ sung sau

VoucherCompletionTab
chứa các phiếu cần hoàn tất cuối
ví dụ export status SHIPPED
gọi completeExportVoucher

InventoryExceptionTab
data source: nonconformity_reports
join thêm product/location/warehouse/user
mở drawer xử lý ngoại lệ

Giai Đoạn 5: Điều Chỉnh /voucher
Trong UnifiedInProgressTab:
bỏ hoặc giảm vai trò các nút thao tác trực tiếp như “Tiếp tục”, “Hoàn thành”
thay bằng:“Xem chi tiết”
“Mở công việc” nếu user có task tương ứng

giữ chức năng clone/edit/detail nếu phù hợp
Mục tiêu là /voucher không còn là nơi vận hành thực tế.
Giai Đoạn 6: UI Tab Hàng Hỏng / Chênh Lệch
Tab này nên có:
Filter:
Loại ngoại lệ: hỏng / thiếu / thừa / hết hạn / sai số lượng
Kho
Vị trí
SKU
Nguồn phát sinh: nhập / xuất / kiểm kho / chuyển kho / thủ công
Trạng thái
Người báo cáo
Ngày phát sinh
Card/table hiển thị:
Mã report
SKU / tên hàng
Kho / vị trí
Số lượng ảnh hưởng
Loại lỗi
Nguồn phát sinh
Người ghi nhận
Trạng thái
ATP bị ảnh hưởng
Drawer xử lý có action:
Xác nhận thiếu
Xác nhận thừa
Chuyển cách ly
Trả về hàng tốt
Yêu cầu kiểm lại
Tạo phiếu điều chỉnh
Hủy hàng
Trả NCC
Thanh lý
Từ chối ngoại lệ
Giai Đoạn 7: Rule Chênh Lệch
Mặc định:
Chỉ giữ phần chênh lệch
Ví dụ hệ thống có 100, kiểm thấy 95:
atp_quantity: 95
on_hold_quantity: 5
total_quantity: 100
Không khóa toàn bộ SKU.
Chỉ khóa toàn bộ lô/vị trí/SKU nếu có rule rủi ro cao:
serialized item
giá trị cao
hạn dùng nghiêm ngặt
nghi vấn gian lận
sai lô/sai vị trí không xác định được phần đúng
chênh lệch lặp lại nhiều lần
Giai Đoạn 8: Kiểm Thử
Test nghiệp vụ chính:
Nhập thiếu hàng.
Nhập thừa hàng.
Nhập có hàng hỏng.
Kiểm kho thiếu.
Kiểm kho thừa.
Hàng hỏng được chuyển ATP -> quarantine.
Hàng thừa không vào ATP ngay.
Người tạo/người nhập không tự xử lý được.
Người có quyền xử lý tạo adjustment.
Audit log đầy đủ.
Test UI:
/task hiển thị đúng từng tab.
/voucher không còn thao tác nghiệp vụ chính.
Drawer nhận/soạn hàng vẫn hoạt động sau khi chuyển sang /task.
Tab hàng hỏng/chênh lệch cập nhật realtime nếu dùng Firestore listener.
Thứ Tự Ưu Tiên Triển Khai
Chốt inventory bucket rule.
Hoàn thiện backend tạo NonconformityReport.
Thêm transaction chuyển ATP/on_hold/quarantine.
Tạo tab Hàng hỏng / Chênh lệch trong /task.
Tạo drawer xử lý ngoại lệ.
Chuyển action thao tác từ /voucher sang /task.
Hoàn thiện adjustment approval.
Bổ sung audit, permission, test.
Kế hoạch này nên triển khai theo hướng “ít phá vỡ”: giữ nguyên Product, tận dụng Inventory, NonconformityReport, QuarantineRecord, AdjustmentVoucher, rồi refactor dần /task thành trung tâm thao tác.