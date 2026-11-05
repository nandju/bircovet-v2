import QuotesPage from "@/components/billing/QuotesPage";
import { initPage, type LocaleParams } from "@/i18n/page";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Devis / pro forma" };

/** Le pro forma et le devis sont un seul et même document : l'ancienne adresse affiche la liste des devis. */
export default async function Page({ params }: LocaleParams) {
  await initPage(params);
  return <QuotesPage />;
}
