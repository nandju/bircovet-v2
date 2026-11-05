import PayablesPage from "@/components/payables/PayablesPage";
import { initPage, type LocaleParams } from "@/i18n/page";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Dettes fournisseurs" };

export default async function Page({ params }: LocaleParams) {
  await initPage(params);
  return <PayablesPage />;
}
