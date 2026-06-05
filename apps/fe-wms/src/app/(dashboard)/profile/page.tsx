import { Metadata } from "next";
import UserProfilePage from "@/components/profile/UserProfilePage";

export const metadata: Metadata = {
  title: "Hồ sơ cá nhân",
};

export default function Profile() {
  return <UserProfilePage />;
}
