import InvoicesPage from "@/components/billing/InvoicesPage";
import { initPage, type LocaleParams } from "@/i18n/page";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Factures" };

export default async function Page({ params }: LocaleParams) {
  await initPage(params);
  return <InvoicesPage />;
}
