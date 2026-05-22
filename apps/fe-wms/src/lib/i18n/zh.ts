/**
 * Chinese dictionary — WMS Layout
 */
import type { Dictionary } from './vi';

const zh: Dictionary = {
  // ── Navigation ──
  nav: {
    dashboard: '首页',
    inventory: '库存',
    products: '产品',
    categories: '类别',
    importVoucher: '入库单',
    exportVoucher: '出库单',
    transfer: '调拨',
    stockCount: '盘点',
    pos: '销售',
    reports: '报表',
    users: '用户',
    settings: '设置',
    more: '更多',
  },

  // ── Sidebar ──
  sidebar: {
    systemName: 'Joy World WMS',
    collapse: '收起',
    expand: '展开',
  },

  // ── User Panel ──
  user: {
    role: '角色',
    locations: '管理区域',
    noLocations: '未分配区域',
    logout: '退出登录',
    globalScope: '全系统',
  },

  // ── Roles ──
  roles: {
    ADMIN: '管理员',
    DIRECTOR: '总监',
    WAREHOUSE_MANAGER: '仓库经理',
    WAREHOUSE_STAFF: '仓库员工',
    STORE_MANAGER: '门店经理',
  },

  // ── Dashboard ──
  dashboard: {
    title: '首页',
    welcome: '你好',
    emptyState: '仪表板正在建设中，内容将尽快更新。',
  },

  // ── Categories ──
  categories: {
    title: '类别管理',
    addNew: '添加类别',
    edit: '编辑类别',
    name: '类别名称',
    code: '类别代码',
    type: '类型',
    parent: '父类别',
    description: '描述',
    noParent: '根类别',
    empty: '还没有类别。请创建第一个类别。',
    confirmDelete: '确定要删除此类别吗？',
    deleteWarning: '此操作不可撤销。',
    saving: '正在保存类别...',
    saveSuccess: '类别保存成功。',
    saveError: '保存类别时出错。',
    deleting: '正在删除类别...',
    deleteSuccess: '类别已删除。',
    deleteError: '删除类别时出错。',
    types: {
      EQUIPMENT: '设备',
      CONSUMABLE: '消耗品',
      SOUVENIR_SALE: '纪念品（销售）',
      SOUVENIR_GIFT: '纪念品（赠品）',
    },
  },

  // ── Common ──
  common: {
    loading: '加载中...',
    error: '发生错误',
    retry: '重试',
    save: '保存',
    cancel: '取消',
    delete: '删除',
    edit: '编辑',
    search: '搜索',
    actions: '操作',
    confirm: '确认',
    noData: '没有数据',
  },
};

export default zh;
