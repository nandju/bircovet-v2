import TreatmentsPage from "@/components/treatments/TreatmentsPage";
import { initPage, type LocaleParams } from "@/i18n/page";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Suivi des traitements" };

export default async function Page({ params }: LocaleParams) {
  await initPage(params);
  return <TreatmentsPage />;
}
