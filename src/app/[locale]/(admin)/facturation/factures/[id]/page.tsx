import InvoiceDetail from "@/components/billing/InvoiceDetail";
import { initIdPage, type IdParams } from "@/i18n/page";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Facture" };

export default async function Page({ params }: IdParams) {
  const id = await initIdPage(params);
  return <InvoiceDetail id={id} />;
}
