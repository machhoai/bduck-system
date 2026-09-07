export const revenueExportVi = {
  productGroupsError: "Không thể tải nhóm sản phẩm. Hệ thống sẽ tự thử lại.",
  invoicePreparation: "Tệp hóa đơn",
  invoicePreparationDescription:
    "Chi tiết sản phẩm từng đơn, tiền trước thuế, thuế và thực thu để chuẩn bị xuất hóa đơn.",
  invoiceLocalOnly:
    "Tệp hóa đơn sử dụng POS local. Hãy chọn nguồn Dữ liệu local để xuất.",
  invoiceSourceHint:
    "Nguồn POS local · Giữ nguyên tiền thuế đã ghi nhận trong giao dịch.",
  productsTitle: "Sản phẩm trong phạm vi xuất",
  searchProducts: "Tìm tên sản phẩm hoặc nhóm",
  selectAll: "Chọn tất cả",
  clearSelection: "Bỏ chọn tất cả",
  selectedCount: "Đã chọn {selected}/{total} sản phẩm",
  exportName: "Tên trong file xuất",
  resetName: "Khôi phục tên gốc",
  useOriginalNames: "Dùng tên gốc cho lần xuất này",
  rememberNamesHint:
    "Tên xuất được nhớ riêng cho tài khoản trên trình duyệt này; không thay đổi tên sản phẩm gốc.",
  noProducts:
    "Không có sản phẩm đã bán trong phạm vi này. Hãy kiểm tra ngày và cửa hàng đã chọn.",
  noSearchResults: "Không tìm thấy sản phẩm phù hợp.",
  selectAtLeastOne: "Chọn ít nhất một sản phẩm để xuất.",
  roundMoney: "Làm tròn tiền đến đồng",
  roundMoneyDescription:
    "Làm tròn thực thu và thuế từng dòng; tiền trước thuế bằng thực thu trừ thuế.",
  preferencesError:
    "Trình duyệt không thể lưu tên xuất. Tên bạn nhập vẫn được dùng cho lần xuất này.",
};

export const revenueExportZh: Record<keyof typeof revenueExportVi, string> = {
  productGroupsError: "无法加载商品分组，系统将自动重试。",
  invoicePreparation: "开票数据",
  invoicePreparationDescription:
    "导出每笔订单的商品、未税金额、税额和实收金额，用于准备开票。",
  invoiceLocalOnly: "开票数据使用本地 POS。请切换至本地数据来源后导出。",
  invoiceSourceHint: "本地 POS 数据 · 保留交易中记录的税额。",
  productsTitle: "导出范围内的商品",
  searchProducts: "搜索商品名称或分组",
  selectAll: "全选",
  clearSelection: "取消全选",
  selectedCount: "已选 {selected}/{total} 件商品",
  exportName: "导出名称",
  resetName: "恢复原名称",
  useOriginalNames: "本次导出使用原名称",
  rememberNamesHint: "导出名称按账户保存在此浏览器中，不会更改原商品名称。",
  noProducts: "此范围内没有已售商品，请检查日期和门店。",
  noSearchResults: "没有匹配的商品。",
  selectAtLeastOne: "请至少选择一件商品。",
  roundMoney: "金额四舍五入至越南盾整数",
  roundMoneyDescription: "每行实收和税额取整，未税金额为实收减去税额。",
  preferencesError: "浏览器无法保存导出名称。您输入的名称仍将用于本次导出。",
};
