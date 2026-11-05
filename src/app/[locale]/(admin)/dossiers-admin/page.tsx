import AdminFilesPage from "@/components/adminfiles/AdminFilesPage";
import { initPage, type LocaleParams } from "@/i18n/page";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Dossiers administratifs" };

export default async function Page({ params }: LocaleParams) {
  await initPage(params);
  return <AdminFilesPage />;
}
