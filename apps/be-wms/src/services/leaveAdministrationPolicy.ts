import type {
  LeaveLedgerDelta,
  UpsertLeavePolicyInput,
} from "@bduck/shared-types";
import { createZeroLeaveDelta } from "./leaveBalancePolicy.js";

const invalidPolicy = {
  statusCode: 400,
  messages: {
    vi: "Giá trị chính sách ngày phép không hợp lệ.",
    zh: "假期政策值无效。",
  },
};

const invalidAdjustment = {
  statusCode: 400,
  messages: {
    vi: "Số ngày điều chỉnh phải khác 0 và theo đơn vị 0,5 ngày.",
    zh: "调整天数必须非零，并以0.5天为单位。",
  },
};

const isHalfUnit = (value: number) =>
  Number.isFinite(value) && Math.round(value * 2) === value * 2;

export const assertValidCompanyLeavePolicy = (
  input: UpsertLeavePolicyInput,
) => {
  if (
    !isHalfUnit(input.monthly_accrual_units) ||
    input.monthly_accrual_units < 0.5 ||
    input.monthly_accrual_units > 31 ||
    !isHalfUnit(input.annual_cap_units) ||
    input.annual_cap_units < 1 ||
    input.annual_cap_units > 365
  ) {
    throw invalidPolicy;
  }
};

export const buildManualLeaveAdjustmentDelta = (
  availableUnitsDelta: number,
): LeaveLedgerDelta => {
  if (
    !isHalfUnit(availableUnitsDelta) ||
    availableUnitsDelta === 0 ||
    Math.abs(availableUnitsDelta) > 365
  ) {
    throw invalidAdjustment;
  }
  return {
    ...createZeroLeaveDelta(),
    available_units: availableUnitsDelta,
  };
};
