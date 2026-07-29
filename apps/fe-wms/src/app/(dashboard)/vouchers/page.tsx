import { Suspense } from "react";
import VouchersPage from "../../../components/features/vouchers/VouchersPage";
import ImportVoucherSkeleton from "../../../components/features/import-vouchers/ImportVoucherSkeleton";

export const metadata = {
  title: "Vouchers & Transfers | B.Duck System",
  description: "Manage import, export, and transfer operations",
};

export default function Page() {
  return (
    <Suspense fallback={<ImportVoucherSkeleton />}>
      <VouchersPage />
    </Suspense>
  );
}
