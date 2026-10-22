import DoseCalculatorPage from "@/components/stock/DoseCalculatorPage";
import { initPage, type LocaleParams } from "@/i18n/page";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Calculateur d'aide au conseil" };

export default async function Page({ params }: LocaleParams) {
  await initPage(params);
  return <DoseCalculatorPage />;
}
