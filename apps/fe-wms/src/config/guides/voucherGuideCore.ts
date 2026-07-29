import type { Step } from "nextstepjs";
import type { GuideCopy, GuideText } from "./types";

export const VOUCHER_GUIDE_TARGETS = {
  pageHeader: "#voucher-guide-page-header",
  metrics: "#voucher-guide-metrics",
  tabs: "#voucher-guide-tabs",
  createTypes: "#voucher-guide-create-types",
  wizard: "#voucher-guide-wizard",
  warehouse: "#voucher-guide-warehouse",
  information: "#voucher-guide-information",
  notes: "#voucher-guide-notes",
  upload: "#voucher-guide-upload",
  excel: "#voucher-guide-excel",
  catalog: "#voucher-guide-catalog",
  selectedItems: "#voucher-guide-selected-items",
  quickLocation: "#voucher-guide-quick-location",
  summary: "#voucher-guide-summary",
  summaryMetrics: "#voucher-guide-summary-metrics",
  wizardAction: "#voucher-guide-wizard-action",
  filters: "#voucher-guide-filters",
  cards: "#voucher-guide-cards",
  empty: "#voucher-guide-empty",
  noResults: "#voucher-guide-no-results",
  pagination: "#voucher-guide-pagination",
  detailHeader: "#voucher-guide-detail-header",
  detailInformation: "#voucher-guide-detail-information",
  detailItems: "#voucher-guide-detail-items",
  detailAttachments: "#voucher-guide-detail-attachments",
  detailActions: "#voucher-guide-detail-actions",
} as const;

export type VoucherType = "IMPORT" | "EXPORT" | "TRANSFER";
export type WizardStep = 0 | 1 | 2 | 3;

const CREATE_TOUR_PREFIX = "vouchersCreate";

export function getVoucherCreateTourName(
  voucherType: VoucherType,
  step: WizardStep,
) {
  const typeName = voucherType.charAt(0) + voucherType.slice(1).toLowerCase();
  return `${CREATE_TOUR_PREFIX}${typeName}${step}Tour`;
}

export function isVoucherCreateTour(tourName: string | null) {
  return Boolean(tourName?.startsWith(CREATE_TOUR_PREFIX));
}

export function getVoucherGuideSelectors() {
  return Object.values(VOUCHER_GUIDE_TARGETS);
}

export function guideStep(
  text: GuideText,
  selector: string,
  side: Step["side"] = "bottom",
  interactive = false,
): Step {
  return {
    icon: null,
    title: text.title,
    content: text.content,
    selector,
    side,
    showControls: true,
    showSkip: true,
    pointerPadding: 8,
    pointerRadius: 8,
    disableInteraction: !interactive,
    viewportID: "wms-content-viewport",
  };
}

export function pageSteps(copy: GuideCopy): Step[] {
  return [
    guideStep(copy.vouchers.page, VOUCHER_GUIDE_TARGETS.pageHeader),
    guideStep(copy.vouchers.metrics, VOUCHER_GUIDE_TARGETS.metrics),
    guideStep(copy.vouchers.tabs, VOUCHER_GUIDE_TARGETS.tabs, "bottom", true),
  ];
}

export function createBaseSteps(copy: GuideCopy): Step[] {
  return [
    ...pageSteps(copy),
    guideStep(
      copy.vouchers.create.types,
      VOUCHER_GUIDE_TARGETS.createTypes,
      "bottom",
      true,
    ),
    guideStep(
      copy.vouchers.create.wizard,
      VOUCHER_GUIDE_TARGETS.wizard,
      "bottom",
      true,
    ),
  ];
}
