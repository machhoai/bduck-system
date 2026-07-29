export interface GuideText {
  title: string;
  content: string;
}

export interface VoucherGuideCopy {
  page: GuideText;
  metrics: GuideText;
  tabs: GuideText;
  create: {
    types: GuideText;
    wizard: GuideText;
    import: {
      warehouse: GuideText;
      information: GuideText;
      upload: GuideText;
      excel: GuideText;
      catalog: GuideText;
      selectedItems: GuideText;
      quickLocation: GuideText;
      summary: GuideText;
      submit: GuideText;
    };
    export: {
      typeAndWarehouse: GuideText;
      notes: GuideText;
      upload: GuideText;
      excel: GuideText;
      catalog: GuideText;
      selectedItems: GuideText;
      summary: GuideText;
      submit: GuideText;
    };
    transfer: {
      typeAndRoute: GuideText;
      notes: GuideText;
      upload: GuideText;
      excel: GuideText;
      catalog: GuideText;
      selectedItems: GuideText;
      summary: GuideText;
      submit: GuideText;
    };
  };
  inProgress: {
    empty: GuideText;
    filters: GuideText;
    cards: GuideText;
    noResults: GuideText;
  };
  history: {
    empty: GuideText;
    filters: GuideText;
    cards: GuideText;
    noResults: GuideText;
    pagination: GuideText;
  };
  detail: {
    header: GuideText;
    information: GuideText;
    items: GuideText;
    attachments: GuideText;
    actions: GuideText;
  };
}

export type GuideModuleTourKey =
  | "vouchers"
  | "import-vouchers"
  | "export-vouchers"
  | "transfers";

export interface GuideCopy {
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
  modules: Record<GuideModuleTourKey, GuideText>;
  vouchers: VoucherGuideCopy;
}
