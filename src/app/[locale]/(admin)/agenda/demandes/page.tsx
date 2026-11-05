import RequestsPage from "@/components/agenda/RequestsPage";
import { initPage, type LocaleParams } from "@/i18n/page";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Demandes de rendez-vous" };

export default async function Page({ params }: LocaleParams) {
  await initPage(params);
  return <RequestsPage />;
}
