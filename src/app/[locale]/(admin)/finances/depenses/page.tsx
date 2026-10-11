import ExpensesPage from "@/components/finances/ExpensesPage";
import { initPage, type LocaleParams } from "@/i18n/page";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Dépenses" };

export default async function Page({ params }: LocaleParams) {
  await initPage(params);
  return <ExpensesPage />;
}
