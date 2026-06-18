import { redirect } from "next/navigation";

export default function ImportVouchersRedirectPage() {
    redirect("/vouchers?type=IMPORT");
}
