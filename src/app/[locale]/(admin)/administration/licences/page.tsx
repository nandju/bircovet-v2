import LicencesPage from "@/components/admin/LicencesPage";
import { initPage, type LocaleParams } from "@/i18n/page";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Licences" };

export default async function Page({ params }: LocaleParams) {
  await initPage(params);
  return <LicencesPage />;
}
