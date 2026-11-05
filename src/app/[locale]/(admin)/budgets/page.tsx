import BudgetsPage from "@/components/budgets/BudgetsPage";
import { initPage, type LocaleParams } from "@/i18n/page";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Budgets" };

export default async function Page({ params }: LocaleParams) {
  await initPage(params);
  return <BudgetsPage />;
}
