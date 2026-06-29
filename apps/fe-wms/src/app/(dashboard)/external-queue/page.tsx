import { redirect } from "next/navigation";

export const metadata = {
    title: "Duyệt đơn ngoài | B-Duck WMS",
    description: "Quản lý và duyệt các đơn yêu cầu xuất từ hệ thống bên ngoài",
};

export default function Page() {
    redirect("/external/queue");
}
