import MovementsPage from "@/components/stock/MovementsPage";
import { initPage, type LocaleParams } from "@/i18n/page";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Mouvements de stock" };

export default async function Page({ params }: LocaleParams) {
  await initPage(params);
  return <MovementsPage />;
}
