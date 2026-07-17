import type {
  ExpenseCategory,
  ExpenseCostCenter,
  ExpenseItem,
} from "@bduck/shared-types";
import type { AuditMetadata } from "./auditService.js";
import {
  authorizationError,
  type AuthorizationService,
} from "./authorization/index.js";
import {
  EXPENSE_WRITE_ACTIONS,
  expensePermissionForCategory,
  expensePermissionForCostCenter,
} from "./expenseAuthorizationPolicy.js";
import * as expenseService from "./expenseService.js";
import { getDashboardMetrics } from "./expenseDashboardService.js";

const consolidatedFacilityIds = (
  authorization: AuthorizationService,
): string[] =>
  authorization
    .facilityIdsFor("expenses.consolidated.view")
    .filter((facilityId) => authorization.can("expenses.read", facilityId));

const assertAnyExpenseWrite = (
  authorization: AuthorizationService,
  facilityId: string,
): void => {
  if (
    !EXPENSE_WRITE_ACTIONS.some((action) =>
      authorization.can(action, facilityId),
    )
  ) {
    throw authorizationError("AUTHORIZATION_DENIED");
  }
};

export const getExpenseData = async (
  facilityId: string,
  period: string,
  userId: string,
  authorization: AuthorizationService,
) => {
  if (facilityId !== "ALL") {
    authorization.assert("expenses.read", facilityId);
    return expenseService.getExpenseData(facilityId, period, userId);
  }
  const facilityIds = consolidatedFacilityIds(authorization);
  if (facilityIds.length === 0)
    throw authorizationError("AUTHORIZATION_DENIED");
  return expenseService.getExpenseData("ALL", period, userId, facilityIds);
};

export const getExpenseDashboard = async (
  facilityId: string,
  period: string,
  authorization: AuthorizationService,
) => {
  if (facilityId !== "ALL") {
    authorization.assert("expenses.read", facilityId);
    authorization.assert("revenue.read", facilityId);
    return getDashboardMetrics(facilityId, period, [facilityId]);
  }
  const facilityIds = consolidatedFacilityIds(authorization).filter((id) =>
    authorization.can("revenue.read", id),
  );
  if (facilityIds.length === 0)
    throw authorizationError("AUTHORIZATION_DENIED");
  return getDashboardMetrics("ALL", period, facilityIds);
};

export const updateExpenseItem = async (
  facilityId: string,
  period: string,
  category: ExpenseCategory,
  itemData: Partial<ExpenseItem>,
  userId: string,
  authorization: AuthorizationService,
  auditMetadata?: AuditMetadata,
) => {
  authorization.assert(expensePermissionForCategory(category), facilityId);
  return expenseService.updateExpenseItem(
    facilityId,
    period,
    category,
    itemData,
    userId,
    auditMetadata,
  );
};

export const saveCustomExpenseItem = async (
  facilityId: string,
  period: string,
  itemId: string,
  itemData: {
    label: string;
    cost_center: ExpenseCostCenter;
    actual_amount: number;
    budget_amount: number | null;
    note?: string | null;
  },
  userId: string,
  authorization: AuthorizationService,
  auditMetadata?: AuditMetadata,
) => {
  authorization.assert(
    expensePermissionForCostCenter(itemData.cost_center),
    facilityId,
  );
  return expenseService.saveCustomExpenseItem(
    facilityId,
    period,
    itemId,
    itemData,
    userId,
    auditMetadata,
  );
};

export const deleteCustomExpenseItem = async (
  facilityId: string,
  period: string,
  itemId: string,
  userId: string,
  authorization: AuthorizationService,
  auditMetadata?: AuditMetadata,
) => {
  assertAnyExpenseWrite(authorization, facilityId);
  const existing = await expenseService.getExpenseCustomItem(
    facilityId,
    period,
    itemId,
  );
  if (!existing)
    return expenseService.deleteCustomExpenseItem(
      facilityId,
      period,
      itemId,
      userId,
      auditMetadata,
    );
  authorization.assert(
    expensePermissionForCostCenter(existing.cost_center),
    facilityId,
  );
  return expenseService.deleteCustomExpenseItem(
    facilityId,
    period,
    itemId,
    userId,
    auditMetadata,
  );
};

export const closePeriod = async (
  facilityId: string,
  period: string,
  userId: string,
  authorization: AuthorizationService,
  auditMetadata?: AuditMetadata,
) => {
  authorization.assert("expenses.close_period", facilityId);
  return expenseService.closePeriod(facilityId, period, userId, auditMetadata);
};

export const reopenPeriod = async (
  facilityId: string,
  period: string,
  userId: string,
  authorization: AuthorizationService,
  auditMetadata?: AuditMetadata,
) => {
  authorization.assert("expenses.reopen_period", facilityId);
  return expenseService.reopenPeriod(facilityId, period, userId, auditMetadata);
};
