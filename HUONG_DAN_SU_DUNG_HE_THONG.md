# Hướng dẫn sử dụng hệ thống WMS

Tài liệu này mô tả các khu vực hiển thị và thao tác chính trong hệ thống quản lý kho WMS. Nội dung được biên soạn theo giao diện hiện có trong source code frontend, gồm phần hướng dẫn thao tác và ghi chú ảnh cần chụp để hoàn thiện tài liệu bàn giao.

## 1. Tổng quan giao diện

Sau khi đăng nhập, người dùng làm việc trong giao diện Dashboard gồm 3 khu vực chính:

- **Sidebar bên trái**: dùng để chuyển nhanh giữa các phân hệ.
- **Topbar phía trên**: hiển thị điều hướng theo trang, thông tin thời gian, trạng thái thiết bị, xuất Excel theo ngữ cảnh, hướng dẫn sử dụng và thông báo.
- **Khu vực nội dung chính**: hiển thị trang chức năng đang được chọn.

Các menu hiển thị phụ thuộc vào quyền của tài khoản. Nếu người dùng không có quyền với một phân hệ, phân hệ đó sẽ không xuất hiện hoặc hệ thống sẽ hiển thị trạng thái không có quyền truy cập.

**Ảnh cần chụp:** toàn màn hình sau khi đăng nhập thành công.  
**Khoanh/chú thích:** khoanh sidebar, topbar, vùng nội dung chính; ghi chú “Menu thay đổi theo quyền người dùng”.

## 2. Sidebar

Sidebar là thanh điều hướng nằm bên trái màn hình desktop. Trên mobile, các mục quan trọng sẽ nằm ở thanh điều hướng dưới cùng, nút **Thêm** mở danh sách menu còn lại.

Sidebar gồm:

- **Logo hệ thống** ở phía trên.
- Nhóm **Điều hướng** gồm các phân hệ: Trang chủ, Kho hàng, Báo cáo chi phí, Thông báo, Việc cần xử lý, Tạo lệnh, Thư viện tệp, Sản phẩm, Quy trình, Nhập liệu chi phí, Người dùng, Audit log.
- **Hồ sơ người dùng** ở cuối sidebar: bấm vào để mở trang Hồ sơ cá nhân.
- **Chuyển ngôn ngữ**.
- **Thu gọn/Mở rộng sidebar**.
- **Đăng xuất**.

Một số menu có badge số lượng:

- **Việc cần xử lý**: số việc đang chờ người dùng xử lý.
- **Tạo lệnh**: số lệnh đang cần theo dõi.

**Thao tác cơ bản:**

1. Bấm vào tên phân hệ trên sidebar để mở trang.
2. Bấm nút mũi tên ở mép sidebar để thu gọn hoặc mở rộng.
3. Bấm avatar/tên người dùng để vào Hồ sơ cá nhân.
4. Bấm biểu tượng đăng xuất để thoát khỏi hệ thống.

**Ảnh cần chụp:** sidebar ở trạng thái mở rộng và trạng thái thu gọn.  
**Khoanh/chú thích:** khoanh logo, menu, badge số lượng, hồ sơ người dùng, nút thu gọn/mở rộng, nút đổi ngôn ngữ, nút đăng xuất.

## 3. Topbar

Topbar nằm phía trên vùng nội dung, luôn xuất hiện khi người dùng ở trong dashboard.

Topbar gồm:

- **Nút quay lại**: xuất hiện khi không ở trang chủ.
- **Breadcrumb**: thể hiện vị trí hiện tại trong hệ thống.
- **Đồng hồ/Thời tiết**.
- **Trạng thái thiết bị**.
- **Xuất Excel**: chỉ hiển thị khi trang hiện tại có dữ liệu hỗ trợ xuất.
- **Nút hướng dẫn sử dụng**: biểu tượng dấu hỏi, mở tour hướng dẫn cho trang hiện tại.
- **Chuông thông báo**: xem thông báo hệ thống.

**Thao tác cơ bản:**

1. Bấm nút quay lại để trở về màn hình trước đó.
2. Bấm **Xuất Excel** để tải dữ liệu đang hiển thị trên trang, ví dụ danh sách sản phẩm hoặc audit log.
3. Bấm biểu tượng **?** để chạy hướng dẫn thao tác trên giao diện.
4. Bấm chuông thông báo để xem thông báo mới.

**Ảnh cần chụp:** topbar tại trang bất kỳ có nút Xuất Excel, ví dụ Sản phẩm hoặc Audit log.  
**Khoanh/chú thích:** khoanh breadcrumb, nút Xuất Excel, nút hướng dẫn, chuông thông báo, trạng thái thiết bị.

## 4. Trang chủ

Đường dẫn: **Trang chủ** hoặc `/dashboard`.

Trang chủ là dashboard tổng hợp tồn kho và chi phí. Người dùng có thể chọn xem toàn bộ kho hoặc một kho cụ thể.

Thông tin hiển thị:

- Lời chào người dùng.
- Bộ chọn kho: toàn bộ kho hoặc từng kho.
- Nhóm widget chi phí nếu tài khoản có quyền xem chi phí.
- Các thẻ KPI tồn kho.
- Biểu đồ phân bổ tồn kho theo loại sản phẩm.
- Biểu đồ so sánh tồn kho giữa các kho khi đang xem toàn bộ kho.
- Biểu đồ xu hướng tồn kho khi đang xem một kho cụ thể.
- Bảng sản phẩm tồn thấp.
- Bảng sản phẩm có tồn nhiều nhất/ít nhất.
- Popup chi tiết theo kho khi bấm vào thẻ KPI ở chế độ toàn bộ kho.

**Thao tác:**

1. Vào **Trang chủ** từ sidebar.
2. Chọn kho trong bộ lọc ở góc phải phần tiêu đề.
3. Bấm vào một thẻ KPI để xem phân rã theo kho nếu đang ở chế độ toàn bộ kho.
4. Theo dõi bảng tồn thấp để xử lý các sản phẩm cần bổ sung.

**Ảnh cần chụp:** trang chủ ở chế độ toàn bộ kho.  
**Khoanh/chú thích:** khoanh bộ chọn kho, nhóm KPI, biểu đồ, bảng tồn thấp và bảng xếp hạng sản phẩm.

**Ảnh cần chụp thêm:** popup chi tiết sau khi bấm một KPI.  
**Khoanh/chú thích:** khoanh tên chỉ số và danh sách phân rã theo kho.

## 5. Tạo lệnh / Quản lý lệnh

Đường dẫn: **Tạo lệnh** hoặc `/vouchers`.

Trang này dùng để tạo và theo dõi 3 loại lệnh:

- Phiếu nhập kho.
- Phiếu xuất kho.
- Lệnh điều chuyển.

Trang có 3 tab:

- **Tạo mới**: tạo phiếu/lệnh mới.
- **Đang xử lý**: danh sách lệnh nháp, chờ duyệt, đã duyệt hoặc đang ở bước thao tác.
- **Hoàn thành**: lịch sử lệnh đã hoàn thành, bị hủy hoặc bị từ chối.

Phía trên trang có các chỉ số nhanh về số lệnh đang xử lý, chờ duyệt và hoàn thành.

### 5.1. Tạo phiếu nhập kho

Trong tab **Tạo mới**, chọn **Phiếu nhập kho**. Hệ thống hiển thị wizard 4 bước:

1. **Thông tin**: chọn kho nhận, nhập nhà cung cấp, mã PO nếu có, ghi chú.
2. **Tải chứng từ**: tải tệp đính kèm nếu quy trình yêu cầu chứng từ.
3. **Sản phẩm**: tìm sản phẩm theo tên, SKU hoặc barcode; bấm **Thêm vào phiếu**; nhập số lượng dự kiến, đơn giá, tình trạng, vị trí kho và ghi chú.
4. **Xác nhận**: kiểm tra kho, nhà cung cấp, PO, ghi chú, số tệp, số sản phẩm, tổng số lượng và tổng giá trị; bấm gửi duyệt/hoàn tất theo cấu hình.

Hệ thống có hỗ trợ nhập danh sách sản phẩm từ Excel và gán nhanh vị trí kho.

**Ảnh cần chụp:** tab Tạo mới khi đang chọn Phiếu nhập kho.  
**Khoanh/chú thích:** khoanh 3 nút chọn loại phiếu, thanh 4 bước, nút Tiếp theo.

**Ảnh cần chụp:** bước Sản phẩm của phiếu nhập.  
**Khoanh/chú thích:** khoanh ô tìm sản phẩm, nút Thêm vào phiếu, danh sách sản phẩm đã chọn, trường số lượng, đơn giá, tình trạng, vị trí kho.

### 5.2. Tạo phiếu xuất kho

Trong tab **Tạo mới**, chọn **Phiếu xuất kho**. Wizard gồm 4 bước:

1. **Thông tin**: chọn loại xuất, kho xuất/kho thực hiện, kho đích nếu là điều chuyển, nhập lý do hoặc ghi chú.
2. **Tải chứng từ**: tải chứng từ xuất kho nếu cần.
3. **Sản phẩm**: tìm sản phẩm còn tồn khả dụng, bấm **Thêm vào phiếu**, chọn vị trí kho và số lượng xuất. Hệ thống hiển thị số lượng khả dụng và cảnh báo nếu xuất vượt tồn khả dụng.
4. **Xác nhận**: kiểm tra loại xuất, kho nguồn, kho đích, số chứng từ và số mặt hàng trước khi bấm **Gửi duyệt**.

**Ảnh cần chụp:** bước Thông tin của phiếu xuất.  
**Khoanh/chú thích:** khoanh loại xuất, kho nguồn/kho đích, ghi chú/lý do điều chỉnh.

**Ảnh cần chụp:** bước Sản phẩm có cảnh báo tồn khả dụng nếu có dữ liệu phù hợp.  
**Khoanh/chú thích:** khoanh số ATP/khả dụng và cảnh báo vượt tồn.

### 5.3. Tạo lệnh điều chuyển

Trong tab **Tạo mới**, chọn **Lệnh điều chuyển**. Có 2 loại:

- **Trong kho**: chuyển hàng giữa các vị trí trong cùng một kho, có thể thực hiện ngay theo cấu hình.
- **Liên kho**: chuyển hàng từ kho nguồn sang kho đích, thường đi qua quy trình duyệt.

Wizard gồm:

1. **Thông tin**: chọn loại điều chuyển, kho thực hiện hoặc kho nguồn/kho đích, nhập ghi chú.
2. **Chứng từ**: tải chứng từ nếu cần.
3. **Sản phẩm**: chọn sản phẩm có tồn khả dụng, chọn vị trí nguồn, vị trí đích và số lượng.
4. **Xác nhận**: xem bản đồ tuyến chuyển đối với liên kho, tổng số lượng, chứng từ và danh sách mặt hàng; bấm **Xác nhận điều chuyển** hoặc **Gửi duyệt**.

**Ảnh cần chụp:** màn hình chọn loại điều chuyển.  
**Khoanh/chú thích:** khoanh hai lựa chọn Trong kho/Liên kho và các trường kho nguồn/kho đích.

**Ảnh cần chụp:** bước Xác nhận điều chuyển liên kho.  
**Khoanh/chú thích:** khoanh bản đồ tuyến chuyển, bảng tóm tắt, nút Gửi duyệt.

### 5.4. Tab Đang xử lý

Tab **Đang xử lý** hiển thị các lệnh theo nhóm ngày. Mỗi thẻ lệnh hiển thị:

- Mã lệnh.
- Loại lệnh: nhập, xuất, điều chuyển.
- Kho liên quan.
- Trạng thái.
- Người tạo.
- Thời gian tạo.
- Người duyệt nếu có.
- Nút **Tiếp tục** khi lệnh đã được duyệt và tài khoản có quyền xử lý phiên nhận hàng hoặc soạn hàng.

Bộ lọc gồm:

- Ô tìm kiếm theo mã lệnh hoặc ghi chú.
- Lọc theo loại: Tất cả, Nhập kho, Xuất kho, Điều chuyển.
- Sắp xếp mới nhất hoặc cũ nhất.

**Thao tác:**

1. Bấm vào thẻ lệnh để mở drawer chi tiết.
2. Bấm **Tiếp tục** với phiếu nhập đã duyệt để vào phiên kiểm đếm thực nhận.
3. Bấm **Tiếp tục** với phiếu xuất đã duyệt để vào phiên soạn hàng.
4. Trong drawer chi tiết, có thể xem thông tin, tạo lại hoặc sửa phiếu nếu được phép.

**Ảnh cần chụp:** tab Đang xử lý có nhiều thẻ lệnh.  
**Khoanh/chú thích:** khoanh ô tìm kiếm, bộ lọc loại, trạng thái trên thẻ, nút Tiếp tục.

### 5.5. Tab Hoàn thành

Tab **Hoàn thành** hiển thị lịch sử lệnh. Bộ lọc gồm:

- Tìm kiếm.
- Loại lệnh.
- Người tạo.
- Người duyệt.
- Thứ tự sắp xếp.

Bấm vào một thẻ để mở drawer chi tiết và xem lại dữ liệu lệnh. Có thể dùng chức năng **Tạo lại** để tạo lệnh mới dựa trên dữ liệu cũ.

**Ảnh cần chụp:** tab Hoàn thành.  
**Khoanh/chú thích:** khoanh vùng lọc nâng cao, nhóm ngày, thẻ lệnh, drawer chi tiết.

## 6. Việc cần xử lý

Đường dẫn: **Việc cần xử lý** hoặc `/tasks`.

Trang này là inbox phê duyệt và xử lý tác vụ của người dùng.

Thông tin hiển thị:

- Tổng số việc đang chờ.
- Số việc liên quan phiếu nhập.
- Số việc liên quan phiếu xuất.
- Bộ lọc loại tác vụ: Tất cả, Nhập kho, Xuất kho, Điều chuyển, Purchase Order.
- Danh sách task dạng thẻ.
- Panel tóm tắt ở bên phải trên màn hình lớn.

**Thao tác:**

1. Vào **Việc cần xử lý**.
2. Chọn bộ lọc loại tác vụ nếu cần.
3. Bấm vào một thẻ task để mở drawer chi tiết.
4. Trong drawer, xem thông tin lệnh, chứng từ, lịch sử và thực hiện phê duyệt/từ chối theo quyền.

**Ảnh cần chụp:** trang Việc cần xử lý.  
**Khoanh/chú thích:** khoanh 3 thẻ thống kê, bộ lọc loại tác vụ, một thẻ task và panel tóm tắt.

**Ảnh cần chụp thêm:** drawer chi tiết task.  
**Khoanh/chú thích:** khoanh vùng thông tin lệnh, nút phê duyệt/từ chối, khu vực ghi chú.

## 7. Kho hàng

Đường dẫn: **Kho hàng** hoặc `/warehouses`.

Trang Kho hàng có 2 tab:

- **Kho hàng**: quản lý kho và vị trí lưu trữ.
- **Tổ chức**: quản lý tổ chức liên quan đến kho.

Trong tab Kho hàng có 3 chế độ xem:

- **Bản đồ**.
- **Lưới**.
- **Danh sách**.

Thông tin kho hiển thị:

- Tên kho.
- Mã kho.
- Loại kho.
- Trạng thái.
- Số vị trí.
- Địa chỉ.
- Nút **Chi tiết**.
- Nút sửa và xóa mềm.

**Tạo kho mới:**

1. Vào **Kho hàng**.
2. Bấm **Thêm kho**.
3. Nhập tổ chức, mã kho, tên kho, quản lý kho, loại, trạng thái, tọa độ, địa chỉ, ảnh kho và mô tả.
4. Bấm **Lưu**.

**Xem chi tiết kho:**

1. Bấm **Chi tiết** trên thẻ hoặc dòng kho.
2. Trang chi tiết hiển thị thông tin kho, mặt hàng tồn kho, vị trí trong kho và hoạt động gần đây.
3. Có thể thêm/sửa/xóa vị trí và giải trong kho nếu có quyền.

**Ảnh cần chụp:** trang Kho hàng ở chế độ Bản đồ.  
**Khoanh/chú thích:** khoanh nút đổi chế độ xem, tab Kho hàng/Tổ chức, marker hoặc danh sách kho trên bản đồ.

**Ảnh cần chụp:** modal Thêm kho.  
**Khoanh/chú thích:** khoanh các trường bắt buộc, upload ảnh kho, nút Hủy/Lưu.

**Ảnh cần chụp:** trang chi tiết kho.  
**Khoanh/chú thích:** khoanh thông tin kho, tab mặt hàng tồn kho, tab vị trí trong kho, nút thêm vị trí.

### 7.1. Xem tồn kho trong chi tiết kho

Chức năng xem tồn kho nằm bên trong trang chi tiết của từng kho.

**Cách vào màn hình tồn kho của kho:**

1. Vào **Kho hàng** từ sidebar.
2. Ở danh sách kho hoặc thẻ kho, bấm **Chi tiết** tại kho cần kiểm tra.
3. Trong trang chi tiết kho, chọn tab **Tồn kho**.

Thông tin hiển thị trong tab Tồn kho:

- Danh sách sản phẩm đang có tồn trong kho được chọn.
- Mã sản phẩm/SKU, tên sản phẩm, barcode nếu có và đơn vị tính.
- Số lượng **Khả dụng (ATP)**.
- Số lượng **Tạm giữ**.
- Số lượng **Chờ xuất**.
- Số lượng **Cách ly/Lỗi**.
- **Tổng số lượng** của từng sản phẩm trong kho.
- Đơn giá nếu tài khoản có quyền xem giá.
- Trạng thái tồn tối thiểu/cảnh báo theo chính sách tồn kho nếu có cấu hình.

Thanh công cụ trong tab Tồn kho hỗ trợ:

- Tìm kiếm theo tên sản phẩm hoặc mã SKU.
- Lọc theo loại sản phẩm.
- Lọc theo nguồn gốc sản phẩm.
- Lọc theo trạng thái tồn: tất cả, còn khả dụng, hết tồn, có hàng cách ly.
- Sắp xếp theo tổng tồn, ATP, tên sản phẩm hoặc giá.
- Đổi thứ tự tăng/giảm.
- Xóa bộ lọc.
- Chuyển chế độ xem: dạng thẻ, dạng danh sách hoặc dạng bảng.
- Xem số kết quả đang hiển thị trên tổng số sản phẩm.

**Các chế độ xem:**

- **Dạng thẻ**: phù hợp để kiểm tra nhanh bằng hình ảnh/nhận diện sản phẩm.
- **Dạng danh sách**: phù hợp khi cần quét nhanh nhiều sản phẩm cùng lúc.
- **Dạng bảng**: phù hợp khi cần xem dữ liệu tồn kho dày đặc và so sánh các cột số lượng.

**Xuất dữ liệu tồn kho:**

Khi tab Tồn kho có dữ liệu, topbar sẽ hiển thị nút **Xuất Excel**. Bấm nút này để tải danh sách tồn kho của kho hiện tại theo bộ lọc đang áp dụng.

**Thao tác kiểm tra tồn kho phổ biến:**

1. Mở chi tiết kho cần kiểm tra.
2. Chọn tab **Tồn kho**.
3. Nhập tên sản phẩm hoặc SKU vào ô tìm kiếm.
4. Chọn trạng thái tồn, ví dụ **Còn khả dụng** hoặc **Hết tồn**.
5. Chọn chế độ **Bảng** nếu cần so sánh ATP, tạm giữ, chờ xuất, cách ly và tổng tồn.
6. Bấm **Xuất Excel** nếu cần gửi hoặc lưu báo cáo tồn kho.

**Ảnh cần chụp:** trang chi tiết kho khi đang mở tab Tồn kho ở chế độ thẻ.  
**Khoanh/chú thích:** khoanh tab Tồn kho, thanh tìm kiếm/lọc, nút đổi chế độ xem, số kết quả và một thẻ sản phẩm tồn kho.

**Ảnh cần chụp:** tab Tồn kho ở chế độ bảng.  
**Khoanh/chú thích:** khoanh các cột ATP, Tạm giữ, Chờ xuất, Cách ly, Tổng; khoanh nút Xuất Excel trên topbar.

**Ảnh cần chụp:** ví dụ khi áp dụng bộ lọc tồn kho.  
**Khoanh/chú thích:** khoanh bộ lọc đang chọn, nút Xóa bộ lọc và số kết quả sau lọc.

## 8. Sản phẩm và Danh mục

Đường dẫn: **Sản phẩm** hoặc `/products`.

Trang có 2 tab:

- **Sản phẩm**.
- **Danh mục**.

### 8.1. Tab Sản phẩm

Thông tin hiển thị:

- Danh sách sản phẩm dạng card.
- Bộ lọc theo từ khóa, danh mục, loại, nguồn gốc, serial, tồn tối thiểu và sắp xếp.
- Nút **Sửa hàng loạt**.
- Nút **Thêm sản phẩm**.
- Nút xuất Excel ở topbar khi có dữ liệu.

**Tạo sản phẩm:**

1. Bấm **Thêm sản phẩm**.
2. Tab **Thông tin cơ bản**: chọn danh mục, loại hình, nhập tên sản phẩm, SKU, barcode, đơn vị, đơn giá, nguồn gốc, chất liệu, mô tả và ảnh.
3. Bật **Theo dõi số Serial** nếu mỗi đơn vị sản phẩm cần serial riêng. Lưu ý tùy chọn này không đổi sau khi tạo.
4. Tab **Định mức vật tư (BOM)**: thêm vật tư/phụ tùng cấu thành nếu sản phẩm có BOM.
5. Khi tạo mới có tab **Tạo bằng Excel** để import sản phẩm hàng loạt.
6. Bấm **Hoàn tất** hoặc **Lưu thay đổi**.

**Ảnh cần chụp:** tab Sản phẩm.  
**Khoanh/chú thích:** khoanh bộ lọc, nút Sửa hàng loạt, nút Thêm sản phẩm, một card sản phẩm.

**Ảnh cần chụp:** modal Thêm sản phẩm tab Thông tin cơ bản.  
**Khoanh/chú thích:** khoanh các trường bắt buộc, checkbox Serial, vùng upload ảnh, nút Hoàn tất.

**Ảnh cần chụp:** tab BOM trong modal sản phẩm.  
**Khoanh/chú thích:** khoanh nút Thêm vật tư, cột phụ tùng, số lượng, ghi chú.

### 8.2. Tab Danh mục

Tab Danh mục hiển thị cây danh mục sản phẩm, hỗ trợ tìm kiếm, thêm, sửa, xóa và kéo thả thay đổi phân cấp.

Thông tin trong danh mục:

- Tên danh mục.
- Mã danh mục.
- Loại danh mục.
- Danh mục cha.
- Mô tả.

**Tạo danh mục:**

1. Vào tab **Danh mục**.
2. Bấm **Thêm danh mục** hoặc **Thêm danh mục gốc**.
3. Nhập tên, mã, loại, danh mục cha nếu có và mô tả.
4. Bấm **Lưu**.

**Ảnh cần chụp:** tab Danh mục.  
**Khoanh/chú thích:** khoanh ô tìm kiếm, cây danh mục, nút thêm, nút sửa/xóa trên node.

**Ảnh cần chụp:** modal Thêm/Sửa danh mục.  
**Khoanh/chú thích:** khoanh tên, mã, loại, danh mục cha, mô tả, nút Lưu.

## 9. Thư viện tệp

Đường dẫn: **Thư viện tệp** hoặc `/file-library`.

Trang này tổng hợp chứng từ đã tải lên từ phiếu nhập, phiếu xuất và lệnh điều chuyển.

Thông tin hiển thị:

- Tổng số tệp.
- Số lượng theo định dạng PDF, DOCX, XLSX, CSV.
- Bộ lọc tìm kiếm theo tên tệp, người upload, mã lệnh, mục đích.
- Bộ lọc nguồn: lệnh nhập, lệnh xuất, điều chuyển.
- Bộ lọc định dạng tệp.
- Bảng tệp với tên tệp, loại, người upload, ngày upload, mục đích, lệnh liên quan và thao tác.

**Thao tác:**

1. Dùng ô tìm kiếm hoặc bộ lọc để tìm chứng từ.
2. Bấm **Mở tệp** để xem.
3. Bấm **Tải xuống** để tải file về máy.

**Ảnh cần chụp:** trang Thư viện tệp.  
**Khoanh/chú thích:** khoanh thẻ thống kê định dạng, toolbar lọc, bảng tệp, nút Mở tệp/Tải xuống.

## 10. Báo cáo chi phí

Đường dẫn: **Báo cáo chi phí** hoặc `/expenses`.

Trang báo cáo chi phí hiển thị dữ liệu phân tích theo kho và kỳ báo cáo.

Thông tin hiển thị:

- KPI doanh thu gộp, tổng chi phí, lợi nhuận ròng, biên lợi nhuận.
- Thống kê theo nhóm chi phí.
- Biểu đồ xu hướng chi phí.
- Biểu đồ phân bổ chi phí.
- Biểu đồ doanh thu so với chi phí.
- Bảng top chi phí với các chế độ xem: cao nhất, tăng nhiều nhất, thấp nhất.
- Cảnh báo cửa hàng vượt ngân sách khi xem toàn bộ kho.

**Thao tác:**

1. Vào **Báo cáo chi phí**.
2. Chọn kho/kỳ báo cáo ở shell chi phí nếu có.
3. Bấm vào một thẻ nhóm chi phí để mở modal chi tiết.
4. Dùng bảng top chi phí để chuyển chế độ xem.

**Ảnh cần chụp:** trang Báo cáo chi phí.  
**Khoanh/chú thích:** khoanh KPI, nhóm chi phí, biểu đồ xu hướng, biểu đồ phân bổ, bảng top chi phí.

## 11. Nhập liệu chi phí

Đường dẫn: **Nhập liệu chi phí** hoặc `/expenses/entry`.

Trang này dùng để nhập ngân sách và thực chi cho từng kho theo kỳ.

Lưu ý: khi chọn **Tất cả cửa hàng**, hệ thống chỉ cho xem tổng hợp. Muốn nhập liệu cần chọn một cửa hàng/kho cụ thể.

Thông tin hiển thị:

- Trạng thái kỳ: mở hoặc đã khóa.
- Kỳ và kho đang nhập liệu.
- Nút **Khóa kỳ** hoặc **Mở lại kỳ** theo quyền.
- Panel import Excel.
- Bảng nhập liệu theo nhóm chi phí.
- Các dòng chi phí cố định và dòng chi phí tự tạo.

**Thao tác:**

1. Chọn một kho cụ thể.
2. Nhập ngân sách/thực chi vào bảng.
3. Thêm dòng chi phí tự tạo nếu cần.
4. Dùng import Excel để nhập nhanh.
5. Khi hoàn tất, bấm **Khóa kỳ** nếu có quyền. Nếu cần sửa lại kỳ đã khóa, bấm **Mở lại kỳ** nếu có quyền.

**Ảnh cần chụp:** trang Nhập liệu chi phí khi chọn kho cụ thể.  
**Khoanh/chú thích:** khoanh trạng thái kỳ, nút Khóa kỳ/Mở lại kỳ, panel import Excel, bảng nhập liệu.

**Ảnh cần chụp:** thông báo khi chọn Tất cả cửa hàng.  
**Khoanh/chú thích:** khoanh thông báo “chọn cửa hàng cụ thể để nhập liệu”.

## 12. Thông báo

Đường dẫn: **Thông báo** hoặc `/notification`.

Trang Thông báo dùng để gửi thông báo nội bộ hoặc email và xem lịch sử gửi.

Có 2 kênh gửi:

- **Thông báo trong hệ thống**.
- **Email**.

Thông báo trong hệ thống gồm:

- Người nhận theo user.
- Người nhận theo vai trò.
- Tiêu đề.
- Nội dung.
- Mức ưu tiên.
- Link hành động nếu có.

Email gồm:

- To, CC, BCC.
- Tiêu đề.
- Nội dung email bằng trình soạn thảo.

Bên phải là panel lịch sử gửi nếu tài khoản có quyền xem.

**Thao tác:**

1. Vào **Thông báo**.
2. Chọn tab gửi trong hệ thống hoặc email.
3. Nhập người nhận và nội dung.
4. Bấm gửi.
5. Theo dõi lịch sử gửi ở panel bên phải.

**Ảnh cần chụp:** trang Thông báo tab thông báo trong hệ thống.  
**Khoanh/chú thích:** khoanh tab kênh gửi, vùng chọn người nhận, tiêu đề/nội dung, nút gửi, lịch sử gửi.

**Ảnh cần chụp:** tab Email.  
**Khoanh/chú thích:** khoanh To/CC/BCC, subject, editor nội dung, nút gửi.

## 13. Người dùng và phân quyền

Đường dẫn: **Người dùng** hoặc `/users`.

Trang này là workspace quản trị tài khoản và vai trò. Hệ thống chỉ hiển thị tab mà tài khoản có quyền đọc.

Màn hình gồm:

- Thẻ tổng quan quyền truy cập cho **Người dùng**.
- Thẻ tổng quan quyền truy cập cho **Vai trò**.
- Panel quản lý tương ứng bên dưới.

### 13.1. Quản lý người dùng

Thông tin hiển thị:

- Họ tên.
- Username.
- Email.
- Mã nhân viên.
- Vai trò và phạm vi kho.
- Trạng thái tài khoản.
- Nút gửi lại email mời.
- Nút sửa.
- Nút xóa.

**Tạo người dùng:**

1. Bấm **Thêm người dùng**.
2. Nhập thông tin tài khoản.
3. Gán vai trò và phạm vi quản lý.
4. Bấm **Lưu**.
5. Hệ thống gửi email mời nếu cấu hình email hoạt động.

**Ảnh cần chụp:** tab Người dùng.  
**Khoanh/chú thích:** khoanh nút Thêm người dùng, ô tìm kiếm, một dòng người dùng, các nút gửi lại lời mời/sửa/xóa.

### 13.2. Quản lý vai trò

Trang vai trò có 2 chế độ xem:

- **Cây phân cấp**.
- **Board**.

Thông tin hiển thị:

- Tên vai trò.
- Màu đại diện.
- Số quyền được bật.
- Quan hệ cha/con nếu có.
- Nút sửa/xóa.

**Tạo vai trò:**

1. Bấm **Thêm vai trò**.
2. Nhập tên, màu, vai trò cha nếu có.
3. Chọn các quyền trong registry quyền.
4. Bấm **Lưu**.

Ở chế độ board, nếu có quyền ghi, người dùng có thể kéo thả vị trí thẻ vai trò để sắp xếp.

**Ảnh cần chụp:** tab Vai trò chế độ cây.  
**Khoanh/chú thích:** khoanh nút Tree/Board, nút Thêm vai trò, dòng vai trò, số quyền, nút sửa/xóa.

**Ảnh cần chụp:** modal Thêm/Sửa vai trò.  
**Khoanh/chú thích:** khoanh thông tin vai trò và vùng chọn quyền.

## 14. Quy trình

Đường dẫn: **Quy trình** hoặc `/process-configs`.

Trang Quy trình dùng để cấu hình luồng duyệt và các yêu cầu vận hành cho từng loại nghiệp vụ.

Thông tin hiển thị:

- Số quy trình đã cấu hình.
- Số quy trình còn thiếu.
- Số quy trình đang bật tự động duyệt.
- Danh sách loại nghiệp vụ ở bên trái.
- Panel cấu hình chi tiết ở bên phải.

Trong panel chi tiết có:

- Pipeline cố định: bắt đầu, duyệt hoặc tự duyệt, bước thao tác, hoàn tất.
- Bật/tắt **Tự động duyệt**.
- Bật/tắt **Bắt buộc chứng từ**.
- Bật/tắt **Bắt buộc OTP**.
- Cấu hình chuỗi phê duyệt theo cấp và vai trò.
- Cấu hình người xử lý bước vận hành như nhận hàng hoặc soạn hàng.
- Nút **Lưu**.

Nếu một loại nghiệp vụ chưa có cấu hình, hệ thống hiển thị nút tạo cấu hình mặc định.

**Thao tác:**

1. Vào **Quy trình**.
2. Chọn loại nghiệp vụ bên trái.
3. Nếu chưa có cấu hình, bấm tạo cấu hình mặc định.
4. Chỉnh tự động duyệt, yêu cầu chứng từ, OTP, vai trò duyệt và người xử lý.
5. Bấm **Lưu**.

**Ảnh cần chụp:** trang Quy trình.  
**Khoanh/chú thích:** khoanh 3 thẻ thống kê, danh sách loại nghiệp vụ, pipeline, nút Lưu.

**Ảnh cần chụp:** phần chuỗi phê duyệt và bước xử lý.  
**Khoanh/chú thích:** khoanh cấp duyệt, dropdown vai trò, assignment mode của bước vận hành.

## 15. Audit log

Đường dẫn: **Audit log** hoặc `/audit-logs`.

Trang Audit log dùng để tra cứu lịch sử thao tác trong hệ thống.

Thông tin hiển thị:

- Tổng số log.
- Số log đang hiển thị theo bộ lọc.
- Số entity.
- Số user.
- Bộ lọc tìm kiếm.
- Lọc theo entity type, entity id, warehouse id, user id, action, khoảng ngày, trạng thái dữ liệu thay đổi và thứ tự sắp xếp.
- Danh sách log.
- Panel chi tiết log.
- Phân trang và chọn số dòng mỗi trang.
- Nút **Xuất Excel** trên topbar khi có dữ liệu.

**Thao tác:**

1. Vào **Audit log**.
2. Dùng bộ lọc để tìm thao tác cần kiểm tra.
3. Bấm một log trong danh sách để xem chi tiết bên phải.
4. Dùng phân trang để xem thêm dữ liệu.
5. Bấm **Xuất Excel** ở topbar để tải danh sách log đã lọc.

**Ảnh cần chụp:** trang Audit log.  
**Khoanh/chú thích:** khoanh thẻ thống kê, bộ lọc, danh sách log, panel chi tiết, nút Xuất Excel ở topbar.

## 16. Hồ sơ cá nhân

Đường dẫn: bấm vào avatar/tên người dùng ở sidebar hoặc `/profile`.

Trang Hồ sơ cá nhân hiển thị:

- Thông tin chung: họ tên, mã nhân viên, username, email, ngày tham gia, trạng thái.
- Nút **Đổi mật khẩu**.
- Trạng thái xác thực 2 lớp Google Authenticator.
- Nút **Liên kết** nếu chưa bật 2FA.
- Vai trò và phạm vi quản lý của người dùng.

**Thao tác:**

1. Bấm avatar/tên người dùng ở sidebar.
2. Bấm **Đổi mật khẩu** để gửi yêu cầu đổi mật khẩu.
3. Nếu chưa bật 2FA, bấm **Liên kết** để mở modal thiết lập Google Authenticator.
4. Kiểm tra vai trò và phạm vi kho ở cột bên phải.

**Ảnh cần chụp:** trang Hồ sơ cá nhân.  
**Khoanh/chú thích:** khoanh thông tin chung, nút Đổi mật khẩu, khu vực 2FA, danh sách vai trò/phạm vi.

## 17. Gợi ý chuẩn chụp màn hình cho tài liệu

Để tài liệu dễ đọc và nhất quán, nên chụp theo cùng một chuẩn:

- Chụp màn hình desktop ở độ phân giải rộng để thấy sidebar và topbar.
- Với modal/drawer, chụp cả nền phía sau để người dùng hiểu ngữ cảnh mở modal.
- Với hướng dẫn thao tác, khoanh bằng màu đỏ hoặc vàng các nút cần bấm.
- Với bảng dữ liệu, khoanh hàng mẫu và cột thao tác.
- Với wizard nhiều bước, khoanh thanh bước và nút **Tiếp theo/Gửi duyệt/Lưu**.
- Với mobile, chụp thêm bottom nav và nút **Thêm** nếu tài liệu phục vụ người dùng mobile.

## 18. Danh sách ảnh nên chuẩn bị

1. Toàn cảnh giao diện sau đăng nhập.
2. Sidebar mở rộng và sidebar thu gọn.
3. Topbar có nút Xuất Excel.
4. Trang chủ toàn bộ kho.
5. Popup chi tiết KPI trang chủ.
6. Tạo phiếu nhập bước Thông tin.
7. Tạo phiếu nhập bước Sản phẩm.
8. Tạo phiếu xuất bước Thông tin.
9. Tạo phiếu xuất bước Sản phẩm có ATP.
10. Tạo lệnh điều chuyển bước Thông tin.
11. Tạo lệnh điều chuyển bước Xác nhận.
12. Tab Đang xử lý của trang Tạo lệnh.
13. Drawer chi tiết lệnh.
14. Tab Hoàn thành và bộ lọc nâng cao.
15. Trang Việc cần xử lý.
16. Drawer chi tiết việc cần xử lý.
17. Trang Kho hàng chế độ bản đồ.
18. Modal Thêm kho.
19. Trang chi tiết kho.
20. Tab Tồn kho trong chi tiết kho ở chế độ thẻ.
21. Tab Tồn kho trong chi tiết kho ở chế độ bảng.
22. Tab Tồn kho sau khi áp dụng bộ lọc.
23. Trang Sản phẩm.
24. Modal Thêm sản phẩm.
25. Tab BOM sản phẩm.
26. Tab Danh mục sản phẩm.
27. Modal Thêm danh mục.
28. Trang Thư viện tệp.
29. Trang Báo cáo chi phí.
30. Trang Nhập liệu chi phí.
31. Trang Thông báo tab trong hệ thống.
32. Trang Thông báo tab Email.
33. Trang Người dùng.
34. Trang Vai trò.
35. Modal Thêm/Sửa vai trò.
36. Trang Quy trình.
37. Cấu hình chuỗi phê duyệt.
38. Trang Audit log.
39. Trang Hồ sơ cá nhân.
