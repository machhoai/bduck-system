import { redirect } from "next/navigation";

export default function ExportVouchersRedirectPage() {
    redirect("/vouchers?type=EXPORT");
}
