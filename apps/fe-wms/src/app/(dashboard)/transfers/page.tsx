import { redirect } from "next/navigation";

export default function TransfersRedirectPage() {
    redirect("/vouchers?type=TRANSFER");
}
