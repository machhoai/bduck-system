import ExternalQueuePage from "../../../../components/features/external-queue/ExternalQueuePage";
import ExternalNavTabs from "../../../../components/features/external/ExternalNavTabs";

export const metadata = {
  title: "Quét mã ngoài | J-PULSE",
};

export default function Page() {
  return (
    <>
      <ExternalNavTabs active="queue" />
      <ExternalQueuePage />
    </>
  );
}
