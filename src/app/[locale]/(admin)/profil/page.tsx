import ProfilePage from "@/components/admin/ProfilePage";
import { initPage, type LocaleParams } from "@/i18n/page";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Mon profil" };

export default async function Page({ params }: LocaleParams) {
  await initPage(params);
  return <ProfilePage />;
}
