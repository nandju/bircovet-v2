import FneInvoicesPage from "@/components/billing/FneInvoicesPage";
import { initPage, type LocaleParams } from "@/i18n/page";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Factures FNE" };

export default async function Page({ params }: LocaleParams) {
  await initPage(params);
  return <FneInvoicesPage />;
}
