import type { Tour } from "nextstepjs";
import type { GuideCopy } from "./types";
import { getVoucherCreateTours } from "./voucherCreateTours";
import {
  getVoucherCreateTourName,
  getVoucherGuideSelectors,
  guideStep,
  isVoucherCreateTour,
  pageSteps,
  VOUCHER_GUIDE_TARGETS,
} from "./voucherGuideCore";

export {
  getVoucherCreateTourName,
  getVoucherGuideSelectors,
  isVoucherCreateTour,
  VOUCHER_GUIDE_TARGETS,
};

function listTours(copy: GuideCopy): Tour[] {
  return [
    {
      tour: "vouchersInProgressEmptyTour",
      steps: [
        ...pageSteps(copy),
        guideStep(copy.vouchers.inProgress.empty, VOUCHER_GUIDE_TARGETS.empty),
      ],
    },
    {
      tour: "vouchersInProgressTour",
      steps: [
        ...pageSteps(copy),
        guideStep(
          copy.vouchers.inProgress.filters,
          VOUCHER_GUIDE_TARGETS.filters,
          "bottom",
          true,
        ),
        guideStep(
          copy.vouchers.inProgress.cards,
          VOUCHER_GUIDE_TARGETS.cards,
          "top",
          true,
        ),
        guideStep(
          copy.vouchers.inProgress.noResults,
          VOUCHER_GUIDE_TARGETS.noResults,
        ),
      ],
    },
    {
      tour: "vouchersHistoryEmptyTour",
      steps: [
        ...pageSteps(copy),
        guideStep(copy.vouchers.history.empty, VOUCHER_GUIDE_TARGETS.empty),
      ],
    },
    {
      tour: "vouchersHistoryTour",
      steps: [
        ...pageSteps(copy),
        guideStep(
          copy.vouchers.history.filters,
          VOUCHER_GUIDE_TARGETS.filters,
          "bottom",
          true,
        ),
        guideStep(
          copy.vouchers.history.cards,
          VOUCHER_GUIDE_TARGETS.cards,
          "top",
          true,
        ),
        guideStep(
          copy.vouchers.history.noResults,
          VOUCHER_GUIDE_TARGETS.noResults,
        ),
        guideStep(
          copy.vouchers.history.pagination,
          VOUCHER_GUIDE_TARGETS.pagination,
          "top",
          true,
        ),
      ],
    },
  ];
}

function detailTours(copy: GuideCopy): Tour[] {
  const detail = copy.vouchers.detail;
  const steps = [
    guideStep(
      detail.header,
      VOUCHER_GUIDE_TARGETS.detailHeader,
      "bottom",
      true,
    ),
    guideStep(
      detail.information,
      VOUCHER_GUIDE_TARGETS.detailInformation,
      "left",
    ),
    guideStep(detail.items, VOUCHER_GUIDE_TARGETS.detailItems, "left"),
    guideStep(
      detail.attachments,
      VOUCHER_GUIDE_TARGETS.detailAttachments,
      "left",
    ),
    guideStep(detail.actions, VOUCHER_GUIDE_TARGETS.detailActions, "top", true),
  ];

  return [
    { tour: "vouchersDetailTour", steps },
    { tour: "vouchersTransferDetailTour", steps },
  ];
}

export function getVoucherTours(copy: GuideCopy): Tour[] {
  return [
    { tour: "vouchersTour", steps: pageSteps(copy) },
    ...getVoucherCreateTours(copy),
    ...listTours(copy),
    ...detailTours(copy),
  ];
}

export function filterVoucherTourSteps(
  tours: Tour[],
  visibleSelectors: ReadonlySet<string> | null,
) {
  if (!visibleSelectors) return tours;

  return tours.map((tour) => {
    if (!tour.tour.startsWith("vouchers")) return tour;
    return {
      ...tour,
      steps: tour.steps.filter(
        (step) => !step.selector || visibleSelectors.has(step.selector),
      ),
    };
  });
}
