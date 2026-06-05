import {
  ClipboardCheck,
  ClipboardList,
  Gift,
  MoveHorizontal,
  Package,
  PackageCheck,
  PackagePlus,
  RotateCcw,
  type LucideIcon,
} from "lucide-react";
import type {
  ProcessConfig,
  ProcessEntityType,
  StepOption,
} from "@bduck/shared-types";

export type Locale = "vi" | "zh";

export type EntityMeta = {
  icon: LucideIcon;
  label: Record<Locale, string>;
  description: Record<Locale, string>;
};

export type EntityStepMeta = {
  key: string;
  label: Record<Locale, string>;
  description: Record<Locale, string>;
};

export const ENTITY_ORDER: ProcessEntityType[] = [
  "IMPORT_VOUCHER",
  "EXPORT_VOUCHER",
  "TRANSFER_ORDER",
  "TRANSFER_INTRA",
  "PURCHASE_ORDER",
  "ADJUSTMENT_VOUCHER",
  "GIFT_SESSION",
];

export const ENTITY_META: Record<ProcessEntityType, EntityMeta> = {
  IMPORT_VOUCHER: {
    icon: PackagePlus,
    label: { vi: "Phiếu nhập kho", zh: "入库单" },
    description: {
      vi: "Duyệt chứng từ trước khi kiểm đếm và ghi nhận nhập kho.",
      zh: "入库清点和入库前的单据审批。",
    },
  },
  EXPORT_VOUCHER: {
    icon: PackageCheck,
    label: { vi: "Phiếu xuất kho", zh: "出库单" },
    description: {
      vi: "Duyệt chứng từ trước khi soạn hàng và xuất kho.",
      zh: "拣货和出库前的单据审批。",
    },
  },
  TRANSFER_ORDER: {
    icon: RotateCcw,
    label: { vi: "Lệnh chuyển kho", zh: "调拨单" },
    description: {
      vi: "Kiểm soát phê duyệt cho luồng điều chuyển nội bộ.",
      zh: "内部调拨流程的审批控制。",
    },
  },
  PURCHASE_ORDER: {
    icon: ClipboardList,
    label: { vi: "Đơn mua hàng", zh: "采购单" },
    description: {
      vi: "Thiết lập lớp duyệt trước khi tạo nghiệp vụ mua hàng.",
      zh: "采购业务前的审批层级设置。",
    },
  },
  ADJUSTMENT_VOUCHER: {
    icon: ClipboardCheck,
    label: { vi: "Phiếu điều chỉnh", zh: "调整单" },
    description: {
      vi: "Kiểm soát thay đổi số liệu tồn kho và audit trail.",
      zh: "控制库存数据调整和审计记录。",
    },
  },
  GIFT_SESSION: {
    icon: Gift,
    label: { vi: "Phiên quà tặng", zh: "礼品会话" },
    description: {
      vi: "Cấu hình duyệt cho nghiệp vụ phát quà và quà lưu niệm.",
      zh: "礼品和纪念品发放业务的审批设置。",
    },
  },
  TRANSFER_INTRA: {
    icon: MoveHorizontal,
    label: { vi: "Điều chuyển trong kho", zh: "库内调拨" },
    description: {
      vi: "Cấu hình điều chuyển hàng hóa giữa các vị trí trong cùng kho.",
      zh: "同仓库内库位间的货品调拨配置。",
    },
  },
};

export const ENTITY_STEPS: Partial<
  Record<ProcessEntityType, EntityStepMeta[]>
> = {
  IMPORT_VOUCHER: [
    {
      key: "receiving",
      label: { vi: "Kiểm đếm nhập kho", zh: "入库清点" },
      description: {
        vi: "Người phụ trách xác nhận số lượng thực nhận.",
        zh: "负责人确认实际收货数量。",
      },
    },
  ],
  EXPORT_VOUCHER: [
    {
      key: "picking",
      label: { vi: "Soạn hàng xuất kho", zh: "出库拣货" },
      description: {
        vi: "Người phụ trách soạn và xác nhận hàng xuất.",
        zh: "负责人拣货并确认出库商品。",
      },
    },
  ],
  TRANSFER_ORDER: [
    {
      key: "create_export",
      label: { vi: "Tạo lệnh xuất kho", zh: "创建出库单" },
      description: {
        vi: "Sau khi duyệt, hệ thống tự tạo phiếu xuất hay chờ thao tác thủ công.",
        zh: "审批通过后，系统自动创建出库单还是等待手动操作。",
      },
    },
    {
      key: "picking",
      label: { vi: "Soạn hàng xuất kho", zh: "出库拣货" },
      description: {
        vi: "Người phụ trách soạn và xác nhận hàng xuất.",
        zh: "负责人拣货并确认出库商品。",
      },
    },
    {
      key: "receiving",
      label: { vi: "Kiểm đếm nhận hàng", zh: "收货盘点" },
      description: {
        vi: "Người phụ trách xác nhận số lượng thực nhận tại kho đích.",
        zh: "负责人在目标仓库确认实际收货数量。",
      },
    },
  ],
  TRANSFER_INTRA: [
    {
      key: "location_move",
      label: { vi: "Di chuyển vị trí", zh: "库位移动" },
      description: {
        vi: "Thao tác di chuyển hàng hóa giữa các vị trí trong kho.",
        zh: "在仓库内库位间移动货品的操作。",
      },
    },
  ],
};

export const DEFAULT_STEP_OPTION: StepOption = {
  assignment_mode: "CREATOR",
  assigned_role_id: null,
  label: null,
};

export const TEXT = {
  vi: {
    title: "Cấu hình quy trình",
    subtitle:
      "Thiết lập phê duyệt và điều kiện thao tác cho từng loại chứng từ.",
    fixedPipeline: "Pipeline cố định",
    fixedPipelineHint:
      "Thứ tự bước do service nghiệp vụ kiểm soát. Trang này chỉ bật tắt lớp duyệt và điều kiện vận hành.",
    configured: "Đã cấu hình",
    missing: "Chưa có cấu hình",
    globalScope: "Mặc định toàn hệ thống",
    warehouseScope: "Theo kho",
    activeLevels: "cấp duyệt đang áp dụng",
    approvalChain: "Chuỗi phê duyệt",
    approvalHint: "Cấp bắt buộc luôn chạy. Cấp tùy chọn chỉ chạy khi được bật.",
    autoApprove: "Tự động duyệt",
    autoApproveHint:
      "Bỏ qua toàn bộ chuỗi phê duyệt khi chứng từ mới được tạo.",
    autoApproveWarning:
      "Khi bật, hệ thống vẫn lưu chuỗi duyệt nhưng chứng từ mới sẽ đi thẳng sang bước tiếp theo.",
    stepOptions: "Điều kiện thao tác",
    noStepOptions: "Loại chứng từ này chưa có bước thao tác có thể cấu hình.",
    createDefault: "Tạo cấu hình mặc định",
    createDefaultHint:
      "Hệ thống sẽ lấy chuỗi duyệt mặc định và map role theo dữ liệu hiện tại.",
    save: "Lưu cấu hình",
    saving: "Đang lưu...",
    addLevel: "Thêm cấp duyệt",
    removeLevel: "Xóa cấp duyệt",
    required: "Bắt buộc",
    optional: "Tùy chọn",
    enabled: "Bật",
    disabled: "Tắt",
    role: "Role duyệt",
    selectRole: "Chọn role",
    labelVi: "Tên tiếng Việt",
    labelZh: "Tên tiếng Trung",
    approvers: "Số người duyệt",
    assignee: "Người xử lý",
    creator: "Người tạo chứng từ",
    selectedRole: "Role chỉ định",
    requireEvidence: "Bắt buộc tải lên chứng từ",
    requireOtp: "Bắt buộc OTP",
    invalidRole: "Vui lòng chọn role cho tất cả cấp duyệt đang áp dụng.",
    invalidLabel: "Vui lòng nhập đủ tên tiếng Việt và tiếng Trung.",
    invalidStepRole: "Vui lòng chọn role cho bước thao tác này.",
    loadError: "Không thể tải cấu hình quy trình.",
    creating: "Đang tạo cấu hình...",
    createSuccess: "Đã tạo cấu hình mặc định",
    createError: "Lỗi tạo cấu hình",
    saveSuccess: "Đã lưu cấu hình",
    saveSuccessDesc: "Cấu hình quy trình đã được cập nhật.",
    saveError: "Lỗi lưu cấu hình",
    retry: "Thử lại",
    start: "Tạo chứng từ",
    approval: "Phê duyệt",
    operation: "Thao tác kho",
    done: "Hoàn thành",
  },
  zh: {
    title: "流程配置",
    subtitle: "为每种单据设置审批层级和操作条件。",
    fixedPipeline: "固定流程",
    fixedPipelineHint: "步骤顺序由业务服务控制。此页面只配置审批层和操作条件。",
    configured: "已配置",
    missing: "未配置",
    globalScope: "全局默认",
    warehouseScope: "按仓库",
    activeLevels: "个启用审批级别",
    approvalChain: "审批链",
    approvalHint: "必需级别始终执行。可选级别仅在启用时执行。",
    autoApprove: "自动审批",
    autoApproveHint: "新单据创建时跳过整个审批链。",
    autoApproveWarning: "启用后，审批链仍会保留，但新单据会直接进入下一步。",
    stepOptions: "操作条件",
    noStepOptions: "此单据类型暂无可配置的操作步骤。",
    createDefault: "创建默认配置",
    createDefaultHint: "系统将使用默认审批链并按当前数据映射角色。",
    save: "保存配置",
    saving: "保存中...",
    addLevel: "添加审批级别",
    removeLevel: "删除审批级别",
    required: "必需",
    optional: "可选",
    enabled: "启用",
    disabled: "停用",
    role: "审批角色",
    selectRole: "选择角色",
    labelVi: "越南语名称",
    labelZh: "中文名称",
    approvers: "审批人数",
    assignee: "处理人",
    creator: "单据创建人",
    selectedRole: "指定角色",
    requireEvidence: "必须上传凭证",
    requireOtp: "必须 OTP",
    invalidRole: "请为所有启用的审批级别选择角色。",
    invalidLabel: "请填写越南语和中文名称。",
    invalidStepRole: "请为此操作步骤选择角色。",
    loadError: "无法加载流程配置。",
    creating: "正在创建配置...",
    createSuccess: "默认配置已创建",
    createError: "创建配置失败",
    saveSuccess: "配置已保存",
    saveSuccessDesc: "流程配置已更新。",
    saveError: "保存配置失败",
    retry: "重试",
    start: "创建单据",
    approval: "审批",
    operation: "仓库操作",
    done: "完成",
  },
} as const;

export function getConfigSummary(config?: ProcessConfig) {
  if (!config) {
    return { activeLevels: 0, requiredLevels: 0, optionalEnabled: 0 };
  }

  const activeLevels = config.approval_chain.filter(
    (level) => level.required || level.enabled,
  ).length;
  const requiredLevels = config.approval_chain.filter(
    (level) => level.required,
  ).length;

  return {
    activeLevels,
    requiredLevels,
    optionalEnabled: activeLevels - requiredLevels,
  };
}

export function getEntitySteps(entityType: ProcessEntityType) {
  return ENTITY_STEPS[entityType] ?? [];
}

export function getEntityMeta(entityType: ProcessEntityType) {
  return (
    ENTITY_META[entityType] ?? {
      icon: Package,
      label: { vi: entityType, zh: entityType },
      description: { vi: entityType, zh: entityType },
    }
  );
}
