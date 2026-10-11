import InteractionsPage from "@/components/crm/InteractionsPage";
import { initPage, type LocaleParams } from "@/i18n/page";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Interactions" };

export default async function Page({ params }: LocaleParams) {
  await initPage(params);
  return <InteractionsPage />;
}
