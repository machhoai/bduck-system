"use client";

import { useSearchParams } from "next/navigation";
import ExpenseEntryPage from "@/components/features/expenses/ExpenseEntryPage";

function getCurrentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export default function ExpensesEntryRoute() {
  const searchParams = useSearchParams();
  const warehouseId = searchParams.get("warehouse") || "ALL";
  const period = searchParams.get("period") || getCurrentPeriod();

  return <ExpenseEntryPage warehouseId={warehouseId} period={period} />;
}
