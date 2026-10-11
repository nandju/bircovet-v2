import HospitalizationsList from "@/components/hospitalization/HospitalizationsList";
import { initPage, type LocaleParams } from "@/i18n/page";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Hospitalisation" };

export default async function Page({ params }: LocaleParams) {
  await initPage(params);
  return <HospitalizationsList />;
}
