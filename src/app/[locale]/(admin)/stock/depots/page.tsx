import ConsignmentsPage from "@/components/stock/ConsignmentsPage";
import { initPage, type LocaleParams } from "@/i18n/page";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Dépôts-vente" };

export default async function Page({ params }: LocaleParams) {
  await initPage(params);
  return <ConsignmentsPage />;
}
