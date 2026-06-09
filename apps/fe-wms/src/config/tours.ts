import type { Tour } from "nextstepjs";

export const tours: Tour[] = [
  {
    tour: "dashboardTour",
    steps: [
      {
        icon: "👋",
        title: "Chào mừng",
        content: "Đây là trang tổng quan. Tại đây bạn có thể xem các thông tin thống kê nhanh về hệ thống.",
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
        icon: "📦",
        title: "Phiếu nhập kho",
        content: "Tại đây bạn có thể quản lý danh sách các phiếu nhập kho.",
        selector: "#wms-main-content",
        side: "top",
        showControls: true,
        showSkip: true,
      },
    ],
  },
  // Add more default tours as needed. Keys are generated from pathname (e.g. /import-vouchers -> import-vouchersTour)
];
