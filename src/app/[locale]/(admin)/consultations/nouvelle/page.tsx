import NewConsultation from "@/components/consultations/NewConsultation";
import { initPage, type LocaleParams } from "@/i18n/page";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Nouvelle consultation" };

export default async function Page({ params }: LocaleParams) {
  await initPage(params);
  return <NewConsultation />;
}
