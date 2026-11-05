import CashBoxesPage from "@/components/finances/CashBoxesPage";
import { initPage, type LocaleParams } from "@/i18n/page";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Caisses de suivi" };

export default async function Page({ params }: LocaleParams) {
  await initPage(params);
  return <CashBoxesPage />;
}
