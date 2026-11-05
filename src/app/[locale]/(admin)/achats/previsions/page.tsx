import ForecastPage from "@/components/forecast/ForecastPage";
import { initPage, type LocaleParams } from "@/i18n/page";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Prévisions de commande" };

export default async function Page({ params }: LocaleParams) {
  await initPage(params);
  return <ForecastPage />;
}
