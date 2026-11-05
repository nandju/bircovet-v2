import AnnouncementsPage from "@/components/admin/AnnouncementsPage";
import { initPage, type LocaleParams } from "@/i18n/page";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Annonces et partenaires" };

export default async function Page({ params }: LocaleParams) {
  await initPage(params);
  return <AnnouncementsPage />;
}
