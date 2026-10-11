import StockAlertsPage from "@/components/stock/StockAlertsPage";
import { initPage, type LocaleParams } from "@/i18n/page";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Alertes de stock" };

export default async function Page({ params }: LocaleParams) {
  await initPage(params);
  return <StockAlertsPage />;
}
