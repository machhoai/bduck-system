import ExternalCountPage from "../../../../components/features/external-count/ExternalCountPage";
import ExternalNavTabs from "../../../../components/features/external/ExternalNavTabs";

export const metadata = {
  title: "Kiểm đếm ngoài | J-PULSE",
};

export default function Page() {
  return (
    <>
      <ExternalNavTabs active="count" />
      <ExternalCountPage />
    </>
  );
}
