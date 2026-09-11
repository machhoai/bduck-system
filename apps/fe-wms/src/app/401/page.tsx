import { ErrorPage } from "@/components/ui/ErrorPage";

export default function UnauthorizedPage() {
  return <ErrorPage statusCode="401" />;
}
