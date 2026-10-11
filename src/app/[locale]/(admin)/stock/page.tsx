import StockOverview from "@/components/stock/StockOverview";
import { initPage, type LocaleParams } from "@/i18n/page";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Pharmacie et stock" };

export default async function Page({ params }: LocaleParams) {
  await initPage(params);
  return <StockOverview />;
}
