import PatientDetail from "@/components/patients/PatientDetail";
import { initIdPage, type IdParams } from "@/i18n/page";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Fiche patient" };

export default async function Page({ params }: IdParams) {
  const id = await initIdPage(params);
  return <PatientDetail id={id} />;
}
