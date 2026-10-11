import ConsultationsList from "@/components/consultations/ConsultationsList";
import { initPage, type LocaleParams } from "@/i18n/page";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Consultations" };

export default async function Page({ params }: LocaleParams) {
  await initPage(params);
  return <ConsultationsList />;
}
