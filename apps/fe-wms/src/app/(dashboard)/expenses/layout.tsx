import { Suspense } from "react";
import ExpenseShell from "@/components/features/expenses/ExpenseShell";

export default function ExpensesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense>
      <ExpenseShell>{children}</ExpenseShell>
    </Suspense>
  );
}
