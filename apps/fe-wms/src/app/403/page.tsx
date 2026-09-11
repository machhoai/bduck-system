import { ErrorPage } from "@/components/ui/ErrorPage";

export default function ForbiddenPage() {
  return <ErrorPage statusCode="403" />;
}
