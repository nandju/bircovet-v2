import CounterSalePage from "@/components/pharma/CounterSalePage";
import { initPage, type LocaleParams } from "@/i18n/page";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Vente pharmacie" };

export default async function Page({ params }: LocaleParams) {
  await initPage(params);
  return <CounterSalePage />;
}
