import PrescriptionsPage from "@/components/prescriptions/PrescriptionsPage";
import { initPage, type LocaleParams } from "@/i18n/page";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Prescriptions et délivrances" };

export default async function Page({ params }: LocaleParams) {
  await initPage(params);
  return <PrescriptionsPage />;
}
