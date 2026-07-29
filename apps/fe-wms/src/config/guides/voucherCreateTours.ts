import type { Tour } from "nextstepjs";
import type { GuideCopy, GuideText } from "./types";
import {
  createBaseSteps,
  getVoucherCreateTourName,
  guideStep,
  VOUCHER_GUIDE_TARGETS,
  type VoucherType,
} from "./voucherGuideCore";

function importCreateTours(copy: GuideCopy): Tour[] {
  const guide = copy.vouchers.create.import;
  return [
    {
      tour: getVoucherCreateTourName("IMPORT", 0),
      steps: [
        ...createBaseSteps(copy),
        guideStep(
          guide.warehouse,
          VOUCHER_GUIDE_TARGETS.warehouse,
          "top",
          true,
        ),
        guideStep(
          guide.information,
          VOUCHER_GUIDE_TARGETS.information,
          "top",
          true,
        ),
        guideStep(
          copy.vouchers.create.wizard,
          VOUCHER_GUIDE_TARGETS.wizardAction,
          "left",
          true,
        ),
      ],
    },
    {
      tour: getVoucherCreateTourName("IMPORT", 1),
      steps: [
        guideStep(copy.vouchers.create.wizard, VOUCHER_GUIDE_TARGETS.wizard),
        guideStep(guide.upload, VOUCHER_GUIDE_TARGETS.upload, "top", true),
        guideStep(
          copy.vouchers.create.wizard,
          VOUCHER_GUIDE_TARGETS.wizardAction,
          "left",
          true,
        ),
      ],
    },
    {
      tour: getVoucherCreateTourName("IMPORT", 2),
      steps: [
        guideStep(copy.vouchers.create.wizard, VOUCHER_GUIDE_TARGETS.wizard),
        guideStep(guide.excel, VOUCHER_GUIDE_TARGETS.excel, "top", true),
        guideStep(guide.catalog, VOUCHER_GUIDE_TARGETS.catalog, "top", true),
        guideStep(
          guide.selectedItems,
          VOUCHER_GUIDE_TARGETS.selectedItems,
          "top",
          true,
        ),
        guideStep(
          guide.quickLocation,
          VOUCHER_GUIDE_TARGETS.quickLocation,
          "top",
          true,
        ),
        guideStep(
          copy.vouchers.create.wizard,
          VOUCHER_GUIDE_TARGETS.wizardAction,
          "left",
          true,
        ),
      ],
    },
    {
      tour: getVoucherCreateTourName("IMPORT", 3),
      steps: [
        guideStep(copy.vouchers.create.wizard, VOUCHER_GUIDE_TARGETS.wizard),
        guideStep(guide.summary, VOUCHER_GUIDE_TARGETS.summary, "top"),
        guideStep(guide.summary, VOUCHER_GUIDE_TARGETS.summaryMetrics, "left"),
        guideStep(
          guide.submit,
          VOUCHER_GUIDE_TARGETS.wizardAction,
          "left",
          true,
        ),
      ],
    },
  ];
}

function sharedCreateTours(
  copy: GuideCopy,
  type: Extract<VoucherType, "EXPORT" | "TRANSFER">,
  guide: {
    upload: GuideText;
    excel: GuideText;
    catalog: GuideText;
    selectedItems: GuideText;
    summary: GuideText;
    submit: GuideText;
  },
): Tour[] {
  return [
    {
      tour: getVoucherCreateTourName(type, 1),
      steps: [
        guideStep(copy.vouchers.create.wizard, VOUCHER_GUIDE_TARGETS.wizard),
        guideStep(guide.upload, VOUCHER_GUIDE_TARGETS.upload, "top", true),
        guideStep(
          copy.vouchers.create.wizard,
          VOUCHER_GUIDE_TARGETS.wizardAction,
          "left",
          true,
        ),
      ],
    },
    {
      tour: getVoucherCreateTourName(type, 2),
      steps: [
        guideStep(copy.vouchers.create.wizard, VOUCHER_GUIDE_TARGETS.wizard),
        guideStep(guide.excel, VOUCHER_GUIDE_TARGETS.excel, "top", true),
        guideStep(guide.catalog, VOUCHER_GUIDE_TARGETS.catalog, "top", true),
        guideStep(
          guide.selectedItems,
          VOUCHER_GUIDE_TARGETS.selectedItems,
          "top",
          true,
        ),
        guideStep(
          copy.vouchers.create.wizard,
          VOUCHER_GUIDE_TARGETS.wizardAction,
          "left",
          true,
        ),
      ],
    },
    {
      tour: getVoucherCreateTourName(type, 3),
      steps: [
        guideStep(copy.vouchers.create.wizard, VOUCHER_GUIDE_TARGETS.wizard),
        guideStep(guide.summary, VOUCHER_GUIDE_TARGETS.summary, "top"),
        guideStep(guide.summary, VOUCHER_GUIDE_TARGETS.summaryMetrics, "left"),
        guideStep(
          guide.submit,
          VOUCHER_GUIDE_TARGETS.wizardAction,
          "left",
          true,
        ),
      ],
    },
  ];
}

function exportCreateTours(copy: GuideCopy): Tour[] {
  const guide = copy.vouchers.create.export;
  return [
    {
      tour: getVoucherCreateTourName("EXPORT", 0),
      steps: [
        ...createBaseSteps(copy),
        guideStep(
          guide.typeAndWarehouse,
          VOUCHER_GUIDE_TARGETS.warehouse,
          "top",
          true,
        ),
        guideStep(guide.notes, VOUCHER_GUIDE_TARGETS.notes, "top", true),
        guideStep(
          copy.vouchers.create.wizard,
          VOUCHER_GUIDE_TARGETS.wizardAction,
          "left",
          true,
        ),
      ],
    },
    ...sharedCreateTours(copy, "EXPORT", guide),
  ];
}

function transferCreateTours(copy: GuideCopy): Tour[] {
  const guide = copy.vouchers.create.transfer;
  return [
    {
      tour: getVoucherCreateTourName("TRANSFER", 0),
      steps: [
        ...createBaseSteps(copy),
        guideStep(
          guide.typeAndRoute,
          VOUCHER_GUIDE_TARGETS.warehouse,
          "top",
          true,
        ),
        guideStep(guide.notes, VOUCHER_GUIDE_TARGETS.notes, "top", true),
        guideStep(
          copy.vouchers.create.wizard,
          VOUCHER_GUIDE_TARGETS.wizardAction,
          "left",
          true,
        ),
      ],
    },
    ...sharedCreateTours(copy, "TRANSFER", guide),
  ];
}

export function getVoucherCreateTours(copy: GuideCopy): Tour[] {
  return [
    ...importCreateTours(copy),
    ...exportCreateTours(copy),
    ...transferCreateTours(copy),
  ];
}
