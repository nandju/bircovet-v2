import RuralReportsPage from "@/components/missions/RuralReportsPage";
import { initPage, type LocaleParams } from "@/i18n/page";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Rapports et actions à mener" };

export default async function Page({ params }: LocaleParams) {
  await initPage(params);
  return <RuralReportsPage />;
}
