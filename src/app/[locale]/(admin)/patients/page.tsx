import PatientsList from "@/components/patients/PatientsList";
import { initPage, type LocaleParams } from "@/i18n/page";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Patients" };

export default async function Page({ params }: LocaleParams) {
  await initPage(params);
  return <PatientsList />;
}
