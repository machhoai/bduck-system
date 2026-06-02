---
trigger: always_on
---

# 🎨 UI & Design System Rules (Extreme Data Density)

Hệ thống WMS là ứng dụng có mật độ dữ liệu cực cao (Extreme Data Density). Mục tiêu là hiển thị khối lượng thông tin khổng lồ trên một màn hình mà không cần cuộn. Tất cả code Frontend BẮT BUỘC tuân thủ các quy tắc kích thước dưới đây, tuyệt đối không dùng giá trị arbitrary (VD: `w-[15px]`, `text-[8px]`).

## 1. Typography (Hệ thống Cỡ chữ Nén)
Hệ thống sử dụng font mặc định sans-serif, bắt đầu từ kích thước siêu nhỏ (8px):

* **Micro text (`text-micro` - 8px):** CỠ CHỮ NHỎ NHẤT. Chỉ dùng cho các thông tin siêu phụ trợ: Version numbers, chú thích vi mô (asterisks), các Tag trạng thái bị nhồi nhét trong không gian cực hẹp, hoặc nhãn phụ của biểu đồ.
* **Nano text (`text-xxs` - 10px):** Dùng cho Tiêu đề cột của bảng dữ liệu (Table Headers - kết hợp `uppercase`, `tracking-wider` và `font-semibold`), Timestamp (ngày giờ phụ), hoặc mô tả phụ dưới tên sản phẩm.
* **Small text (`text-xs` - 12px):** Dùng cho Text trong các Badge trạng thái tiêu chuẩn, Tooltip, hoặc các Label của Form Input.
* **Base text (`text-sm` - 14px):** CỠ CHỮ CHUẨN cho dữ liệu chính. Bắt buộc dùng cho nội dung từng ô trong Bảng dữ liệu (Table Cells), nội dung nhập liệu (Form Inputs), và Menu điều hướng.
* **Card/Modal Titles (`text-base` - 16px):** Kết hợp `font-semibold`. Dùng làm tiêu đề cho các Drawer, Modal, Card, hoặc các khối chia nhóm (Section titles). 
* **Page Headers (`text-lg` - 18px):** Kết hợp `font-bold`. Chỉ dùng duy nhất cho Tiêu đề trang (Page Title) ở góc trên cùng. Không dùng cỡ chữ nào to hơn 18px trong hệ thống.

## 2. Spacing: Margin & Padding (Khoảng cách nén cực đại)
Hệ thống tuân thủ lưới nén để loại bỏ tối đa không gian chết (White space).

* **Khoảng cách vi mô (Micro):** Dùng `gap-0.5` hoặc `gap-1` (2px, 4px) giữa icon cỡ nhỏ (12px-14px) và text 8px/10px.
* **Padding Form/Table:** Dùng `p-1.5` hoặc `p-2` (6px, 8px) cho các ô trong bảng (Table cells). Các dòng phải nằm sát nhau nhất có thể mà không bị dính nét.
* **Padding Container (Standard):** Dùng `p-3` hoặc `p-4` (12px, 16px) cho padding bên trong Card, Modal, và Drawer. 
* **Khoảng cách vĩ mô (Layout):** Dùng `gap-3` hoặc `gap-4` (12px, 16px) giữa các khối Component lớn trên màn hình.

## 3. Buttons & Elements (Nút bấm & Khối tương tác)
Các thành phần tương tác phải cực kỳ nhỏ gọn nhưng vẫn đủ vùng click (hitbox) bằng cách tận dụng padding chuẩn.

* **Nút tiêu chuẩn (Primary/Secondary):** Dùng `h-8` (32px) kết hợp `px-3`, text `text-sm`. 
* **Nút siêu nhỏ (Table Actions):** Dùng `h-6` (24px) kết hợp `px-2`, text `text-xxs` (10px) hoặc `text-xs` (12px). BẮT BUỘC dùng cỡ này khi đặt nút bên trong các hàng của bảng dữ liệu (Data Grid) để bảo toàn chiều cao của hàng.
* **Inputs/Selects:** Chiều cao của các ô nhập liệu đồng bộ với Nút tiêu chuẩn là `h-8` (32px).
* **Max-Width Constraint:** Các nút hành động KHÔNG được tự động kéo giãn vô hạn `w-full` trên màn hình desktop. Sử dụng `w-fit` để nút ôm sát nội dung.

## 4. Bố cục Full-Width (Fluid Layout) & Cấm Max-Width
Hệ thống WMS cần tận dụng tối đa diện tích hiển thị chiều ngang để chứa nhiều cột dữ liệu.
* **Luật Cấm Tuyệt Đối (Strict Prohibition):** KHÔNG ĐƯỢC SỬ DỤNG class `max-w-*` (ví dụ: `max-w-md`, `max-w-7xl`, `max-w-screen-xl`, `max-w-[300px]`) dưới mọi hình thức ở bất kỳ component nào (Container, Form, Table, Header, v.v.).
* **Giải pháp thay thế:** Các giao diện phải luôn lấp đầy màn hình hoặc thẻ cha (`w-full`, `flex-1`).
* **NGOẠI LỆ DUY NHẤT (Modals/Drawers):** Chỉ có các Modal (Cửa sổ nổi giữa màn hình) hoặc Drawer (Cửa sổ trượt) mới được phép giới hạn độ rộng. Khi đó, sử dụng `w-[90%]` hoặc `max-w-[90%]` đối với các modal lớn, hoặc `w-[500px]` với modal nhỏ. Không dùng max-w cho bất kỳ thứ gì khác.