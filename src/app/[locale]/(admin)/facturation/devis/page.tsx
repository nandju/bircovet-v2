import QuotesPage from "@/components/billing/QuotesPage";
import { initPage, type LocaleParams } from "@/i18n/page";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Devis" };

export default async function Page({ params }: LocaleParams) {
  await initPage(params);
  return <QuotesPage />;
}
