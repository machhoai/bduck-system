import type { Step, Tour } from "nextstepjs";

export const GUIDE_TARGETS = {
  mainContent: "#wms-main-content",
  contentViewport: "#wms-content-viewport",
  sidebar: "#wms-sidebar",
  topbar: "#wms-topbar",
  topbarExport: "#wms-export-button",
  topbarHelp: "#wms-help-button",
  notificationBell: "#wms-notification-bell",
  dashboardHeader: "#wms-dashboard-header",
  dashboardWarehouseFilter: "#wms-dashboard-warehouse-filter",
  dashboardKpis: "#wms-dashboard-kpis",
  dashboardCharts: "#wms-dashboard-charts",
  dashboardLowStock: "#wms-dashboard-low-stock",
  dashboardTopProducts: "#wms-dashboard-top-products",
} as const;

type GuideModuleTourKey = "vouchers" | "import-vouchers" | "export-vouchers" | "transfers";

export type GuideCopy = {
  card: {
    step: string;
    previous: string;
    next: string;
    finish: string;
    skip: string;
  };
  common: {
    workspaceTitle: string;
    workspaceContent: string;
    topbarTitle: string;
    topbarContent: string;
    helpTitle: string;
    helpContent: string;
    exportTitle: string;
    exportContent: string;
    notificationsTitle: string;
    notificationsContent: string;
    sidebarTitle: string;
    sidebarContent: string;
  };
  dashboard: {
    introTitle: string;
    introContent: string;
    filterTitle: string;
    filterContent: string;
    kpiTitle: string;
    kpiContent: string;
    chartsTitle: string;
    chartsContent: string;
    lowStockTitle: string;
    lowStockContent: string;
    rankingTitle: string;
    rankingContent: string;
  };
  modules: Record<GuideModuleTourKey, { title: string; content: string }>;
};

function withDefaults(step: Step): Step {
  return {
    showControls: true,
    showSkip: true,
    pointerPadding: 8,
    pointerRadius: 8,
    disableInteraction: true,
    viewportID: "wms-content-viewport",
    ...step,
  };
}

function buildModuleTour(tour: string, key: GuideModuleTourKey, copy: GuideCopy): Tour {
  const moduleCopy = copy.modules[key];

  return {
    tour,
    steps: [
      withDefaults({
        icon: null,
        title: moduleCopy.title,
        content: moduleCopy.content,
        selector: GUIDE_TARGETS.contentViewport,
        side: "top",
      }),
      withDefaults({
        icon: null,
        title: copy.common.topbarTitle,
        content: copy.common.topbarContent,
        selector: GUIDE_TARGETS.topbar,
        side: "bottom",
        viewportID: undefined,
      }),
      withDefaults({
        icon: null,
        title: copy.common.helpTitle,
        content: copy.common.helpContent,
        selector: GUIDE_TARGETS.topbarHelp,
        side: "bottom-right",
        viewportID: undefined,
      }),
    ],
  };
}

export function getGuideTours(copy: GuideCopy): Tour[] {
  return [
    {
      tour: "workspaceTour",
      steps: [
        withDefaults({
          icon: null,
          title: copy.common.workspaceTitle,
          content: copy.common.workspaceContent,
          selector: GUIDE_TARGETS.contentViewport,
          side: "top",
        }),
        withDefaults({
          icon: null,
          title: copy.common.topbarTitle,
          content: copy.common.topbarContent,
          selector: GUIDE_TARGETS.topbar,
          side: "bottom",
          viewportID: undefined,
        }),
        withDefaults({
          icon: null,
          title: copy.common.sidebarTitle,
          content: copy.common.sidebarContent,
          selector: GUIDE_TARGETS.sidebar,
          side: "right",
          viewportID: undefined,
        }),
      ],
    },
    {
      tour: "dashboardTour",
      steps: [
        withDefaults({
          icon: null,
          title: copy.dashboard.introTitle,
          content: copy.dashboard.introContent,
          selector: GUIDE_TARGETS.dashboardHeader,
          side: "bottom",
        }),
        withDefaults({
          icon: null,
          title: copy.common.sidebarTitle,
          content: copy.common.sidebarContent,
          selector: GUIDE_TARGETS.sidebar,
          side: "right",
          viewportID: undefined,
        }),
        withDefaults({
          icon: null,
          title: copy.common.topbarTitle,
          content: copy.common.topbarContent,
          selector: GUIDE_TARGETS.topbar,
          side: "bottom",
          viewportID: undefined,
        }),
        withDefaults({
          icon: null,
          title: copy.common.helpTitle,
          content: copy.common.helpContent,
          selector: GUIDE_TARGETS.topbarHelp,
          side: "bottom-right",
          viewportID: undefined,
        }),
        withDefaults({
          icon: null,
          title: copy.common.exportTitle,
          content: copy.common.exportContent,
          selector: GUIDE_TARGETS.topbar,
          side: "bottom",
          viewportID: undefined,
        }),
        withDefaults({
          icon: null,
          title: copy.common.notificationsTitle,
          content: copy.common.notificationsContent,
          selector: GUIDE_TARGETS.notificationBell,
          side: "bottom-right",
          viewportID: undefined,
        }),
        withDefaults({
          icon: null,
          title: copy.dashboard.filterTitle,
          content: copy.dashboard.filterContent,
          selector: GUIDE_TARGETS.dashboardWarehouseFilter,
          side: "bottom",
        }),
        withDefaults({
          icon: null,
          title: copy.dashboard.kpiTitle,
          content: copy.dashboard.kpiContent,
          selector: GUIDE_TARGETS.dashboardKpis,
          side: "top",
        }),
        withDefaults({
          icon: null,
          title: copy.dashboard.chartsTitle,
          content: copy.dashboard.chartsContent,
          selector: GUIDE_TARGETS.dashboardCharts,
          side: "top",
        }),
        withDefaults({
          icon: null,
          title: copy.dashboard.lowStockTitle,
          content: copy.dashboard.lowStockContent,
          selector: GUIDE_TARGETS.dashboardLowStock,
          side: "top",
        }),
        withDefaults({
          icon: null,
          title: copy.dashboard.rankingTitle,
          content: copy.dashboard.rankingContent,
          selector: GUIDE_TARGETS.dashboardTopProducts,
          side: "top",
        }),
      ],
    },
    buildModuleTour("vouchersTour", "vouchers", copy),
    buildModuleTour("import-vouchersTour", "import-vouchers", copy),
    buildModuleTour("export-vouchersTour", "export-vouchers", copy),
    buildModuleTour("transfersTour", "transfers", copy),
  ];
}

const routeTourMap: Array<{ pattern: RegExp; tour: string }> = [
  { pattern: /^\/dashboard\/?$/, tour: "dashboardTour" },
  { pattern: /^\/vouchers\/?$/, tour: "vouchersTour" },
  { pattern: /^\/voucher\/?$/, tour: "vouchersTour" },
  { pattern: /^\/import-vouchers\/?$/, tour: "import-vouchersTour" },
  { pattern: /^\/export-vouchers\/?$/, tour: "export-vouchersTour" },
  { pattern: /^\/transfers\/?$/, tour: "transfersTour" },
];

export function getGuideTourName(pathname: string): string {
  return routeTourMap.find(({ pattern }) => pattern.test(pathname))?.tour ?? "workspaceTour";
}
