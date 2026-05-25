import { redirect } from "next/navigation";

/**
 * Root page — Redirect to /dashboard
 */
export default function Home() {
  redirect("/dashboard");
}
