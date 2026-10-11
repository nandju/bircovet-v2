import ReportsPage from "@/components/reports/ReportsPage";
import { initPage, type LocaleParams } from "@/i18n/page";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Rapports et statistiques" };

export default async function Page({ params }: LocaleParams) {
  await initPage(params);
  return <ReportsPage />;
}
