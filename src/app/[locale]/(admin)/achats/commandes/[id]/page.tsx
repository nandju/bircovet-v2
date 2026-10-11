import PurchaseOrderDetail from "@/components/purchases/PurchaseOrderDetail";
import { initIdPage, type IdParams } from "@/i18n/page";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Commande d'achat" };

export default async function Page({ params }: IdParams) {
  const id = await initIdPage(params);
  return <PurchaseOrderDetail id={id} />;
}
