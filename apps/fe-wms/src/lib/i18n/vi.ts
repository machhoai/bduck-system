/**
 * Vietnamese dictionary — WMS Layout
 */
const vi = {
  // ── Navigation ──
  nav: {
    dashboard: 'Trang chủ',
    inventory: 'Tồn kho',
    products: 'Sản phẩm',
    categories: 'Danh mục',
    importVoucher: 'Phiếu nhập',
    exportVoucher: 'Phiếu xuất',
    transfer: 'Chuyển kho',
    stockCount: 'Kiểm kê',
    pos: 'Bán hàng',
    reports: 'Báo cáo',
    users: 'Người dùng',
    settings: 'Cài đặt',
    more: 'Thêm',
  },

  // ── Sidebar ──
  sidebar: {
    systemName: 'Joy World WMS',
    collapse: 'Thu gọn',
    expand: 'Mở rộng',
  },

  // ── User Panel ──
  user: {
    role: 'Vai trò',
    locations: 'Khu vực quản lý',
    noLocations: 'Chưa phân khu vực',
    logout: 'Đăng xuất',
    globalScope: 'Toàn hệ thống',
  },

  // ── Roles ──
  roles: {
    ADMIN: 'Quản trị viên',
    DIRECTOR: 'Giám đốc',
    WAREHOUSE_MANAGER: 'Quản lý kho',
    WAREHOUSE_STAFF: 'Nhân viên kho',
    STORE_MANAGER: 'Quản lý cửa hàng',
  },

  // ── Dashboard ──
  dashboard: {
    title: 'Trang chủ',
    welcome: 'Xin chào',
    emptyState: 'Dashboard đang được xây dựng. Nội dung sẽ được cập nhật sớm.',
  },

  // ── Categories ──
  categories: {
    title: 'Quản lý danh mục',
    addNew: 'Thêm danh mục',
    edit: 'Sửa danh mục',
    name: 'Tên danh mục',
    code: 'Mã danh mục',
    type: 'Loại',
    parent: 'Danh mục cha',
    description: 'Mô tả',
    noParent: 'Danh mục gốc',
    empty: 'Chưa có danh mục nào. Hãy tạo danh mục đầu tiên.',
    confirmDelete: 'Bạn có chắc muốn xóa danh mục này?',
    deleteWarning: 'Hành động này không thể hoàn tác.',
    saving: 'Đang lưu danh mục...',
    saveSuccess: 'Đã lưu danh mục thành công.',
    saveError: 'Lỗi khi lưu danh mục.',
    deleting: 'Đang xóa danh mục...',
    deleteSuccess: 'Đã xóa danh mục.',
    deleteError: 'Lỗi khi xóa danh mục.',
    types: {
      EQUIPMENT: 'Thiết bị',
      CONSUMABLE: 'Vật tư tiêu hao',
      SOUVENIR_SALE: 'Quà lưu niệm (bán)',
      SOUVENIR_GIFT: 'Quà lưu niệm (tặng)',
    },
  },

  // ── Common ──
  common: {
    loading: 'Đang tải...',
    error: 'Đã xảy ra lỗi',
    retry: 'Thử lại',
    save: 'Lưu',
    cancel: 'Hủy',
    delete: 'Xóa',
    edit: 'Sửa',
    search: 'Tìm kiếm',
    actions: 'Thao tác',
    confirm: 'Xác nhận',
    noData: 'Không có dữ liệu',
  },
} as const;

export type Dictionary = typeof vi;
export default vi;
