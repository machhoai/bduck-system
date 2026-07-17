import { db } from "../config/firebase.js";
import { ExpenseCategory, ExpenseCostCenter } from "@bduck/shared-types";
import type { ExpenseDocument } from "@bduck/shared-types";
import * as expenseRepo from "../repositories/expenseRepository.js";
import {
  EXPENSE_CATEGORY_COST_CENTER,
  EXPENSE_COST_CENTER_COLORS,
  buildExpenseKpi,
  getExpenseMonthLabel,
  getPreviousExpensePeriod,
} from "./expenseDashboardPolicy.js";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface KPIMetric {
  value: number;
  prevValue: number;
  trend: number;
}

interface TrendPoint {
  month: string;
  revenue: number;
  expenses: number;
}

interface CostCenterBreakdownItem {
  costCenter: ExpenseCostCenter;
  amount: number;
  percentage: number;
  color: string;
}

interface OverBudgetStoreItem {
  warehouseId: string;
  warehouseName: string;
  budgetUsed: number;
  totalBudget: number;
  totalActual: number;
}

export interface DashboardMetrics {
  grossRevenue: KPIMetric;
  totalExpenses: KPIMetric;
  netProfit: KPIMetric;
  profitMargin: KPIMetric;
  trendData: TrendPoint[];
  costCenterBreakdown: CostCenterBreakdownItem[];
  overBudgetStores: OverBudgetStoreItem[];
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

// ─────────────────────────────────────────────
// Revenue Calculation (from revenue_sync collection — JoyWorld API)
// ─────────────────────────────────────────────

async function calculateRevenue(
  warehouseIds: readonly string[],
  period: string,
): Promise<number> {
  if (warehouseIds.length === 0) return 0;
  const snapshots = await db.getAll(
    ...warehouseIds.map((warehouseId) =>
      db.collection("revenue_sync").doc(`${warehouseId}_${period}`),
    ),
  );
  return snapshots.reduce(
    (total, snapshot) => total + Number(snapshot.data()?.total_revenue ?? 0),
    0,
  );
}

// ─────────────────────────────────────────────
// Expense Totals (from expense documents)
// ─────────────────────────────────────────────

function sumExpenseItems(
  docs: ExpenseDocument[],
  field: "actual_amount" | "budget_amount",
): number {
  let total = 0;
  for (const doc of docs) {
    for (const cat of Object.values(ExpenseCategory)) {
      const item = doc.items[cat];
      if (item) {
        total += (item[field] as number) ?? 0;
      }
    }
  }
  return total;
}

function buildCostCenterBreakdown(
  docs: ExpenseDocument[],
): CostCenterBreakdownItem[] {
  const totals: Record<ExpenseCostCenter, number> = {
    [ExpenseCostCenter.OPERATIONS]: 0,
    [ExpenseCostCenter.HR]: 0,
    [ExpenseCostCenter.MARKETING]: 0,
    [ExpenseCostCenter.MERCHANDISE]: 0,
    [ExpenseCostCenter.OTHERS]: 0,
  };

  for (const doc of docs) {
    for (const cat of Object.values(ExpenseCategory)) {
      const item = doc.items[cat];
      if (item) {
        const cc = EXPENSE_CATEGORY_COST_CENTER[cat];
        totals[cc] += item.actual_amount ?? 0;
      }
    }
  }

  const grandTotal = Object.values(totals).reduce((a, b) => a + b, 0);

  return Object.values(ExpenseCostCenter).map((cc) => ({
    costCenter: cc,
    amount: totals[cc],
    percentage:
      grandTotal > 0 ? Math.round((totals[cc] / grandTotal) * 100) : 0,
    color: EXPENSE_COST_CENTER_COLORS[cc],
  }));
}

// ─────────────────────────────────────────────
// Over-Budget Stores
// ─────────────────────────────────────────────

async function getOverBudgetStores(
  period: string,
  warehouseIds: readonly string[],
): Promise<OverBudgetStoreItem[]> {
  const docs = await expenseRepo.findByPeriod(period, warehouseIds);
  if (docs.length === 0) return [];

  const warehouseSnapshots = await db.getAll(
    ...warehouseIds.map((warehouseId) =>
      db.collection("warehouses").doc(warehouseId),
    ),
  );
  const whNames: Record<string, string> = {};
  for (const snapshot of warehouseSnapshots) {
    if (snapshot.exists && snapshot.data()?.is_deleted === false) {
      whNames[snapshot.id] = (snapshot.data()?.name as string) || snapshot.id;
    }
  }

  const results: OverBudgetStoreItem[] = [];

  for (const doc of docs) {
    let totalActual = 0;
    let totalBudget = 0;

    for (const cat of Object.values(ExpenseCategory)) {
      const item = doc.items[cat];
      if (item) {
        totalActual += item.actual_amount ?? 0;
        totalBudget += (item.budget_amount as number) ?? 0;
      }
    }

    if (totalBudget > 0) {
      const budgetUsed = Math.round((totalActual / totalBudget) * 100);
      if (budgetUsed > 100) {
        results.push({
          warehouseId: doc.warehouse_id,
          warehouseName: whNames[doc.warehouse_id] || doc.warehouse_id,
          budgetUsed,
          totalBudget,
          totalActual,
        });
      }
    }
  }

  return results.sort((a, b) => b.budgetUsed - a.budgetUsed);
}

// ─────────────────────────────────────────────
// Trend Data (6-month window)
// ─────────────────────────────────────────────

async function getTrendData(
  warehouseId: string,
  currentPeriod: string,
  warehouseIds: readonly string[],
): Promise<TrendPoint[]> {
  const periods: string[] = [];
  let period = currentPeriod;
  for (let i = 0; i < 6; i++) {
    periods.unshift(period);
    period = getPreviousExpensePeriod(period);
  }

  const results = await Promise.all(
    periods.map(async (p) => {
      const isAll = warehouseId === "ALL";
      const docs = isAll
        ? await expenseRepo.findByPeriod(p, warehouseIds)
        : await expenseRepo
            .getById(`${warehouseId}_${p}`)
            .then((d) => (d ? [d] : []));

      const expenses = sumExpenseItems(docs, "actual_amount");
      const revenue = await calculateRevenue(
        isAll ? warehouseIds : [warehouseId],
        p,
      );

      return {
        month: getExpenseMonthLabel(p),
        revenue,
        expenses,
      };
    }),
  );

  return results;
}

// ─────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────

export async function getDashboardMetrics(
  warehouseId: string,
  period: string,
  warehouseIds: readonly string[],
): Promise<DashboardMetrics> {
  const isAll = warehouseId === "ALL";
  const prevPeriod = getPreviousExpensePeriod(period);

  // Current period data
  const currentDocs = isAll
    ? await expenseRepo.findByPeriod(period, warehouseIds)
    : await expenseRepo
        .getById(`${warehouseId}_${period}`)
        .then((d) => (d ? [d] : []));

  // Previous period data (for MoM comparison)
  const prevDocs = isAll
    ? await expenseRepo.findByPeriod(prevPeriod, warehouseIds)
    : await expenseRepo
        .getById(`${warehouseId}_${prevPeriod}`)
        .then((d) => (d ? [d] : []));

  // Revenue
  const [currentRevenue, prevRevenue] = await Promise.all([
    calculateRevenue(isAll ? warehouseIds : [warehouseId], period),
    calculateRevenue(isAll ? warehouseIds : [warehouseId], prevPeriod),
  ]);

  // Expense totals
  const currentExpenses = sumExpenseItems(currentDocs, "actual_amount");
  const prevExpenses = sumExpenseItems(prevDocs, "actual_amount");

  // Net profit
  const currentNet = currentRevenue - currentExpenses;
  const prevNet = prevRevenue - prevExpenses;

  // Profit margin
  const currentMargin =
    currentRevenue > 0 ? (currentNet / currentRevenue) * 100 : 0;
  const prevMargin = prevRevenue > 0 ? (prevNet / prevRevenue) * 100 : 0;

  // Parallel: trend data + over-budget + cost center
  const [trendData, overBudgetStores] = await Promise.all([
    getTrendData(warehouseId, period, warehouseIds),
    isAll ? getOverBudgetStores(period, warehouseIds) : Promise.resolve([]),
  ]);

  const costCenterBreakdown = buildCostCenterBreakdown(currentDocs);

  return {
    grossRevenue: buildExpenseKpi(currentRevenue, prevRevenue),
    totalExpenses: buildExpenseKpi(currentExpenses, prevExpenses),
    netProfit: buildExpenseKpi(currentNet, prevNet),
    profitMargin: buildExpenseKpi(
      parseFloat(currentMargin.toFixed(1)),
      parseFloat(prevMargin.toFixed(1)),
    ),
    trendData,
    costCenterBreakdown,
    overBudgetStores,
  };
}
