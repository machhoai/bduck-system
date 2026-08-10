import type { PosReceiptFontWeights } from "@bduck/shared-types";

export type PosReceiptFontWeightKey = keyof PosReceiptFontWeights;

export const RECEIPT_PAPER_PROFILES = [
  { id: "POS58", width: 58, vi: "Nhỏ gọn · vùng in 58 mm", zh: "紧凑 · 58 mm 打印区域" },
  { id: "POS80", width: 80, vi: "Phổ biến · vùng in 80 mm", zh: "常用 · 80 mm 打印区域" },
  { id: "POS82", width: 82, vi: "Khổ rộng · vùng in 82 mm", zh: "宽幅 · 82 mm 打印区域" },
] as const;

export const RECEIPT_THEMES = [
  { id: "CLASSIC", vi: "Mặc định", zh: "默认", viDescription: "Sạch, rõ và tiết kiệm giấy", zhDescription: "清晰简洁，节省纸张" },
  { id: "NATIONAL_DAY", vi: "Quốc khánh 2/9", zh: "越南国庆", viDescription: "Ngôi sao và khung đôi đơn sắc", zhDescription: "单色星形与双线边框" },
  { id: "TET", vi: "Tết", zh: "春节", viDescription: "Hoa văn hình thoi tối giản", zhDescription: "简洁菱形节日纹样" },
] as const;

export const RECEIPT_FONT_WEIGHT_OPTIONS = [
  { value: 400, vi: "Mảnh", zh: "常规" },
  { value: 500, vi: "Vừa", zh: "中等" },
  { value: 600, vi: "Hơi đậm", zh: "半粗" },
  { value: 700, vi: "Đậm", zh: "粗体" },
  { value: 800, vi: "Rất đậm", zh: "特粗" },
  { value: 900, vi: "Đậm tối đa", zh: "最粗" },
] as const;

export const RECEIPT_FONT_WEIGHT_FIELDS: Array<{
  key: PosReceiptFontWeightKey;
  vi: string;
  zh: string;
  viDescription: string;
  zhDescription: string;
}> = [
  { key: "storeName", vi: "Tên cửa hàng", zh: "门店名称", viDescription: "Tên thương hiệu ở đầu biên lai", zhDescription: "小票顶部的品牌名称" },
  { key: "storeDetails", vi: "Địa chỉ & hotline", zh: "地址与热线", viDescription: "Thông tin liên hệ đầu trang", zhDescription: "顶部的联系信息" },
  { key: "receiptTitle", vi: "Tiêu đề biên lai", zh: "小票标题", viDescription: "Dòng BIÊN LAI BÁN HÀNG", zhDescription: "销售小票标题" },
  { key: "orderInfo", vi: "Thông tin đơn", zh: "订单信息", viDescription: "Mã đơn, ngày giờ, nhân viên", zhDescription: "订单号、时间与员工" },
  { key: "tableHeader", vi: "Tiêu đề hàng hóa", zh: "商品表头", viDescription: "HÀNG HÓA và THÀNH TIỀN", zhDescription: "商品与金额表头" },
  { key: "itemName", vi: "Tên sản phẩm", zh: "商品名称", viDescription: "Tên của từng mặt hàng", zhDescription: "每项商品名称" },
  { key: "itemDetails", vi: "Số lượng & đơn giá", zh: "数量与单价", viDescription: "Dòng số lượng, giá và thành tiền", zhDescription: "数量、价格与金额" },
  { key: "itemTax", vi: "Thuế từng món", zh: "单项税额", viDescription: "Thuế suất và tiền thuế của món", zhDescription: "商品税率与税额" },
  { key: "summary", vi: "Tạm tính & giảm giá", zh: "小计与优惠", viDescription: "Các dòng cộng trừ cuối đơn", zhDescription: "订单末尾汇总项目" },
  { key: "taxTotal", vi: "Tổng tiền thuế", zh: "税额合计", viDescription: "Dòng tổng thuế toàn đơn", zhDescription: "整单税额合计" },
  { key: "grandTotal", vi: "Tổng tiền", zh: "应付总额", viDescription: "Số tiền thanh toán cuối cùng", zhDescription: "最终支付金额" },
  { key: "invoiceQrTitle", vi: "Tiêu đề QR hóa đơn", zh: "发票二维码标题", viDescription: "Lời mời quét mã yêu cầu hóa đơn", zhDescription: "扫码申请发票提示" },
  { key: "invoiceQrHint", vi: "Chú thích QR hóa đơn", zh: "发票二维码说明", viDescription: "Hướng dẫn dưới mã QR", zhDescription: "二维码下方说明" },
  { key: "themeMessage", vi: "Câu chủ đề", zh: "主题文案", viDescription: "Câu chúc theo dịp lễ", zhDescription: "节日祝福文案" },
  { key: "footer", vi: "Hậu mãi & cảm ơn", zh: "售后与致谢", viDescription: "Nội dung ở cuối biên lai", zhDescription: "小票底部内容" },
  { key: "decoration", vi: "Hoa văn chủ đề", zh: "主题装饰", viDescription: "Ngôi sao, hình thoi trang trí", zhDescription: "星形与菱形装饰" },
];
