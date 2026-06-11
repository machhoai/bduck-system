import type { Tour } from "nextstepjs";

export const tours: Tour[] = [
  {
    tour: "dashboardTour",
    steps: [
      {
        icon: "👋",
        title: "Chào mừng",
        content: "Chào mừng bạn đến với hệ thống WMS! Đây là trang tổng quan. Tại đây bạn có thể xem các thông tin thống kê nhanh về hệ thống.",
        selector: "#wms-main-content",
        side: "top",
        showControls: true,
        showSkip: true,
      },
      {
        icon: "🧭",
        title: "Thanh điều hướng",
        content: "Đây là thanh menu chính. Bạn có thể sử dụng nó để điều hướng đến các chức năng khác nhau như Quản lý phiếu, Kho bãi, Hàng hoá...",
        selector: "#wms-sidebar",
        side: "right",
        showControls: true,
        showSkip: true,
      },
      {
        icon: "⚙️",
        title: "Thanh công cụ",
        content: "Thanh công cụ phía trên cho phép bạn xem thông báo, xuất báo cáo, hoặc xem hướng dẫn như bạn đang làm hiện tại.",
        selector: "#wms-topbar",
        side: "bottom",
        showControls: true,
        showSkip: true,
      },
      {
        icon: "📊",
        title: "Bảng thống kê",
        content: "Đây là phần nội dung chính, nơi hiển thị các chỉ số tồn kho, biểu đồ nhập xuất và danh sách hàng hoá cảnh báo.",
        selector: "#wms-main-content",
        side: "top",
        showControls: true,
        showSkip: true,
      }
    ],
  },
  {
    tour: "vouchersTour",
    steps: [
      {
        icon: "📦",
        title: "Quản lý phiếu",
        content: "Tại đây bạn có thể xem tất cả các loại phiếu (Nhập, Xuất, Điều chuyển) đang chờ xử lý hoặc đã hoàn thành.",
        selector: "#wms-main-content",
        side: "top",
        showControls: true,
        showSkip: true,
      },
    ],
  },
  {
    tour: "import-vouchersTour",
    steps: [
      {
        icon: "📥",
        title: "Phiếu nhập kho",
        content: "Tại đây bạn có thể tạo mới, phê duyệt hoặc quản lý các phiếu nhập kho vào hệ thống.",
        selector: "#wms-main-content",
        side: "top",
        showControls: true,
        showSkip: true,
      },
    ],
  },
  {
    tour: "export-vouchersTour",
    steps: [
      {
        icon: "📤",
        title: "Phiếu xuất kho",
        content: "Quản lý danh sách các phiếu xuất kho khỏi hệ thống. Bạn có thể theo dõi tiến độ nhặt hàng tại đây.",
        selector: "#wms-main-content",
        side: "top",
        showControls: true,
        showSkip: true,
      },
    ],
  },
  {
    tour: "transfersTour",
    steps: [
      {
        icon: "🔄",
        title: "Điều chuyển kho",
        content: "Quản lý các lệnh điều chuyển hàng hoá giữa các kho nội bộ trong hệ thống.",
        selector: "#wms-main-content",
        side: "top",
        showControls: true,
        showSkip: true,
      },
    ],
  }
];
