# Bản nháp Information Architecture JPULSE

Bộ sơ đồ mô tả các khu vực chức năng ở góc nhìn người dùng theo SRS-JPULSE. Các tên có nhãn **Menu** được đối chiếu với `HUONG_DAN_SU_DUNG_HE_THONG.md`; nhãn **SRS** là nhóm chức năng được mô tả trong SRS nhưng chưa xác nhận là tên menu hoặc đường dẫn hiện hành. Chức năng bán hàng của **JPOS** không nằm trong cây JPULSE. Phân hệ K là chức năng quản trị thiết bị và cấu hình POS ở phía JPULSE theo hình Use Case 4-19.

## Tệp bàn giao

- `00-tong-quan.svg/png`: tổng quan 11 phân hệ.
- `A-chi-tiet` đến `K-chi-tiet` (`.svg` và `.png`): 11 sơ đồ chi tiết, mã và màu đồng nhất.
- `F01-luong` đến `F08-luong` (`.svg` và `.png`): 8 luồng nghiệp vụ có thứ tự bước trong SRS §3.1.
- `JPULSE-IA.pdf`: bộ sơ đồ 20 trang để chèn tài liệu.
- `bang-trich-xuat-srs.csv`: 216 dòng trích xuất, gồm 194 Use Case của bảng 4.2 và 22 chức năng từ hình 4.1.19–20. Cột cuối nêu ô sơ đồ, luồng hoặc lý do không đưa vào cây chức năng.
- `bang-phan-quyen.csv`: vai trò theo trách nhiệm nghiệp vụ trong SRS §3.2; quyền thực tế vẫn phụ thuộc RBAC và phạm vi cơ sở.
- `can-xac-nhan.md`: thiếu thông tin và điểm khác biệt giữa các nguồn.

Các SVG gồm nhóm, ô và chữ riêng biệt, có thể mở/chỉnh sửa bằng trình biên tập SVG hoặc nhập vào diagrams.net. Các mã `A1`–`K6` là mã sơ đồ do tài liệu này gán. SRS không cung cấp mã riêng cho từng Use Case trong các bảng §4.2; mã `SRS-4.2.x-yy` trong CSV là mã trích xuất, không phải mã yêu cầu gốc.

## Cách đọc

- Hình chữ nhật màu: phân hệ JPULSE. Ô trắng: màn hình đã có tên trong hướng dẫn hoặc nhóm chức năng từ SRS. Dòng nhỏ trong ô: thao tác của người dùng.
- Đường trong sơ đồ tổng quan thể hiện ranh giới hệ thống. Đường trong trang chi tiết thể hiện phân cấp màn hình → thao tác. Mũi tên trong các trang `Fxx` thể hiện thứ tự xử lý.
- Nhãn **SRS** không xác nhận đường điều hướng thực tế. Các mục này cần đối chiếu menu/giao diện hiện hành trước khi chốt bản kiến trúc.
- Nghỉ phép và voucher marketing chỉ có khi feature flag tương ứng được bật; tình trạng bật/tắt ở môi trường đích chưa được cung cấp.

## Kiểm tra bao phủ

Đã rà soát toàn bộ 17 bảng Use Case của §4.2, hình Use Case quản trị POS và voucher marketing của §4.1, các quy trình §3.1, các vai trò §3.2 và quy tắc §3.3. Mỗi dòng trích xuất có vị trí sơ đồ, vị trí luồng hoặc giải thích rõ vì sao là xử lý hệ thống/JPOS ngoài IA JPULSE. Bản này là **bản nháp** vì SRS chưa xác nhận đầy đủ tên màn hình và đường vào cho các nhóm chức năng ngoài phần hướng dẫn kho.
