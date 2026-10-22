import InvoicesPage from "@/components/billing/InvoicesPage";
import { initPage, type LocaleParams } from "@/i18n/page";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Factures pro forma" };

export default async function Page({ params }: LocaleParams) {
  await initPage(params);
  return <InvoicesPage kind="proforma" />;
}
