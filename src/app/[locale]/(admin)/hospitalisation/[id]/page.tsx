import HospitalizationDetail from "@/components/hospitalization/HospitalizationDetail";
import { initIdPage, type IdParams } from "@/i18n/page";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Séjour d'hospitalisation" };

export default async function Page({ params }: IdParams) {
  const id = await initIdPage(params);
  return <HospitalizationDetail id={id} />;
}
