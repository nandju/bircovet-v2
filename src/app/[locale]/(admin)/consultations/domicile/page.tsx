import HomeVisitsPage from "@/components/consultations/HomeVisitsPage";
import { initPage, type LocaleParams } from "@/i18n/page";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Consultations à domicile" };

export default async function Page({ params }: LocaleParams) {
  await initPage(params);
  return <HomeVisitsPage />;
}
