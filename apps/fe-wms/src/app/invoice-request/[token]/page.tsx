import type { Metadata } from "next";
import CustomerInvoiceRequestForm from "@/components/invoices/public/CustomerInvoiceRequestForm";

export const metadata: Metadata = {
  title: "Yêu cầu xuất hóa đơn · J-PULSE",
  description: "Cập nhật thông tin người mua cho hóa đơn điện tử.",
  robots: { index: false, follow: false },
};

export default async function CustomerInvoiceRequestPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <CustomerInvoiceRequestForm token={token} />;
}
